// customer-service/after-sales.js
Page({
  data: {
    serviceTypes: [
      { id: 'refund', name: '退款' },
      { id: 'return', name: '退货' },
      { id: 'exchange', name: '换货' },
      { id: 'other', name: '其他' }
    ],
    selectedType: '',
    orders: [
      { id: 1, orderId: '20240302001', date: '2024-03-01', status: '已收货' },
      { id: 2, orderId: '20240302002', date: '2024-02-28', status: '已收货' },
      { id: 3, orderId: '20240302003', date: '2024-02-25', status: '已收货' }
    ],
    selectedOrder: '',
    description: '',
    images: [],
    contact: '',
    canSubmit: false
  },

  onLoad: function () {
    console.log('售后申请页面加载');
  },

  // 返回上一页
  onBack: function () {
    wx.navigateBack();
  },

  // 选择售后类型
  selectServiceType: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type
    });
    this.checkCanSubmit();
  },

  // 选择订单
  selectOrder: function (e) {
    const order = e.currentTarget.dataset.order;
    this.setData({
      selectedOrder: order
    });
    this.checkCanSubmit();
  },

  // 问题描述输入
  onDescriptionChange: function (e) {
    this.setData({
      description: e.detail.value
    });
    this.checkCanSubmit();
  },

  // 联系方式输入
  onContactChange: function (e) {
    this.setData({
      contact: e.detail.value
    });
    this.checkCanSubmit();
  },

  // 选择图片
  chooseImage: function () {
    const that = this;
    wx.chooseImage({
      count: 5 - that.data.images.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        const tempFilePaths = res.tempFilePaths;
        const images = [...that.data.images, ...tempFilePaths];
        that.setData({
          images: images
        });
      }
    });
  },

  // 删除图片
  deleteImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({
      images: images
    });
  },

  // 检查是否可以提交
  checkCanSubmit: function () {
    const { selectedType, selectedOrder, description, contact } = this.data;
    const canSubmit = selectedType && selectedOrder && description && contact;
    this.setData({
      canSubmit: canSubmit
    });
  },

  // 提交申请
  submitApplication: function () {
    const { selectedType, selectedOrder, description, images, contact } = this.data;

    // 模拟提交
    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '申请提交成功',
        icon: 'success',
        duration: 2000
      });

      // 重置表单
      this.setData({
        selectedType: '',
        selectedOrder: '',
        description: '',
        images: [],
        contact: '',
        canSubmit: false
      });

      // 跳转到客户服务主页
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }, 1500);
  }
})