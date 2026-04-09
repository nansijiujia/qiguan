Page({
  data: {
    addressList: []
  },

  onLoad() {
    this.getAddressList();
  },

  onShow() {
    this.getAddressList();
  },

  getAddressList() {
    const addressList = wx.getStorageSync('addressList') || [];
    this.setData({
      addressList
    });
  },

  addAddress() {
    wx.navigateTo({
      url: '../add/add'
    });
  },

  editAddress(e) {
    const id = e.currentTarget.dataset.id;
    const address = this.data.addressList.find(item => item.id === id);
    wx.navigateTo({
      url: `../edit/edit?id=${id}`,
      success: (res) => {
        res.eventChannel.emit('addressData', {
          address
        });
      }
    });
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此收货地址吗？',
      success: (res) => {
        if (res.confirm) {
          let addressList = wx.getStorageSync('addressList') || [];
          addressList = addressList.filter(item => item.id !== id);
          wx.setStorageSync('addressList', addressList);
          this.setData({
            addressList
          });
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  setDefault(e) {
    const id = e.currentTarget.dataset.id;
    let addressList = wx.getStorageSync('addressList') || [];
    addressList = addressList.map(item => ({
      ...item,
      isDefault: item.id === id
    }));
    wx.setStorageSync('addressList', addressList);
    this.setData({
      addressList
    });
    wx.showToast({
      title: '设置默认地址成功',
      icon: 'success'
    });
  }
});