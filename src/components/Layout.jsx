// @ts-ignore;
import React, { useState } from 'react';
// @ts-ignore;
import { Menu, X, ShoppingBag, Users, Package, BarChart3 } from 'lucide-react';

const Layout = ({
  children,
  activePage
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuItems = [{
    id: 'dashboard',
    label: '仪表盘',
    icon: BarChart3,
    path: 'dashboard'
  }, {
    id: 'products',
    label: '商品管理',
    icon: Package,
    path: 'products'
  }, {
    id: 'orders',
    label: '订单管理',
    icon: ShoppingBag,
    path: 'orders'
  }, {
    id: 'users',
    label: '用户管理',
    icon: Users,
    path: 'users'
  }];
  return <div className="min-h-screen bg-gray-50">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* 侧边栏 */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 bg-gray-800">
          <div className="flex items-center">
            <ShoppingBag className="w-8 h-8 text-yellow-400" />
            <span className="ml-2 text-xl font-bold text-white font-playfair">电商后台</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-6 h-6 text-gray-300" />
          </button>
        </div>
        
        <nav className="mt-8">
          {menuItems.map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => {
            window.$w.utils.navigateTo({
              pageId: item.path,
              params: {}
            });
            setSidebarOpen(false);
          }} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activePage === item.id ? 'bg-yellow-400 text-gray-900' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                <Icon className="w-5 h-5" />
                <span className="ml-3 font-medium">{item.label}</span>
              </button>;
        })}
        </nav>
      </div>

      {/* 主内容区域 */}
      <div className="lg:ml-64">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                欢迎回来，管理员
              </div>
              <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="font-bold text-gray-900">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>;
};
export default Layout;