// empty.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    text: {
      type: String,
      value: '暂无数据'
    },
    icon: {
      type: String,
      value: '/images/empty-state.png'
    },
    buttonText: {
      type: String,
      value: ''
    }
  },

  data: {
    // 组件内部数据
  },

  methods: {
    // 按钮点击事件
    handleButtonClick: function() {
      this.triggerEvent('buttonClick');
    }
  }
});