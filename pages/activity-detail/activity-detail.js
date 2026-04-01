// activity-detail.js - 活动详情页面

const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    activityId: '',
    activity: {},
    loading: false,
    error: false,
    errorMessage: '',
    participating: false
  },

  onLoad: function (options) {
    console.log('活动详情页面加载', options);
    const id = options.id || options.activityId;
    if (id) {
      this.setData({ activityId: id });
      this.loadActivityData(id);
    } else {
      this.setData({
        error: true,
        errorMessage: '活动ID不能为空'
      });
    }
  },

  // 加载活动数据
  loadActivityData: async function (id) {
    this.setData({ loading: true, error: false });
    try {
      // 从后端获取活动详情
      const activityData = await api.activity.getDetail(id);
      
      // 处理活动类型配置
      const typeConfig = this.getTypeConfig(activityData.type);
      
      // 更新数据
      this.setData({
        activity: {
          ...activityData,
          typeConfig
        }
      });
    } catch (error) {
      handleApiError(error);
      this.setData({
        error: true,
        errorMessage: error.message || '加载活动失败'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 获取活动类型配置
  getTypeConfig: function (type) {
    const configs = {
      'flash_sale': {
        text: '限时秒杀',
        color: '#ff4444',
        icon: '⏰'
      },
      'full_reduction': {
        text: '满减活动',
        color: '#ff8800',
        icon: '🎁'
      },
      'full_gift': {
        text: '满赠活动',
        color: '#44bb44',
        icon: '🎊'
      },
      'full_free_shipping': {
        text: '满免运费',
        color: '#4488ff',
        icon: '🚚'
      }
    };
    return configs[type] || {
      text: '活动',
      color: '#999999',
      icon: '📅'
    };
  },

  // 重新加载数据
  reloadData: function () {
    const id = this.data.activityId;
    if (id) {
      this.loadActivityData(id);
    }
  },

  // 返回上一页
  goBack: function () {
    wx.navigateBack();
  },

  // 参与活动
  participateActivity: async function () {
    const id = this.data.activityId;
    if (!id) return;
    
    this.setData({ participating: true });
    try {
      // 向后端发送参与请求
      const result = await api.activity.participate(id);
      
      // 显示成功提示
      wx.showToast({
        title: '参与活动成功',
        icon: 'success',
        duration: 1500
      });
      
      // 重新加载活动数据
      this.loadActivityData(id);
    } catch (error) {
      handleApiError(error);
    } finally {
      this.setData({ participating: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('下拉刷新');
    const id = this.data.activityId;
    if (id) {
      this.loadActivityData(id);
    }
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1500);
  },

  // 分享
  onShare: function () {
    console.log('分享活动');
    wx.showShareMenu({
      withShareTicket: true
    });
  },

  // 分享给好友
  onShareAppMessage: function () {
    const { activity } = this.data;
    return {
      title: activity.name || '精彩活动',
      path: '/pages/activity-detail/activity-detail?id=' + activity.id,
      imageUrl: activity.imageUrl || 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20promotion%20activity%20banner%20colorful%20modern%20design&image_size=square'
    };
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    const { activity } = this.data;
    return {
      title: activity.name || '精彩活动',
      imageUrl: activity.imageUrl || 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ecommerce%20promotion%20activity%20banner%20colorful%20modern%20design&image_size=square'
    };
  }
});
