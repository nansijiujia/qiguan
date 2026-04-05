// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Plus, Search, Filter, Download, Upload, Package } from 'lucide-react';
// @ts-ignore;
import { Button, Input, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, useToast } from '@/components/ui';

import Layout from '@/components/Layout';
import ProductCard from '@/components/ProductCard';
import ProductForm from '@/components/ProductForm';
const Products = props => {
  const {
    toast
  } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);
  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await window.$w.cloud.callDataSource({
        dataSourceName: 'products',
        methodName: 'wedaGetRecordsV2',
        params: {}
      });
      setProducts(result.records || []);
    } catch (error) {
      console.error('加载商品失败:', error);
      toast({
        title: '错误',
        description: '加载商品失败',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const loadCategories = async () => {
    try {
      const result = await window.$w.cloud.callDataSource({
        dataSourceName: 'categories',
        methodName: 'wedaGetRecordsV2',
        params: {}
      });
      setCategories(result.records || []);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };
  const handleCreateProduct = async productData => {
    try {
      await window.$w.cloud.callDataSource({
        dataSourceName: 'products',
        methodName: 'wedaCreateV2',
        params: productData
      });
      await loadProducts();
      setShowForm(false);
    } catch (error) {
      throw error;
    }
  };
  const handleUpdateProduct = async productData => {
    try {
      await window.$w.cloud.callDataSource({
        dataSourceName: 'products',
        methodName: 'wedaUpdateV2',
        params: {
          _id: editingProduct._id,
          ...productData
        }
      });
      await loadProducts();
      setShowForm(false);
      setEditingProduct(null);
    } catch (error) {
      throw error;
    }
  };
  const handleDeleteProduct = async product => {
    if (!confirm(`确定要删除商品"${product.name}"吗？`)) return;
    try {
      await window.$w.cloud.callDataSource({
        dataSourceName: 'products',
        methodName: 'wedaDeleteV2',
        params: {
          _id: product._id
        }
      });
      await loadProducts();
      toast({
        title: '成功',
        description: '商品删除成功'
      });
    } catch (error) {
      console.error('删除商品失败:', error);
      toast({
        title: '错误',
        description: '删除商品失败',
        variant: 'destructive'
      });
    }
  };
  const handleEditProduct = product => {
    setEditingProduct(product);
    setShowForm(true);
  };
  const handleViewProduct = product => {
    // 查看商品详情，可以跳转到详情页
    toast({
      title: '商品详情',
      description: `查看商品: ${product.name}`
    });
  };
  const filteredProducts = products.filter(product => {
    const productName = product.name || '';
    const productDescription = product.description || '';
    const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase()) || productDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  return <Layout activePage="products">
      <div className="space-y-6">
        {/* 页面标题和操作栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">商品管理</h1>
            <p className="text-gray-600">管理您的商品库存和价格</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              导入
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              添加商品
            </Button>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="搜索商品名称或描述..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <div className="flex space-x-4">
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">全部分类</option>
                  {categories.map(cat => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
                </select>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  筛选
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品列表 */}
        <Card>
          <CardHeader>
            <CardTitle>商品列表</CardTitle>
            <CardDescription>
              共 {filteredProducts.length} 个商品
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-600">加载中...</div>
              </div> : filteredProducts.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map(product => <ProductCard key={product._id} product={product} onEdit={handleEditProduct} onDelete={handleDeleteProduct} onView={handleViewProduct} />)}
              </div> : <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无商品</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || categoryFilter ? '没有找到匹配的商品' : '还没有添加任何商品'}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加第一个商品
                </Button>
              </div>}
          </CardContent>
        </Card>

        {/* 商品表单弹窗 */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? '编辑商品' : '添加商品'}
              </DialogTitle>
            </DialogHeader>
            <ProductForm product={editingProduct} onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct} onCancel={() => {
            setShowForm(false);
            setEditingProduct(null);
          }} />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>;
};
export default Products;