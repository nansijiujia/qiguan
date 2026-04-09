// customer-service/faq.js
Page({
  data: {
    categories: [
      { id: 'all', name: '全部' },
      { id: 'order', name: '订单相关' },
      { id: 'payment', name: '支付问题' },
      { id: 'delivery', name: '物流配送' },
      { id: 'after-sales', name: '售后服务' }
    ],
    activeCategory: 'all',
    faqs: [
      {
        id: 1,
        category: 'order',
        question: '如何查看我的订单状态？',
        answer: '您可以在"我的"页面点击"我的订单"查看所有订单状态，也可以在订单列表页面通过不同标签查看不同状态的订单。',
        expanded: false
      },
      {
        id: 2,
        category: 'order',
        question: '如何取消订单？',
        answer: '在订单状态为"待付款"时，您可以在订单详情页面点击"取消订单"按钮取消订单。如果订单已经付款，需要联系客服申请退款。',
        expanded: false
      },
      {
        id: 3,
        category: 'payment',
        question: '支持哪些支付方式？',
        answer: '我们支持微信支付、支付宝、银行卡等多种支付方式，您可以在结算页面选择适合您的支付方式。',
        expanded: false
      },
      {
        id: 4,
        category: 'payment',
        question: '支付失败怎么办？',
        answer: '如果支付失败，您可以尝试重新支付，或者检查您的支付账户余额是否充足。如果问题仍然存在，请联系客服寻求帮助。',
        expanded: false
      },
      {
        id: 5,
        category: 'delivery',
        question: '什么时候发货？',
        answer: '一般情况下，我们会在您付款成功后48小时内发货。特殊情况（如预售商品）会在商品详情页注明发货时间。',
        expanded: false
      },
      {
        id: 6,
        category: 'delivery',
        question: '如何查看物流信息？',
        answer: '您可以在订单详情页面点击"查看物流"按钮，或者在"我的订单"页面找到对应订单查看物流信息。',
        expanded: false
      },
      {
        id: 7,
        category: 'after-sales',
        question: '如何申请退货/退款？',
        answer: '您可以在"售后申请"页面选择需要退货/退款的订单，填写申请原因并上传相关凭证，提交后等待客服审核。',
        expanded: false
      },
      {
        id: 8,
        category: 'after-sales',
        question: '退货/退款需要多长时间处理？',
        answer: '一般情况下，我们会在收到您的退货申请后1-3个工作日内完成审核，退款会在审核通过后1-7个工作日内原路返回您的支付账户。',
        expanded: false
      }
    ],
    filteredFAQs: []
  },

  onLoad: function () {
    console.log('常见问题页面加载');
    this.filterFAQs();
  },

  // 返回上一页
  onBack: function () {
    wx.navigateBack();
  },

  // 切换分类
  switchCategory: function (e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      activeCategory: category
    });
    this.filterFAQs();
  },

  // 过滤FAQ列表
  filterFAQs: function () {
    const { faqs, activeCategory } = this.data;
    let filtered = faqs;
    
    if (activeCategory !== 'all') {
      filtered = faqs.filter(item => item.category === activeCategory);
    }
    
    // 重置展开状态
    filtered = filtered.map(item => ({
      ...item,
      expanded: false
    }));
    
    this.setData({
      filteredFAQs: filtered
    });
  },

  // 切换答案展开/收起
  toggleAnswer: function (e) {
    const index = e.currentTarget.dataset.index;
    const filteredFAQs = [...this.data.filteredFAQs];
    filteredFAQs[index].expanded = !filteredFAQs[index].expanded;
    
    this.setData({
      filteredFAQs: filteredFAQs
    });
  }
})