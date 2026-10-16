'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, MessageSquare, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  currency: string;
  isPaused?: boolean;
  onAddToCart: (product: Product) => void;
  onEnquire: (product: Product) => void;
}

export default function ProductCard({
  product,
  currency,
  isPaused,
  onAddToCart,
  onEnquire,
}: ProductCardProps) {
  const availableStock = Math.max(0, product.quantityOnHand - product.reservedQuantity);
  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= product.lowStockThreshold;

  return (
    <article className="product-card" id={`product-card-${product.id}`}>
      {/* Product Image and Badges */}
      <Link href={`/product/${product.slug}`} className="product-image-wrap" style={{ display: 'block' }}>
        <Image
          src={product.imageUrl}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="product-image"
          priority={false}
        />

        {/* Stock Status Badge */}
        <div className="product-badge-float">
          {isOutOfStock ? (
            <span className="badge badge-out-of-stock">
              <XCircle size={12} /> Sold Out
            </span>
          ) : isLowStock ? (
            <span className="badge badge-low-stock">
              <AlertTriangle size={12} /> Low: Only {availableStock} Left
            </span>
          ) : (
            <span className="badge badge-in-stock">
              <CheckCircle size={12} /> In Stock ({availableStock})
            </span>
          )}
        </div>

        {/* Packaging detail overlay */}
        <div className="packaging-badge-float">
          {product.packaging}
        </div>
      </Link>

      {/* Product Info */}
      <div className="product-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="product-category">{product.category}</span>
          <span style={{ fontSize: '0.675rem', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <Clock size={10} /> Verified
          </span>
        </div>

        <Link href={`/product/${product.slug}`}>
          <h3 className="product-title" style={{ transition: 'color 0.2s ease' }}>
            {product.title}
          </h3>
        </Link>

        <p className="product-desc">{product.description}</p>

        {/* Footer: Price and Actions */}
        <div className="product-footer">
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>
              Price
            </span>
            <span className="product-price">
              {currency}{product.price.toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => onEnquire(product)}
              className="btn btn-secondary"
              style={{ padding: '0.55rem', borderRadius: 'var(--radius-md)' }}
              title="Ask a question about this product"
              aria-label={`Ask a question about ${product.title}`}
            >
              <MessageSquare size={16} />
            </button>

            {isPaused ? (
              <button
                onClick={() => onEnquire(product)}
                className="btn btn-secondary"
                style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                title="Order intake is paused today — click to enquire"
              >
                Enquire
              </button>
            ) : (
              <button
                onClick={() => onAddToCart(product)}
                disabled={isOutOfStock}
                className="btn btn-primary"
                style={{ padding: '0.55rem 0.95rem' }}
                id={`add-btn-${product.id}`}
              >
                <ShoppingBag size={16} />
                <span>{isOutOfStock ? 'Sold Out' : 'Add'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
