// footprint.js
import { checkLogin } from '../../utils/auth';

Page({
  data: {
    footprintGroups: [
      {
        date: '今天',
        items: [
          {
            id: '1',
            name: '时尚连衣裙2024春夏新款女装气质温柔风长裙',
            price: 299.99,
            image: '/images/default-product.png'
          },
          {
            id: '2',
            name: '休闲运动鞋男女情侣款透气轻便跑步鞋',
            price: 199.99,
            image: '/images/default-product.png'
          }
        ]
      },
      {
        date: '昨天',
        items: [
          {
            id: '3',
            name: '智能手表男女士运动计步心率监测多功能手表',
            price: 399.99,
            image: '/images/default-product.png'
          }
        ]
      }
    ],
    totalFootprints: 3
  },

  onLoad: function () {
    this.checkLoginStatus();
  },

  checkLoginStatus: function () {
    const isLoggedIn = checkLogin();
    if (!isLoggedIn) {
      wx.navigateTo({
        url: '/pages/login/login'
      });
    }
  },

  onBack: function () {
    wx.navigateBack();
  },

  // 清空所有浏览记录
  clearAll: function () {
    wx.showModal({
      title: '清空浏览记录',
      content: '确定要清空所有浏览记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            footprintGroups: [],
            totalFootprints: 0
          });
          wx.showToast({
            title: '已清空浏览记录',
            icon: 'success',
            duration: 1000
          });
        }
      }
    });
  },

  // 立即购买
  buyNow: function (e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${productId}`
    });
  },

  // 加入收藏
  addToFavorite: function (e) {
    const productId = e.currentTarget.dataset.id;
    wx.showToast({
      title: '已加入收藏',
      icon: 'success',
      duration: 1000
    });
  },

  // 去购物
  goShopping: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
})