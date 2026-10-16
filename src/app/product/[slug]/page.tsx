'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
  Truck,
  Store,
  Plus,
  Minus,
} from 'lucide-react';
import { Product, ShopSettings } from '@/types';
import EnquiryModal from '@/components/EnquiryModal';
import CartCheckoutModal, { CartItem } from '@/components/CartCheckoutModal';
import Navbar from '@/components/Navbar';

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  // Cart & Enquiry Modal states
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const storeRes = await fetch('/api/store');
        const storeData = await storeRes.json();
        if (storeData.settings) setSettings(storeData.settings);

        const found = storeData.products?.find(
          (p: Product) => p.slug === slug || p.id === slug
        );
        setProduct(found || null);
      } catch (err) {
        console.error('Failed to load product detail', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3200);
  };

  const handleAddToCart = () => {
    if (!product) return;
    const availableStock = Math.max(0, product.quantityOnHand - product.reservedQuantity);
    if (availableStock <= 0) {
      triggerToast(`Sorry, ${product.title} is sold out.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(availableStock, existing.quantity + quantity);
        triggerToast(`Updated ${product.title} in your basket (${newQty} total).`);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      triggerToast(`Added ${quantity}x ${product.title} to your basket.`);
      return [...prev, { product, quantity }];
    });
  };

  if (loading || !settings) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontWeight: 600 }}>Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-bg)', padding: '4rem 1rem' }}>
        <div className="container" style={{ maxWidth: 540, textAlign: 'center' }}>
          <div style={{ background: '#ffffff', padding: '2.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--surface-border)' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-900)' }}>
              Product Not Found
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0 1.5rem' }}>
              The product you are looking for may have been archived or seasonal stock has ended.
            </p>
            <Link href="/" className="btn btn-primary">
              <ArrowLeft size={16} /> Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const availableStock = Math.max(0, product.quantityOnHand - product.reservedQuantity);
  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= product.lowStockThreshold;
  const isPaused = !!settings.ordersPaused;

  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        settings={settings}
        cartCount={cartTotalItems}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenEnquiry={() => setIsEnquiryOpen(true)}
      />

      <main style={{ flexGrow: 1, padding: '2rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: 1040 }}>
          {/* Back link */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--primary-700)',
              }}
            >
              <ArrowLeft size={16} /> Back to All Products
            </Link>
          </div>

          {/* Product Detail Card Container */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--surface-border)',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            }}
          >
            {/* Left: Image */}
            <div style={{ position: 'relative', minHeight: 380, background: '#eeeae4' }}>
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
                priority
              />

              <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 2 }}>
                {isOutOfStock ? (
                  <span className="badge badge-out-of-stock" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                    <XCircle size={14} /> Sold Out
                  </span>
                ) : isLowStock ? (
                  <span className="badge badge-low-stock" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                    <AlertTriangle size={14} /> Low: Only {availableStock} Left
                  </span>
                ) : (
                  <span className="badge badge-in-stock" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                    <CheckCircle2 size={14} /> In Stock ({availableStock} Available)
                  </span>
                )}
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  left: '1rem',
                  background: 'rgba(13, 40, 24, 0.85)',
                  color: '#ffffff',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backdropFilter: 'blur(4px)',
                }}
              >
                Packaging: {product.packaging}
              </div>
            </div>

            {/* Right: Info & Actions */}
            <div style={{ padding: '2rem 2.25rem', display: 'flex', flexDirection: 'column' }}>
              <span className="product-category" style={{ fontSize: '0.8rem' }}>
                {product.category}
              </span>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary-900)', lineHeight: 1.2, margin: '0.35rem 0 0.75rem' }}>
                {product.title}
              </h1>

              {/* Price and Stock Audit Tag */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                  {settings.currencySymbol}{product.price.toFixed(2)}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 500 }}>
                  Per {product.packaging}
                </span>
              </div>

              {/* Inventory Accuracy Stamp */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  background: 'var(--surface-bg)',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--primary-800)',
                  fontWeight: 600,
                  border: '1px solid var(--surface-border)',
                  marginBottom: '1.5rem',
                }}
              >
                <Clock size={13} />
                <span>
                  Physical inventory verified: {new Date(product.lastVerifiedAt).toLocaleDateString()} (Accurate shelf sync)
                </span>
              </div>

              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {product.description}
              </p>

              {/* Specific metadata table */}
              <div style={{ background: 'var(--surface-bg)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--surface-border)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                {product.origin && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Origin / Farm:</span>
                    <strong style={{ color: 'var(--primary-900)' }}>{product.origin}</strong>
                  </div>
                )}
                {product.ingredients && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ingredients:</span>
                    <span style={{ maxWidth: '60%', textAlign: 'right', fontWeight: 600 }}>{product.ingredients}</span>
                  </div>
                )}
                {product.storageInfo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Storage:</span>
                    <span style={{ maxWidth: '60%', textAlign: 'right', color: 'var(--text-muted)' }}>{product.storageInfo}</span>
                  </div>
                )}
              </div>

              {/* Purchase or Pause Banner */}
              {isPaused ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#b45309', display: 'block', fontSize: '0.9rem' }}>
                    ⚡ Order Requests Paused Today
                  </strong>
                  <p style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '0.2rem' }}>
                    Our shop has temporarily paused new order intake to ensure current pickups are fulfilled on time. You can still submit an enquiry below to register interest!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--surface-border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-bg)' }}>
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={{ padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center' }}
                      title="Decrease"
                    >
                      <Minus size={15} />
                    </button>
                    <span style={{ padding: '0 0.85rem', fontWeight: 800, fontSize: '1rem' }}>
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                      disabled={quantity >= availableStock}
                      style={{ padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', opacity: quantity >= availableStock ? 0.4 : 1 }}
                      title="Increase"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className="btn btn-primary"
                    style={{ flexGrow: 1, padding: '0.85rem 1.5rem', fontSize: '1rem' }}
                    id="add-to-cart-detail-btn"
                  >
                    <ShoppingBag size={18} />
                    <span>
                      {isOutOfStock
                        ? 'Sold Out'
                        : `Add to Basket • ${settings.currencySymbol}${(product.price * quantity).toFixed(2)}`}
                    </span>
                  </button>
                </div>
              )}

              {/* Enquiry Button */}
              <button
                onClick={() => setIsEnquiryOpen(true)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.75rem' }}
                id="ask-question-detail-btn"
              >
                <MessageSquare size={16} />
                <span>Ask a Question About {product.title}</span>
              </button>

              {/* Small Footnote */}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '1rem' }}>
                💡 Enquiries do not hold stock. To reserve items, please add to basket and proceed to scheduled checkout.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <CartCheckoutModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        settings={settings}
        onUpdateQuantity={(id, q) => {
          if (q <= 0) setCart((c) => c.filter((x) => x.product.id !== id));
          else setCart((c) => c.map((x) => (x.product.id === id ? { ...x, quantity: q } : x)));
        }}
        onRemoveItem={(id) => setCart((c) => c.filter((x) => x.product.id !== id))}
        onClearCart={() => setCart([])}
      />

      <EnquiryModal
        isOpen={isEnquiryOpen}
        onClose={() => setIsEnquiryOpen(false)}
        product={product}
        settings={settings}
      />

      {toastMessage && (
        <div className="toast-bar">
          <ShoppingBag size={18} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
