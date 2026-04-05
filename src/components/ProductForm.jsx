// @ts-ignore;
import React, { useState, useEffect } from 'react';
// @ts-ignore;
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Button, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/ui';
// @ts-ignore;
import { Plus, X, Upload, Loader2, Image as ImageIcon } from 'lucide-react';

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const form = useForm({
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price || 0,
      originalPrice: product?.originalPrice || 0,
      stock: product?.stock || 0,
      category: product?.category || '',
      images: product?.images || []
    }
  });

  // 加载分类数据
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await $w.cloud.callFunction({
          name: 'callDataSource',
          data: {
            dataSourceName: 'categories',
            methodName: 'get'
          }
        });
        setCategories(result.data || []);
      } catch (error) {
        console.error('加载分类失败:', error);
        toast({
          title: '加载失败',
          description: '无法加载商品分类',
          variant: 'destructive'
        });
      }
    };
    loadCategories();
  }, [toast]);

  // 图片上传到云存储
  const handleImageUpload = async event => {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      toast({
        title: '文件类型错误',
        description: '请选择图片文件',
        variant: 'destructive'
      });
      return;
    }

    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '文件过大',
        description: '图片大小不能超过5MB',
        variant: 'destructive'
      });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      // 获取云开发实例
      const tcb = await $w.cloud.getCloudInstance();

      // 生成唯一的文件名（脱敏处理：使用时间戳和随机数）
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const fileName = `products/${timestamp}_${random}_${file.name}`;

      // 上传到云存储
      const uploadTask = tcb.uploadFile({
        cloudPath: fileName,
        filePath: file
      });

      // 监听上传进度
      uploadTask.onProgressUpdate = progressEvent => {
        const progress = Math.round(progressEvent.loaded / progressEvent.total * 100);
        setUploadProgress(progress);
      };
      const result = await uploadTask;

      // 获取文件访问URL
      const fileList = await tcb.getTempFileURL({
        fileList: [result.fileID]
      });
      if (fileList.fileList && fileList.fileList[0]) {
        const imageUrl = fileList.fileList[0].tempFileURL;

        // 添加到图片列表
        const currentImages = form.getValues('images') || [];
        const newImages = [...currentImages, imageUrl];
        form.setValue('images', newImages);
        toast({
          title: '上传成功',
          description: '图片已上传到云存储'
        });
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      toast({
        title: '上传失败',
        description: '图片上传失败，请重试',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // 清空文件输入
      event.target.value = '';
    }
  };

  // 删除图片
  const handleRemoveImage = index => {
    const currentImages = form.getValues('images') || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    form.setValue('images', newImages);
  };

  // 提交表单
  const handleSubmit = async data => {
    try {
      await onSubmit(data);
    } catch (error) {
      toast({
        title: '操作失败',
        description: error.message || '操作失败，请重试',
        variant: 'destructive'
      });
    }
  };
  const currentImages = form.watch('images') || [];
  return <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField control={form.control} name="name" render={({
        field
      }) => <FormItem>
              <FormLabel>商品名称</FormLabel>
              <FormControl>
                <Input placeholder="请输入商品名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        <FormField control={form.control} name="description" render={({
        field
      }) => <FormItem>
              <FormLabel>商品描述</FormLabel>
              <FormControl>
                <Textarea placeholder="请输入商品描述" className="min-h-[100px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="price" render={({
          field
        }) => <FormItem>
                <FormLabel>价格</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="originalPrice" render={({
          field
        }) => <FormItem>
                <FormLabel>原价</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="stock" render={({
          field
        }) => <FormItem>
                <FormLabel>库存</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="category" render={({
          field
        }) => <FormItem>
                <FormLabel>分类</FormLabel>
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
        </div>

        {/* 图片上传区域 */}
        <FormField control={form.control} name="images" render={({
        field
      }) => <FormItem>
              <FormLabel>商品图片</FormLabel>
              <div className="space-y-4">
                {/* 上传按钮 */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="image-upload" disabled={uploading} />
                  <label htmlFor="image-upload" className="cursor-pointer block">
                    {uploading ? <div className="space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                        <div className="text-sm text-gray-600">上传中... {uploadProgress}%</div>
                      </div> : <div className="space-y-2">
                        <Upload className="h-8 w-8 mx-auto text-gray-400" />
                        <div className="text-sm text-gray-600">
                          点击上传图片或拖拽图片到这里
                        </div>
                        <div className="text-xs text-gray-500">支持 JPG、PNG 格式，最大 5MB</div>
                      </div>}
                  </label>
                </div>

                {/* 图片预览 */}
                {currentImages.length > 0 && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {currentImages.map((imageUrl, index) => <div key={index} className="relative group">
                        <img src={imageUrl} alt={`商品图片 ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                        <button type="button" onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>)}
                  </div>}
              </div>
              <FormMessage />
            </FormItem>} />

        <div className="flex gap-4 justify-end pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {product ? '更新商品' : '添加商品'}
          </Button>
        </div>
      </form>
    </Form>;
};
export default ProductForm;