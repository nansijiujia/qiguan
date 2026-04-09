Page({
  data: {
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detailAddress: '',
      isDefault: false
    },
    addressId: ''
  },

  onLoad(options) {
    this.addressId = options.id;
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('addressData', (data) => {
      this.setData({
        formData: data.address
      });
    });
  },

  showRegionPicker() {
    wx.chooseLocation({
      success: (res) => {
        const address = res.address;
        const reg = /^(.*?[市州盟])(.*?[区县市旗])(.*)$/;
        const match = address.match(reg);
        if (match) {
          this.setData({
            'formData.province': res.address.slice(0, match[1].length),
            'formData.city': match[1],
            'formData.district': match[2],
            'formData.detailAddress': match[3]
          });
        } else {
          this.setData({
            'formData.detailAddress': address
          });
        }
      }
    });
  },

  submitAddress(e) {
    const formData = e.detail.value;
    
    if (!formData.name) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' });
      return;
    }
    
    if (!formData.phone) {
      wx.showToast({ title: '请输入手机号码', icon: 'none' });
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      wx.showToast({ title: '请输入正确的手机号码', icon: 'none' });
      return;
    }
    
    if (!formData.province || !formData.city || !formData.district) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    
    if (!formData.detailAddress) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
      return;
    }
    
    let addressList = wx.getStorageSync('addressList') || [];
    
    if (formData.isDefault) {
      addressList.forEach(item => {
        item.isDefault = false;
      });
    }
    
    addressList = addressList.map(item => {
      if (item.id === this.addressId) {
        return {
          ...item,
          name: formData.name,
          phone: formData.phone,
          province: formData.province,
          city: formData.city,
          district: formData.district,
          detailAddress: formData.detailAddress,
          isDefault: formData.isDefault === 'true' || formData.isDefault === true
        };
      }
      return item;
    });
    
    wx.setStorageSync('addressList', addressList);
    
    wx.showToast({
      title: '编辑地址成功',
      icon: 'success',
      success: () => {
        wx.navigateBack();
      }
    });
  }
});