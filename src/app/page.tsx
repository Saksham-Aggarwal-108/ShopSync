'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/ProductCard';
import CartCheckoutModal, { CartItem } from '@/components/CartCheckoutModal';
import EnquiryModal from '@/components/EnquiryModal';
import { Product, ShopSettings } from '@/types';
import { Search, Sparkles, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';

export default function StorefrontPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart & Modals
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [enquiryProduct, setEnquiryProduct] = useState<Product | null>(null);
  const [enquiryDate, setEnquiryDate] = useState<string | undefined>(undefined);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStore = async () => {
    try {
      const res = await fetch('/api/store');
      const data = await res.json();
      if (data.settings && data.products) {
        setSettings(data.settings);
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to load store data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const handleAddToCart = (product: Product) => {
    const availableStock = Math.max(0, product.quantityOnHand - product.reservedQuantity);
    if (availableStock <= 0) {
      triggerToast(`Sorry, ${product.title} is currently sold out.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          triggerToast(`Reached maximum available stock (${availableStock}) for ${product.title}.`);
          return prev;
        }
        triggerToast(`Updated ${product.title} quantity in basket.`);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      triggerToast(`Added ${product.title} to your basket.`);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    fetchStore(); // refresh stock numbers
  };

  const handleOpenProductEnquiry = (product: Product) => {
    setEnquiryProduct(product);
    setEnquiryDate(undefined);
    setIsEnquiryOpen(true);
  };

  const handleOpenGeneralEnquiry = () => {
    setEnquiryProduct(null);
    setEnquiryDate(undefined);
    setIsEnquiryOpen(true);
  };

  const handleOpenDateEnquiry = (date: string) => {
    setEnquiryProduct(null);
    setEnquiryDate(date);
    setIsEnquiryOpen(true);
  };

  // Categories
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    if (!p.isActive) return false;
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.packaging.toLowerCase().includes(searchQuery.toLowerCase());
    const availableStock = Math.max(0, p.quantityOnHand - p.reservedQuantity);
    const matchesStock = !inStockOnly || availableStock > 0;
    return matchesCat && matchesSearch && matchesStock;
  });

  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading || !settings) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid var(--primary-100)', borderTopColor: 'var(--primary-700)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600, color: 'var(--primary-900)' }}>Loading Greenwood Provisions...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <Navbar
        settings={settings}
        cartCount={cartTotalItems}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenEnquiry={handleOpenGeneralEnquiry}
      />

      {/* Notice Banner */}
      {settings.noticeBanner && (
        <aside
          style={{
            background: 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 100%)',
            color: '#ffffff',
            padding: '0.65rem 1rem',
            fontSize: '0.875rem',
            textAlign: 'center',
            fontWeight: 500,
            boxShadow: 'var(--shadow-sm)',
          }}
          aria-label="Shop announcement banner"
        >
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span>{settings.noticeBanner}</span>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main style={{ flexGrow: 1, padding: '2.5rem 0 4rem' }}>
        <div className="container">
          {/* Orders Paused Alert Banner */}
          {settings.ordersPaused && (
            <div
              style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                color: '#92400e',
                padding: '0.85rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '2rem',
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '0.2rem' }}>
                ⏸️ Order Intake Paused Today
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#78350f' }}>
                Our shop is currently focusing on packing and dispatching existing orders. <strong>Product browsing and questions/enquiries remain 100% active!</strong>
              </span>
            </div>
          )}

          {/* Hero Section */}
          <section style={{ marginBottom: '2.5rem', textAlign: 'center', maxWidth: 760, margin: '0 auto 2.5rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--primary-100)',
                color: 'var(--primary-800)',
                padding: '0.3rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700,
                marginBottom: '1rem',
              }}
            >
              <Sparkles size={14} /> LIVE STOCK & CAPACITY SYNCHRONIZED
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--primary-900)', lineHeight: 1.15, marginBottom: '0.75rem' }}>
              Your Neighbourhood Store. Online & In Control.
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Browse real-time shelf availability, clear packaging specifications, and reserved order slots. Order ahead to guarantee your items without phone or chat chaos.
            </p>
          </section>

          {/* Search & Category Filter Bar */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              border: '1px solid var(--surface-border)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Top row: search & stock toggle */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flexGrow: 1, minWidth: 260 }}>
                <Search
                  size={18}
                  style={{ position: 'absolute', left: '0.95rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}
                />
                <input
                  type="text"
                  placeholder="Search whole milk, country sourdough, wildflower honey..."
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  id="catalog-search-input"
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: 'var(--primary-700)' }}
                />
                <span>In-Stock Only</span>
              </label>
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    transition: 'all var(--transition-fast)',
                    background: selectedCategory === cat ? 'var(--primary-800)' : 'var(--surface-bg)',
                    color: selectedCategory === cat ? '#ffffff' : 'var(--text-main)',
                    border: selectedCategory === cat ? '1px solid var(--primary-800)' : '1px solid var(--surface-border)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1rem',
                background: '#ffffff',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--surface-border)',
              }}
            >
              <AlertCircle size={40} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.25rem', color: 'var(--primary-900)', marginBottom: '0.25rem' }}>
                No products match your criteria
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Try adjusting your search terms or unchecking the &quot;In-Stock Only&quot; filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setInStockOnly(false);
                }}
                className="btn btn-secondary"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={settings.currencySymbol}
                  isPaused={!!settings.ordersPaused}
                  onAddToCart={handleAddToCart}
                  onEnquire={handleOpenProductEnquiry}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Mobile Cart Bar (appears when items in cart) */}
      {cartTotalItems > 0 && !isCartOpen && (
        <aside
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary-900)',
            color: '#ffffff',
            padding: '0.75rem 1.4rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-float)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            zIndex: 40,
            cursor: 'pointer',
          }}
          onClick={() => setIsCartOpen(true)}
          id="floating-cart-bar"
          aria-label="Floating cart summary bar"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--accent-coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
              }}
            >
              {cartTotalItems}
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Basket ({settings.currencySymbol}
              {cart
                .reduce((sum, item) => sum + item.product.price * item.quantity, 0)
                .toFixed(2)}
              )
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#86efac', fontWeight: 700, fontSize: '0.85rem' }}>
            <span>Review & Schedule</span>
            <ArrowRight size={15} />
          </div>
        </aside>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-bar">
          <ShoppingBag size={18} />
          <span style={{ fontSize: '0.9rem' }}>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <CartCheckoutModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        settings={settings}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOpenEnquiryForDate={handleOpenDateEnquiry}
      />

      <EnquiryModal
        isOpen={isEnquiryOpen}
        onClose={() => setIsEnquiryOpen(false)}
        product={enquiryProduct}
        settings={settings}
        defaultDate={enquiryDate}
      />

      {/* Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid var(--surface-border)', padding: '3rem 0 2rem' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '0.5rem' }}>
                {settings.shopName}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                {settings.tagline}
              </p>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-light)' }}>
                📍 {settings.address}
              </p>
            </div>

            <div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '0.5rem' }}>
                Store Hours & Capacity
              </h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {settings.businessHours}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                ⚡ Daily Capacity Guard: Throttled at {settings.dailyCapacity} orders/day to ensure peak freshness and zero fulfilment delay.
              </p>
            </div>

            <div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '0.5rem' }}>
                Contact & Enquiries
              </h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                📞 Phone: {settings.phone}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                ✉️ Email: {settings.email}
              </p>
              <button
                onClick={handleOpenGeneralEnquiry}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                Send Us a Question
              </button>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--surface-border-subtle)',
              paddingTop: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.8rem',
              color: 'var(--text-light)',
            }}
          >
            <span>© {new Date().getFullYear()} {settings.shopName}. All rights reserved.</span>
            <span>ShopSync — Your Shop. Online. In Control.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
