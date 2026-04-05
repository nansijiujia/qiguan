// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Search, Filter, Eye, Truck, CheckCircle, XCircle, Clock, ShoppingBag } from 'lucide-react';
// @ts-ignore;
import { Button, Input, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, useToast } from '@/components/ui';

import Layout from '@/components/Layout';
const Orders = props => {
  const {
    toast
  } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => {
    loadOrders();
  }, []);
  const loadOrders = async () => {
    try {
      setLoading(true);
      const result = await window.$w.cloud.callDataSource({
        dataSourceName: 'orders',
        methodName: 'wedaGetRecordsV2',
        params: {
          sort: {
            createdAt: -1
          }
        }
      });
      setOrders(result.records || []);
    } catch (error) {
      console.error('加载订单失败:', error);
      toast({
        title: '错误',
        description: '加载订单失败',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const handleStatusUpdate = async (order, newStatus) => {
    try {
      await window.$w.cloud.callDataSource({
        dataSourceName: 'orders',
        methodName: 'wedaUpdateV2',
        params: {
          _id: order._id,
          status: newStatus
        }
      });
      await loadOrders();
      toast({
        title: '成功',
        description: '订单状态更新成功'
      });
    } catch (error) {
      console.error('更新订单状态失败:', error);
      toast({
        title: '错误',
        description: '更新订单状态失败',
        variant: 'destructive'
      });
    }
  };
  const getStatusBadge = status => {
    const statusConfig = {
      pending: {
        label: '待支付',
        variant: 'secondary',
        icon: Clock
      },
      paid: {
        label: '已支付',
        variant: 'default',
        icon: CheckCircle
      },
      shipped: {
        label: '已发货',
        variant: 'outline',
        icon: Truck
      },
      completed: {
        label: '已完成',
        variant: 'default',
        icon: CheckCircle
      },
      cancelled: {
        label: '已取消',
        variant: 'destructive',
        icon: XCircle
      }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </Badge>;
  };
  const getStatusActions = order => {
    const actions = [];
    switch (order.status) {
      case 'pending':
        actions.push(<Button key="paid" size="sm" onClick={() => handleStatusUpdate(order, 'paid')}>
            标记为已支付
          </Button>);
        break;
      case 'paid':
        actions.push(<Button key="shipped" size="sm" onClick={() => handleStatusUpdate(order, 'shipped')}>
            标记为已发货
          </Button>);
        break;
      case 'shipped':
        actions.push(<Button key="completed" size="sm" onClick={() => handleStatusUpdate(order, 'completed')}>
            标记为已完成
          </Button>);
        break;
    }
    if (order.status !== 'cancelled' && order.status !== 'completed') {
      actions.push(<Button key="cancel" size="sm" variant="outline" onClick={() => handleStatusUpdate(order, 'cancelled')}>
          取消订单
        </Button>);
    }
    return actions;
  };
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) || order.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const statusStats = {
    pending: orders.filter(o => o.status === 'pending').length,
    paid: orders.filter(o => o.status === 'paid').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  };
  return <Layout activePage="orders">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">订单管理</h1>
          <p className="text-gray-600">管理客户订单和发货状态</p>
        </div>

        {/* 订单统计 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(statusStats).map(([status, count]) => <Card key={status} className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-sm text-gray-600">{getStatusBadge(status).props.children[1]}</div>
              </CardContent>
            </Card>)}
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="搜索订单号或用户名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <div className="flex space-x-4">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">全部状态</option>
                  <option value="pending">待支付</option>
                  <option value="paid">已支付</option>
                  <option value="shipped">已发货</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  筛选
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 订单列表 */}
        <Card>
          <CardHeader>
            <CardTitle>订单列表</CardTitle>
            <CardDescription>
              共 {filteredOrders.length} 个订单
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-600">加载中...</div>
              </div> : filteredOrders.length > 0 ? <div className="space-y-4">
                {filteredOrders.map(order => <div key={order._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 lg:space-y-0">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <span className="font-semibold text-gray-900">{order.orderNo}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">客户:</span> {order.userName}
                          </div>
                          <div>
                            <span className="font-medium">金额:</span> ¥{order.totalAmount}
                          </div>
                          <div>
                            <span className="font-medium">时间:</span> {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <span className="font-medium text-sm">商品:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {order.items?.map((item, index) => <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {item.productName} × {item.quantity}
                              </span>)}
                          </div>
                        </div>
                        
                        {order.shippingAddress && <div className="mt-2">
                            <span className="font-medium text-sm">收货地址:</span>
                            <div className="text-xs text-gray-600 mt-1">
                              {order.shippingAddress.name} {order.shippingAddress.phone}<br />
                              {order.shippingAddress.address}
                            </div>
                          </div>}
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-2" />
                          查看详情
                        </Button>
                        <div className="flex space-x-2">
                          {getStatusActions(order)}
                        </div>
                      </div>
                    </div>
                  </div>)}
              </div> : <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无订单</h3>
                <p className="text-gray-500">
                  {searchTerm || statusFilter ? '没有找到匹配的订单' : '还没有任何订单'}
                </p>
              </div>}
          </CardContent>
        </Card>
      </div>
    </Layout>;
};
export default Orders;