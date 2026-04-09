// customer-service/chat.js
import { getCurrentUser } from '../../utils/auth';

Page({
  data: {
    messages: [],
    inputValue: '',
    userInfo: {}
  },

  onLoad: function () {
    console.log('在线客服聊天页面加载');
    this.setData({
      userInfo: getCurrentUser() || {}
    });
  },

  // 返回上一页
  onBack: function () {
    wx.navigateBack();
  },

  // 输入框内容变化
  onInputChange: function (e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息
  sendMessage: function () {
    const content = this.data.inputValue.trim();
    if (!content) return;

    // 添加用户消息
    const newMessage = {
      content: content,
      type: 'user',
      time: new Date().toLocaleTimeString()
    };

    const updatedMessages = [...this.data.messages, newMessage];
    this.setData({
      messages: updatedMessages,
      inputValue: ''
    });

    // 模拟客服回复
    setTimeout(() => {
      this.simulateServiceReply();
    }, 1000);
  },

  // 模拟客服回复
  simulateServiceReply: function () {
    const replies = [
      '好的，我明白了，正在为您处理...',
      '感谢您的咨询，我们会尽快为您解决问题。',
      '请问还有其他问题需要帮助吗？',
      '我们的工作时间是周一至周日 9:00-21:00，有任何问题都可以随时咨询。'
    ];

    const randomReply = replies[Math.floor(Math.random() * replies.length)];

    // 添加客服消息
    const serviceMessage = {
      content: randomReply,
      type: 'service',
      time: new Date().toLocaleTimeString()
    };

    const updatedMessages = [...this.data.messages, serviceMessage];
    this.setData({
      messages: updatedMessages
    });
  }
})