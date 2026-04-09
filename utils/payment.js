const { api, handleApiError } = require('./api');

const PAYMENT_CONFIG = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  queryInterval: 3000,
  maxQueryAttempts: 10
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
};

const PAYMENT_ERROR_CODES = {
  CANCEL: 'CANCEL',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
};

let paymentQueryTimer = null;

const createPayment = async (orderId, paymentMethod = 'wechat') => {
  try {
    const paymentParams = await api.order.pay(orderId, {
      paymentMethod
    });
    
    return {
      success: true,
      data: paymentParams
    };
  } catch (error) {
    return {
      success: false,
      error: parsePaymentError(error)
    };
  }
};

const requestWechatPayment = (paymentParams) => {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: paymentParams.timeStamp,
      nonceStr: paymentParams.nonceStr,
      package: paymentParams.package,
      signType: paymentParams.signType || 'MD5',
      paySign: paymentParams.paySign,
      success: (res) => {
        resolve({
          success: true,
          status: PAYMENT_STATUS.SUCCESS
        });
      },
      fail: (err) => {
        const errorInfo = parseWechatPaymentError(err);
        reject(errorInfo);
      }
    });
  });
};

const parseWechatPaymentError = (err) => {
  const errMsg = err.errMsg || '';
  
  if (errMsg.includes('cancel')) {
    return {
      code: PAYMENT_ERROR_CODES.CANCEL,
      message: '用户取消支付',
      status: PAYMENT_STATUS.CANCELLED
    };
  }
  
  if (errMsg.includes('network') || errMsg.includes('网络')) {
    return {
      code: PAYMENT_ERROR_CODES.NETWORK_ERROR,
      message: '网络错误，请检查网络连接',
      status: PAYMENT_STATUS.FAILED
    };
  }
  
  if (errMsg.includes('余额不足') || errMsg.includes('insufficient')) {
    return {
      code: PAYMENT_ERROR_CODES.INSUFFICIENT_BALANCE,
      message: '余额不足，请更换支付方式',
      status: PAYMENT_STATUS.FAILED
    };
  }
  
  if (errMsg.includes('timeout') || errMsg.includes('超时')) {
    return {
      code: PAYMENT_ERROR_CODES.TIMEOUT,
      message: '支付超时，请重试',
      status: PAYMENT_STATUS.TIMEOUT
    };
  }
  
  return {
    code: PAYMENT_ERROR_CODES.UNKNOWN,
    message: err.errMsg || '支付失败，请重试',
    status: PAYMENT_STATUS.FAILED
  };
};

const parsePaymentError = (error) => {
  if (!error) {
    return {
      code: PAYMENT_ERROR_CODES.UNKNOWN,
      message: '未知错误',
      status: PAYMENT_STATUS.FAILED
    };
  }
  
  if (error.code) {
    switch (error.code) {
      case 401:
        return {
          code: PAYMENT_ERROR_CODES.SYSTEM_ERROR,
          message: '登录已过期，请重新登录',
          status: PAYMENT_STATUS.FAILED
        };
      case 403:
        return {
          code: PAYMENT_ERROR_CODES.SYSTEM_ERROR,
          message: '没有支付权限',
          status: PAYMENT_STATUS.FAILED
        };
      case 404:
        return {
          code: PAYMENT_ERROR_CODES.SYSTEM_ERROR,
          message: '订单不存在',
          status: PAYMENT_STATUS.FAILED
        };
      case 500:
        return {
          code: PAYMENT_ERROR_CODES.SYSTEM_ERROR,
          message: '服务器错误，请稍后重试',
          status: PAYMENT_STATUS.FAILED
        };
    }
  }
  
  return {
    code: PAYMENT_ERROR_CODES.UNKNOWN,
    message: error.message || '支付失败，请重试',
    status: PAYMENT_STATUS.FAILED
  };
};

const queryPaymentStatus = async (orderId) => {
  try {
    const result = await api.order.getDetail(orderId);
    return {
      success: true,
      status: result.status,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: parsePaymentError(error)
    };
  }
};

const startPaymentStatusPolling = (orderId, callbacks = {}) => {
  let attempts = 0;
  
  const stopPolling = () => {
    if (paymentQueryTimer) {
      clearTimeout(paymentQueryTimer);
      paymentQueryTimer = null;
    }
  };
  
  const poll = async () => {
    if (attempts >= PAYMENT_CONFIG.maxQueryAttempts) {
      stopPolling();
      if (callbacks.onTimeout) {
        callbacks.onTimeout();
      }
      return;
    }
    
    attempts++;
    
    const result = await queryPaymentStatus(orderId);
    
    if (result.success) {
      if (result.status === 'paid' || result.status === 'completed') {
        stopPolling();
        if (callbacks.onSuccess) {
          callbacks.onSuccess(result.data);
        }
        return;
      }
      
      if (result.status === 'cancelled' || result.status === 'closed') {
        stopPolling();
        if (callbacks.onCancel) {
          callbacks.onCancel();
        }
        return;
      }
    }
    
    paymentQueryTimer = setTimeout(poll, PAYMENT_CONFIG.queryInterval);
  };
  
  poll();
  
  return {
    stop: stopPolling
  };
};

