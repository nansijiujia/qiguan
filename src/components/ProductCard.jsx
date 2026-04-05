// @ts-ignore;
import React from 'react';
// @ts-ignore;
import { Edit2, Trash2, Eye } from 'lucide-react';
// @ts-ignore;
import { Button } from '@/components/ui';

const ProductCard = ({
  product,
  onEdit,
  onDelete,
  onView
}) => {
  return <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="relative">
        <img src={product.images?.[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop'} alt={product.name} className="w-full h-48 object-cover" />
        <div className="absolute top-2 right-2 flex space-x-1">
          <Button size="sm" variant="secondary" onClick={() => onView(product)} className="bg-white bg-opacity-90 hover:bg-opacity-100">
            <Eye className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onEdit(product)} className="bg-white bg-opacity-90 hover:bg-opacity-100">
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(product)} className="bg-white bg-opacity-90 hover:bg-opacity-100">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
        
        {product.status === 'soldout' && <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
            售罄
          </div>}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 truncate">{product.name}</h3>
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-yellow-600">¥{product.price}</span>
            {product.originalPrice && product.originalPrice > product.price && <span className="text-sm text-gray-500 line-through">¥{product.originalPrice}</span>}
          </div>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
            {product.category}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>库存: {product.stock}</span>
          <span className={`px-2 py-1 rounded-full text-xs ${product.status === 'active' ? 'bg-green-100 text-green-800' : product.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
            {product.status === 'active' ? '上架' : product.status === 'inactive' ? '下架' : '售罄'}
          </span>
        </div>
      </div>
    </div>;
};
export default ProductCard;