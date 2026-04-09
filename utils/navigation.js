const navigation = {
  navigateTo: function (url, options = {}) {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        const error = new Error('跳转路径不能为空');
        console.error('跳转失败:', error.message);
        wx.showToast({
          title: '跳转路径无效',
          icon: 'none',
          duration: 2000
        });
        reject(error);
        return;
      }

      console.log('准备跳转到:', url);
      
      wx.navigateTo({
        url: url,
        success: (res) => {
          console.log('跳转成功:', url);
          if (options.success) {
            options.success(res);
          }
          resolve(res);
        },
        fail: (error) => {
          console.error('跳转失败:', url, error);
          const errorMessage = this.getErrorMessage(error);
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          });
          if (options.fail) {
            options.fail(error);
          }
          reject(error);
        }
      });
    });
  },

  redirectTo: function (url, options = {}) {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        const error = new Error('跳转路径不能为空');
        console.error('重定向失败:', error.message);
        wx.showToast({
          title: '跳转路径无效',
          icon: 'none',
          duration: 2000
        });
        reject(error);
        return;
      }

      console.log('准备重定向到:', url);
      
      wx.redirectTo({
        url: url,
        success: (res) => {
          console.log('重定向成功:', url);
          if (options.success) {
            options.success(res);
          }
          resolve(res);
        },
        fail: (error) => {
          console.error('重定向失败:', url, error);
          const errorMessage = this.getErrorMessage(error);
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          });
          if (options.fail) {
            options.fail(error);
          }
          reject(error);
        }
      });
    });
  },

  switchTab: function (url, options = {}) {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        const error = new Error('跳转路径不能为空');
        console.error('Tab切换失败:', error.message);
        wx.showToast({
          title: '跳转路径无效',
          icon: 'none',
          duration: 2000
        });
        reject(error);
        return;
      }

      console.log('准备切换Tab到:', url);
      
      wx.switchTab({
        url: url,
        success: (res) => {
          console.log('Tab切换成功:', url);
          if (options.success) {
            options.success(res);
          }
          resolve(res);
        },
        fail: (error) => {
          console.error('Tab切换失败:', url, error);
          const errorMessage = this.getErrorMessage(error);
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          });
          if (options.fail) {
            options.fail(error);
          }
          reject(error);
        }
      });
    });
  },

  navigateBack: function (delta = 1, options = {}) {
    return new Promise((resolve, reject) => {
      console.log('准备返回上一页，delta:', delta);
      
      wx.navigateBack({
        delta: delta,
        success: (res) => {
          console.log('返回成功');
          if (options.success) {
            options.success(res);
          }
          resolve(res);
        },
        fail: (error) => {
          console.error('返回失败:', error);
          wx.showToast({
            title: '返回失败',
            icon: 'none',
            duration: 2000
          });
          if (options.fail) {
            options.fail(error);
          }
          reject(error);
        }
      });
    });
  },

  reLaunch: function (url, options = {}) {
    return new Promise((resolve, reject) => {
      if (!url || typeof url !== 'string') {
        const error = new Error('跳转路径不能为空');
        console.error('重启动失败:', error.message);
        wx.showToast({
          title: '跳转路径无效',
          icon: 'none',
          duration: 2000
        });
        reject(error);
        return;
      }

      console.log('准备重启动到:', url);
      
      wx.reLaunch({
        url: url,
        success: (res) => {
          console.log('重启动成功:', url);
          if (options.success) {
            options.success(res);
          }
          resolve(res);
        },
        fail: (error) => {
          console.error('重启动失败:', url, error);
          const errorMessage = this.getErrorMessage(error);
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          });
          if (options.fail) {
            options.fail(error);
          }
          reject(error);
        }
      });
    });
  },

  getErrorMessage: function (error) {
    if (!error) {
      return '跳转失败，请重试';
    }

    const errorMessages = {
      'navigateTo:fail page not found': '页面不存在',
      'navigateTo:fail webview count limit exceed': '页面栈已满，请返回后重试',
      'navigateTo:fail can not navigateTo a tabbar page': '不能跳转到Tab页面',
      'switchTab:fail page not found': 'Tab页面不存在',
      'redirectTo:fail page not found': '页面不存在',
      'reLaunch:fail page not found': '页面不存在'
    };

    const errMsg = error.errMsg || error.message || '';
    
    for (const key in errorMessages) {
      if (errMsg.includes(key)) {
        return errorMessages[key];
      }
    }

    return '跳转失败，请重试';
  },

  buildUrl: function (path, params = {}) {
    if (!path) {
      return '';
    }

    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    if (queryString) {
      return `${path}?${queryString}`;
    }

    return path;
  },

  navigateToDetail: function (type, id) {
    const routes = {
      product: '/pages/detail/detail',
      order: '/subpages/order/detail/detail',
      activity: '/subpages/activity/activity-detail/activity-detail'
    };

    const path = routes[type];
    if (!path) {
      console.error('未知的详情页类型:', type);
      wx.showToast({
        title: '页面类型无效',
        icon: 'none',
        duration: 2000
      });
      return Promise.reject(new Error('未知的详情页类型'));
    }

    const url = this.buildUrl(path, { id });
    return this.navigateTo(url);
  },

  navigateToList: function (type, params = {}) {
    const routes = {
      order: '/subpages/order/list/list',
      address: '/subpages/user/address/list/list',
      coupon: '/subpages/user/coupon/coupon',
      favorite: '/subpages/user/favorite/favorite',
      footprint: '/subpages/user/footprint/footprint'
    };

    const path = routes[type];
    if (!path) {
      console.error('未知的列表页类型:', type);
      wx.showToast({
        title: '页面类型无效',
        icon: 'none',
        duration: 2000
      });
      return Promise.reject(new Error('未知的列表页类型'));
    }

    const url = this.buildUrl(path, params);
    return this.navigateTo(url);
  }
};

module.exports = navigation;
