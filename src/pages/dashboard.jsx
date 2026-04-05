// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { ShoppingBag, Users, Package, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
// @ts-ignore;
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, useToast } from '@/components/ui';

import Layout from '@/components/Layout';
const Dashboard = props => {
  const {
    toast
  } = useToast();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    todayRevenue: 0,
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadDashboardData();
  }, []);
  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 获取商品总数
      const productsResult = await window.$w.cloud.callDataSource({
        dataSourceName: 'products',
        methodName: 'wedaGetRecordsV2',
        params: {
          filter: {
            status: 'active'
          }
        }
      });

      // 获取订单总数
      const ordersResult = await window.$w.cloud.callDataSource({
        dataSourceName: 'orders',
        methodName: 'wedaGetRecordsV2',
        params: {}
      });

      // 获取用户总数
      const usersResult = await window.$w.cloud.callDataSource({
        dataSourceName: 'users',
        methodName: 'wedaGetRecordsV2',
        params: {}
      });

      // 获取最近订单
      const recentOrdersResult = await window.$w.cloud.callDataSource({
        dataSourceName: 'orders',
        methodName: 'wedaGetRecordsV2',
        params: {
          limit: 5,
          sort: {
            createdAt: -1
          }
        }
      });
      setStats({
        totalProducts: productsResult.records?.length || 0,
        totalOrders: ordersResult.records?.length || 0,
        totalUsers: usersResult.records?.length || 0,
        todayRevenue: calculateTodayRevenue(ordersResult.records || []),
        recentOrders: recentOrdersResult.records || []
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      toast({
        title: '错误',
        description: '加载数据失败',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const calculateTodayRevenue = orders => {
    const today = new Date().toDateString();
    return orders.filter(order => new Date(order.createdAt).toDateString() === today).reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  };
  const getStatusColor = status => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'shipped':
        return 'text-blue-600 bg-blue-100';
      case 'paid':
        return 'text-yellow-600 bg-yellow-100';
      case 'pending':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-red-600 bg-red-100';
    }
  };
  const getStatusText = status => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'shipped':
        return '已发货';
      case 'paid':
        return '已支付';
      case 'pending':
        return '待支付';
      default:
        return '已取消';
    }
  };
  if (loading) {
    return <Layout activePage="dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">加载中...</div>
        </div>
      </Layout>;
  }
  return <Layout activePage="dashboard">
      <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">商品总数</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{stats.totalProducts}</div>
              <p className="text-xs text-blue-600">+12% 较上月</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">订单总数</CardTitle>
              <ShoppingBag className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{stats.totalOrders}</div>
              <p className="text-xs text-green-600">+8% 较上月</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">用户总数</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{stats.totalUsers}</div>
              <p className="text-xs text-purple-600">+15% 较上月</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日收入</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900">¥{stats.todayRevenue}</div>
              <p className="text-xs text-yellow-600">+5% 较昨日</p>
            </CardContent>
          </Card>
        </div>

        {/* 最近订单 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>最近订单</CardTitle>
              <CardDescription>最新的5笔订单</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentOrders.map(order => <div key={order._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{order.orderNo}</div>
                      <div className="text-sm text-gray-600">{order.userName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">¥{order.totalAmount}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </div>
                  </div>)}
                
                {stats.recentOrders.length === 0 && <div className="text-center py-8 text-gray-500">
                    暂无订单数据
                  </div>}
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快捷入口</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => window.$w.utils.navigateTo({
                pageId: 'products',
                params: {}
              })} className="h-20 flex-col space-y-2">
                  <Package className="h-6 w-6" />
                  <span>商品管理</span>
                </Button>
                
                <Button onClick={() => window.$w.utils.navigateTo({
                pageId: 'orders',
                params: {}
              })} className="h-20 flex-col space-y-2">
                  <ShoppingBag className="h-6 w-6" />
                  <span>订单管理</span>
                </Button>
                
                <Button onClick={() => window.$w.utils.navigateTo({
                pageId: 'users',
                params: {}
              })} className="h-20 flex-col space-y-2">
                  <Users className="h-6 w-6" />
                  <span>用户管理</span>
                </Button>
                
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Calendar className="h-6 w-6" />
                  <span>数据统计</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 底部统计 */}
        <Card>
          <CardHeader>
            <CardTitle>平台概览</CardTitle>
            <CardDescription>关键指标趋势</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-900">{stats.totalProducts}</div>
                <div className="text-sm text-blue-600">在线商品</div>
                <div className="flex items-center justify-center mt-2 text-green-600 text-sm">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>12% 增长</span>
                </div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-900">{stats.totalOrders}</div>
                <div className="text-sm text-green-600">累计订单</div>
                <div className="flex items-center justify-center mt-2 text-green-600 text-sm">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>8% 增长</span>
                </div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-900">{stats.totalUsers}</div>
                <div className="text-sm text-purple-600">注册用户</div>
                <div className="flex items-center justify-center mt-2 text-green-600 text-sm">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>15% 增长</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>;
};
export default Dashboard;