const executePayment = async (orderId, options = {}) => {
  const {
    paymentMethod = 'wechat',
    onSuccess,
    onFail,
    onCancel,
    onTimeout,
    retryCount = 0
  } = options;
  
  try {
    const createResult = await createPayment(orderId, paymentMethod);
    
    if (!createResult.success) {
      if (onFail) {
        onFail(createResult.error);
      }
      return {
        success: false,
        error: createResult.error
      };
    }
    
    const paymentResult = await requestWechatPayment(createResult.data);
    
    if (paymentResult.success) {
      const pollingOptions = {
        onSuccess: (data) => {
          if (onSuccess) {
            onSuccess(data);
          }
        },
        onCancel: () => {
          if (onCancel) {
            onCancel();
          }
        },
        onTimeout: () => {
          if (onTimeout) {
            onTimeout();
          }
        }
      };
      
      startPaymentStatusPolling(orderId, pollingOptions);
      
      return {
        success: true,
        status: PAYMENT_STATUS.SUCCESS
      };
    }
    
    return paymentResult;
    
  } catch (error) {
    const errorInfo = error.code ? error : parseWechatPaymentError(error);
    
    if (errorInfo.code === PAYMENT_ERROR_CODES.CANCEL) {
      if (onCancel) {
        onCancel(errorInfo);
      }
      return {
        success: false,
        error: errorInfo,
        status: PAYMENT_STATUS.CANCELLED
      };
    }
    
    if (retryCount < PAYMENT_CONFIG.maxRetries && 
        errorInfo.code !== PAYMENT_ERROR_CODES.INSUFFICIENT_BALANCE) {
      await new Promise(resolve => setTimeout(resolve, PAYMENT_CONFIG.retryDelay));
      return executePayment(orderId, {
        ...options,
        retryCount: retryCount + 1
      });
    }
    
    if (onFail) {
      onFail(errorInfo);
    }
    
    return {
      success: false,
      error: errorInfo,
      status: PAYMENT_STATUS.FAILED
    };
  }
};

const retryPayment = async (orderId, options = {}) => {
  const { paymentMethod = 'wechat' } = options;
  
  try {
    const statusResult = await queryPaymentStatus(orderId);
    
    if (!statusResult.success) {
      return {
        success: false,
        error: statusResult.error
      };
    }
    
    if (statusResult.status === 'paid' || statusResult.status === 'completed') {
      return {
        success: true,
        message: '订单已支付',
        data: statusResult.data
      };
    }
    
    if (statusResult.status === 'cancelled' || statusResult.status === 'closed') {
      return {
        success: false,
        error: {
          code: PAYMENT_ERROR_CODES.SYSTEM_ERROR,
          message: '订单已取消或关闭，无法支付'
        }
      };
    }
    
    return executePayment(orderId, options);
    
  } catch (error) {
    return {
      success: false,
      error: parsePaymentError(error)
    };
  }
};

const handlePaymentTimeout = async (orderId) => {
  try {
    await api.order.cancel(orderId);
    return {
      success: true,
      message: '订单已超时取消'
    };
  } catch (error) {
    return {
      success: false,
      error: parsePaymentError(error)
    };
  }
};

const validatePaymentParams = (params) => {
  const required = ['timeStamp', 'nonceStr', 'package', 'paySign'];
  const missing = required.filter(key => !params[key]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      message: `缺少必要参数: ${missing.join(', ')}`
    };
  }
  
  if (!params.package.startsWith('prepay_id=')) {
    return {
      valid: false,
      message: 'package参数格式错误'
    };
  }
  
  return {
    valid: true
  };
};

const formatPaymentAmount = (amount) => {
  return (amount / 100).toFixed(2);
};

const calculatePaymentTimeout = (createdAt, timeoutMinutes = 30) => {
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - createdTime;
  const timeout = timeoutMinutes * 60 * 1000;
  const remaining = Math.max(0, timeout - elapsed);
  
  return {
    remaining,
    remainingMinutes: Math.ceil(remaining / (60 * 1000)),
    isExpired: remaining <= 0
  };
};

const showPaymentResult = (result, options = {}) => {
  const { successTitle = '支付成功', failTitle = '支付失败' } = options;
  
  if (result.success) {
    wx.showToast({
      title: successTitle,
      icon: 'success',
      duration: 2000
    });
  } else {
    const message = result.error?.message || '支付失败，请重试';
    wx.showModal({
      title: failTitle,
      content: message,
      showCancel: false,
      confirmText: '确定'
    });
  }
};

module.exports = {
  PAYMENT_STATUS,
  PAYMENT_ERROR_CODES,
  PAYMENT_CONFIG,
  createPayment,
  requestWechatPayment,
  executePayment,
  queryPaymentStatus,
  startPaymentStatusPolling,
  retryPayment,
  handlePaymentTimeout,
  parsePaymentError,
  parseWechatPaymentError,
  validatePaymentParams,
  formatPaymentAmount,
  calculatePaymentTimeout,
  showPaymentResult
};
