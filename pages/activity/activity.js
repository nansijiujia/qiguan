// activity.js - 活动列表页面

const { api, handleApiError } = require('../../utils/api');

Page({
  data: {
    activities: [],
    loading: true,
    error: false,
    errorMessage: ''
  },

  onLoad() {
    this.getActiveActivities();
  },

  onShow() {
    // 页面显示时可以刷新数据
    if (this.data.activities.length === 0) {
      this.getActiveActivities();
    }
  },

  onPullDownRefresh() {
    this.getActiveActivities();
  },

  // 获取活跃活动列表
  getActiveActivities() {
    this.setData({ loading: true, error: false });

    api.activity.getActive()
      .then(res => {
        // 处理活动数据，格式化日期
        const formattedActivities = res.map(activity => {
          return {
            ...activity,
            startDate: this.formatDate(activity.startDate),
            endDate: this.formatDate(activity.endDate),
            // 根据活动类型设置不同的样式和图标
            typeConfig: this.getActivityTypeConfig(activity.type)
          };
        });

        this.setData({ activities: formattedActivities, loading: false });
        wx.stopPullDownRefresh();
      })
      .catch(err => {
        handleApiError(err);
        this.setData({ 
          error: true, 
          errorMessage: err.message || '获取活动列表失败',
          loading: false 
        });
        wx.stopPullDownRefresh();
      });
  },

  // 跳转到活动详情页
  goToActivityDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `../activity-detail/activity-detail?id=${activityId}`
    });
  },

  // 格式化日期
  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取活动类型配置
  getActivityTypeConfig(type) {
    const configMap = {
      'flash_sale': { text: '限时抢购', color: '#ff4444', icon: '🔥' },
      'group_buy': { text: '拼团', color: '#ff8800', icon: '👥' },
      'full_reduction': { text: '满减', color: '#44bb44', icon: '🎁' },
      'full_gift': { text: '满赠', color: '#4488ff', icon: '🎀' },
      'full_free_shipping': { text: '满免', color: '#8844ff', icon: '🚚' }
    };
    return configMap[type] || { text: '活动', color: '#999999', icon: '📅' };
  },

  // 重新加载
  reloadData() {
    this.getActiveActivities();
  }
});