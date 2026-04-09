// loading.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    text: {
      type: String,
      value: '加载中...'
    }
  },

  data: {
    // 组件内部数据
  },

  methods: {
    // 显示加载
    show: function(text = '加载中...') {
      this.setData({ visible: true, text });
    },

    // 隐藏加载
    hide: function() {
      this.setData({ visible: false });
    }
  }
});