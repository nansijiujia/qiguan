// favorite.js
import { checkLogin } from '../../utils/auth';

Page({
  data: {
    favorites: [
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
      },
      {
        id: '3',
        name: '智能手表男女士运动计步心率监测多功能手表',
        price: 399.99,
        image: '/images/default-product.png'
      }
    ]
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

  // 立即购买
  buyNow: function (e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${productId}`
    });
  },

  // 取消收藏
  removeFavorite: function (e) {
    const id = e.currentTarget.dataset.id;
    const favorites = this.data.favorites.filter(item => item.id !== id);
    this.setData({
      favorites: favorites
    });
    wx.showToast({
      title: '已取消收藏',
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