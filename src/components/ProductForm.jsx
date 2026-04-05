// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Button, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/ui';

import { useForm } from 'react-hook-form';
const ProductForm = ({
  product,
  onSubmit,
  onCancel
}) => {
  const {
    toast
  } = useToast();
  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price || '',
      originalPrice: product?.originalPrice || '',
      stock: product?.stock || 0,
      category: product?.category || '',
      status: product?.status || 'active'
    }
  });
  useEffect(() => {
    loadCategories();
  }, []);
  const loadCategories = async () => {
    try {
      const result = await window.$w.cloud.callDataSource({
        dataSourceName: 'categories',
        methodName: 'wedaGetRecordsV2',
        params: {
          filter: {
            status: 'active'
          }
        }
      });
      setCategories(result.records || []);
    } catch (error) {
      console.error('加载分类失败:', error);
      toast({
        title: '错误',
        description: '加载分类失败',
        variant: 'destructive'
      });
    }
  };
  const handleImageUpload = async file => {
    setUploading(true);
    try {
      const tcb = await window.$w.cloud.getCloudInstance();
      const timestamp = Date.now();
      const fileName = `products/${timestamp}_${file.name}`;
      const uploadResult = await tcb.uploadFile({
        cloudPath: fileName,
        filePath: file
      });
      const fileId = uploadResult.fileID;
      const tempUrlResult = await tcb.getTempFileURL({
        fileList: [fileId]
      });
      setUploading(false);
      return tempUrlResult.fileList[0].tempFileURL;
    } catch (error) {
      setUploading(false);
      console.error('图片上传失败:', error);
      toast({
        title: '错误',
        description: '图片上传失败',
        variant: 'destructive'
      });
      return null;
    }
  };
  const handleSubmit = async data => {
    try {
      await onSubmit(data);
      toast({
        title: '成功',
        description: product ? '商品更新成功' : '商品创建成功'
      });
    } catch (error) {
      console.error('提交失败:', error);
      toast({
        title: '错误',
        description: '操作失败',
        variant: 'destructive'
      });
    }
  };
  return <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="name" render={({
          field
        }) => <FormItem>
                <FormLabel>商品名称</FormLabel>
                <FormControl>
                  <Input placeholder="请输入商品名称" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="category" render={({
          field
        }) => <FormItem>
                <FormLabel>商品分类</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat._id} value={cat.name}>
                        {cat.name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="price" render={({
          field
        }) => <FormItem>
                <FormLabel>价格</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="originalPrice" render={({
          field
        }) => <FormItem>
                <FormLabel>原价</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="stock" render={({
          field
        }) => <FormItem>
                <FormLabel>库存</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="status" render={({
          field
        }) => <FormItem>
                <FormLabel>状态</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">上架</SelectItem>
                    <SelectItem value="inactive">下架</SelectItem>
                    <SelectItem value="soldout">售罄</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>} />
        </div>

        <FormField control={form.control} name="description" render={({
        field
      }) => <FormItem>
              <FormLabel>商品描述</FormLabel>
              <FormControl>
                <Textarea placeholder="请输入商品描述" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={uploading}>
            {uploading ? '上传中...' : product ? '更新' : '创建'}
          </Button>
        </div>
      </form>
    </Form>;
};
export default ProductForm;