// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Plus, Search, Filter, Download, Upload, Package, Edit, Trash2 } from 'lucide-react';
// @ts-ignore;
import { Button, Input, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogHeader, DialogTitle, useToast, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';

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
      const result = await $w.cloud.callFunction({
        name: 'callDataSource',
        data: {
          dataSourceName: 'products',
          methodName: 'get'
        }
      });

      // 脱敏处理：移除敏感的内部字段
      const sanitizedProducts = (result.data || []).map(product => ({
        _id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        stock: product.stock,
        category: product.category,
        images: product.images || [],
        status: product.status,
        createdAt: product.createdAt
      }));
      setProducts(sanitizedProducts);
    } catch (error) {
      console.error('加载商品失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载商品列表',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const loadCategories = async () => {
    try {
      const result = await $w.cloud.callFunction({
        name: 'callDataSource',
        data: {
          dataSourceName: 'categories',
          methodName: 'get'
        }
      });

      // 脱敏处理
      const sanitizedCategories = (result.data || []).map(cat => ({
        _id: cat._id,
        name: cat.name
      }));
      setCategories(sanitizedCategories);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };
  const handleAddProduct = async productData => {
    try {
      // 脱敏处理：移除敏感信息，只保留必要字段
      const sanitizedData = {
        name: productData.name,
        description: productData.description,
        price: productData.price,
        originalPrice: productData.originalPrice || null,
        stock: productData.stock,
        category: productData.category,
        images: productData.images || [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const result = await $w.cloud.callFunction({
        name: 'callDataSource',
        data: {
          dataSourceName: 'products',
          methodName: 'add',
          params: sanitizedData
        }
      });
      toast({
        title: '添加成功',
        description: '商品已成功添加'
      });
      setShowForm(false);
      loadProducts();
    } catch (error) {
      toast({
        title: '添加失败',
        description: error.message || '添加商品失败',
        variant: 'destructive'
      });
    }
  };
  const handleUpdateProduct = async productData => {
    try {
      // 脱敏处理：移除敏感信息，只保留必要字段
      const sanitizedData = {
        _id: editingProduct._id,
        name: productData.name,
        description: productData.description,
        price: productData.price,
        originalPrice: productData.originalPrice || null,
        stock: productData.stock,
        category: productData.category,
        images: productData.images || [],
        updatedAt: new Date().toISOString()
      };
      const result = await $w.cloud.callFunction({
        name: 'callDataSource',
        data: {
          dataSourceName: 'products',
          methodName: 'update',
          params: sanitizedData
        }
      });
      toast({
        title: '更新成功',
        description: '商品信息已更新'
      });
      setShowForm(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      toast({
        title: '更新失败',
        description: error.message || '更新商品失败',
        variant: 'destructive'
      });
    }
  };
  const handleDeleteProduct = async productId => {
    try {
      const result = await $w.cloud.callFunction({
        name: 'callDataSource',
        data: {
          dataSourceName: 'products',
          methodName: 'delete',
          params: {
            _id: productId
          }
        }
      });
      toast({
        title: '删除成功',
        description: '商品已删除'
      });
      loadProducts();
    } catch (error) {
      toast({
        title: '删除失败',
        description: error.message || '删除商品失败',
        variant: 'destructive'
      });
    }
  };
  const filteredProducts = products.filter(product => {
    const productName = product.name || '';
    const productDescription = product.description || '';
    const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase()) || productDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || !categoryFilter || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  return <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">商品管理</h1>
            <p className="text-gray-600 mt-2">管理您的商品库存和价格</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            添加商品
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input placeholder="搜索商品名称或描述..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map(cat => <SelectItem key={cat._id} value={cat.name}>
                      {cat.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品列表 */}
        {loading ? <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => <ProductCard key={product._id} product={product} onEdit={() => {
          setEditingProduct(product);
          setShowForm(true);
        }} onDelete={() => handleDeleteProduct(product._id)} />)}
            
            {filteredProducts.length === 0 && <div className="col-span-full text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">暂无商品</h3>
                <p className="text-gray-600 mt-2">
                  {searchTerm || categoryFilter ? '没有找到匹配的商品' : '开始添加您的第一个商品'}
                </p>
                {!searchTerm && !categoryFilter && <Button onClick={() => setShowForm(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    添加商品
                  </Button>}
              </div>}
          </div>}

        {/* 添加/编辑商品弹窗 */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? '编辑商品' : '添加商品'}
              </DialogTitle>
            </DialogHeader>
            <ProductForm product={editingProduct} onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} onCancel={() => {
            setShowForm(false);
            setEditingProduct(null);
          }} />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>;
};
export default Products;