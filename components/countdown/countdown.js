// countdown.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: true
    },
    title: {
      type: String,
      value: '限时活动'
    },
    targetTime: {
      type: Number,
      value: 0,
      observer: function(newVal) {
        if (newVal) {
          this.initCountdown(newVal);
        }
      }
    }
  },

  data: {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    countdownTimer: null
  },

  lifetimes: {
    attached: function() {
      // 组件挂载时初始化
      if (this.data.targetTime) {
        this.initCountdown(this.data.targetTime);
      } else {
        // 默认24小时倒计时
        this.initCountdown(Date.now() + 24 * 60 * 60 * 1000);
      }
    },

    detached: function() {
      // 组件卸载时清除定时器
      this.clearCountdown();
    }
  },

  methods: {
    // 初始化倒计时
    initCountdown: function(targetTime) {
      this.clearCountdown();
      this.updateCountdown(targetTime);
      this.data.countdownTimer = setInterval(() => {
        this.updateCountdown(targetTime);
      }, 1000);
    },

    // 更新倒计时
    updateCountdown: function(targetTime) {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);

      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);

      this.setData({
        days,
        hours: this.formatNumber(hours),
        minutes: this.formatNumber(minutes),
        seconds: this.formatNumber(seconds)
      });

      // 倒计时结束
      if (diff <= 0) {
        this.clearCountdown();
        this.triggerEvent('countdownEnd');
      }
    },

    // 格式化数字，补零
    formatNumber: function(num) {
      return num < 10 ? `0${num}` : num;
    },

    // 清除倒计时
    clearCountdown: function() {
      if (this.data.countdownTimer) {
        clearInterval(this.data.countdownTimer);
        this.data.countdownTimer = null;
      }
    },

    // 暂停倒计时
    pause: function() {
      this.clearCountdown();
    },

    // 恢复倒计时
    resume: function() {
      if (this.data.targetTime) {
        this.initCountdown(this.data.targetTime);
      }
    }
  }
});