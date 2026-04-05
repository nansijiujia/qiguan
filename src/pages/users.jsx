// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Search, Mail, Phone, Calendar, TrendingUp, ShoppingBag, DollarSign } from 'lucide-react';
// @ts-ignore;
import { Button, Input, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, useToast } from '@/components/ui';

import Layout from '@/components/Layout';
const Users = props => {
  const {
    toast
  } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    loadUsers();
  }, []);
  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await window.$w.cloud.callDataSource({
        dataSourceName: 'users',
        methodName: 'wedaGetRecordsV2',
        params: {
          sort: {
            createdAt: -1
          }
        }
      });
      setUsers(result.records || []);
    } catch (error) {
      console.error('加载用户失败:', error);
      toast({
        title: '错误',
        description: '加载用户失败',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const getUserLevel = totalSpent => {
    if (totalSpent >= 10000) return {
      label: 'VIP',
      color: 'bg-purple-100 text-purple-800'
    };
    if (totalSpent >= 5000) return {
      label: '高级',
      color: 'bg-blue-100 text-blue-800'
    };
    if (totalSpent >= 1000) return {
      label: '普通',
      color: 'bg-green-100 text-green-800'
    };
    return {
      label: '新用户',
      color: 'bg-gray-100 text-gray-800'
    };
  };
  const filteredUsers = users.filter(user => user.nickName.toLowerCase().includes(searchTerm.toLowerCase()) || user.phone && user.phone.includes(searchTerm));
  const stats = {
    totalUsers: users.length,
    totalSpent: users.reduce((sum, user) => sum + (user.totalSpent || 0), 0),
    totalOrders: users.reduce((sum, user) => sum + (user.totalOrders || 0), 0),
    avgOrderValue: users.length > 0 ? users.reduce((sum, user) => sum + (user.totalSpent || 0), 0) / users.length : 0
  };
  return <Layout activePage="users">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600">管理平台用户信息和消费记录</p>
        </div>

        {/* 用户统计 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{stats.totalUsers}</div>
              <p className="text-xs text-blue-600">+15% 较上月</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总消费额</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">¥{stats.totalSpent}</div>
              <p className="text-xs text-green-600">+8% 较上月</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总订单数</CardTitle>
              <ShoppingBag className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">{stats.totalOrders}</div>
              <p className="text-xs text-purple-600">+12% 较上月</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">客单价</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900">¥{Math.round(stats.avgOrderValue)}</div>
              <p className="text-xs text-yellow-600">+5% 较上月</p>
            </CardContent>
          </Card>
        </div>

        {/* 搜索 */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input placeholder="搜索用户昵称或手机号..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>
              共 {filteredUsers.length} 个用户
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-600">加载中...</div>
              </div> : filteredUsers.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map(user => {
              const level = getUserLevel(user.totalSpent || 0);
              return <div key={user._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-4">
                        <img src={user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'} alt={user.nickName} className="w-16 h-16 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">{user.nickName}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${level.color}`}>
                              {level.label}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            {user.phone && <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-2" />
                                <span>{user.phone}</span>
                              </div>}
                            
                            <div className="flex items-center">
                              <Mail className="w-3 h-3 mr-2" />
                              <span className="truncate">{user.openid}</span>
                            </div>
                            
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-2" />
                              <span>注册: {new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <div className="font-semibold text-blue-900">{user.totalOrders || 0}</div>
                              <div className="text-blue-600">订单数</div>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                              <div className="font-semibold text-green-900">¥{user.totalSpent || 0}</div>
                              <div className="text-green-600">消费额</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex space-x-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          查看详情
                        </Button>
                        <Button size="sm" className="flex-1">
                          发送消息
                        </Button>
                      </div>
                    </div>;
            })}
              </div> : <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无用户</h3>
                <p className="text-gray-500">
                  {searchTerm ? '没有找到匹配的用户' : '还没有用户注册'}
                </p>
              </div>}
          </CardContent>
        </Card>
      </div>
    </Layout>;
};
export default Users;