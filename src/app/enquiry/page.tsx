'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Send,
  Clock,
  Phone,
  Mail,
  Store,
} from 'lucide-react';
import { Product, ShopSettings } from '@/types';
import Navbar from '@/components/Navbar';
import CartCheckoutModal, { CartItem } from '@/components/CartCheckoutModal';

export default function EnquiryPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/store');
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        if (data.products) setProducts(data.products);
      } catch (err) {
        console.error('Failed to load store data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          productId: selectedProductId || undefined,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to submit enquiry.');
        setSubmitting(false);
        return;
      }

      setSubmittedRef(data.enquiry.enquiryNumber);
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontWeight: 600 }}>Loading enquiry service...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        settings={settings}
        cartCount={cart.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenEnquiry={() => {}}
      />

      <main style={{ flexGrow: 1, padding: '2.5rem 1rem 4rem' }}>
        <div className="container" style={{ maxWidth: 680 }}>
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
              <ArrowLeft size={16} /> Return to Storefront
            </Link>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              padding: '2.25rem',
              border: '1px solid var(--surface-border)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {submittedRef ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--primary-100)',
                    color: 'var(--primary-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <CheckCircle2 size={36} />
                </div>

                <span
                  style={{
                    display: 'inline-block',
                    background: 'var(--badge-green-bg)',
                    color: 'var(--badge-green-text)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    marginBottom: '0.5rem',
                  }}
                >
                  ENQUIRY LOGGED & QUEUED
                </span>

                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                  Reference {submittedRef}
                </h2>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', margin: '0.75rem auto 1.75rem', maxWidth: 460 }}>
                  Thank you, {customerName}! Your question has been delivered to our shopkeeper team. We have sent an automatic receipt to <strong>{customerEmail}</strong> and will get back to you during business hours.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <Link href="/" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                    Continue Browsing
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      background: 'var(--primary-100)',
                      color: 'var(--primary-800)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MessageSquare size={22} />
                  </div>
                  <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      Customer Enquiry & Special Requests
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      Questions about ingredients, batch availability, or holiday preorder arrangements.
                    </p>
                  </div>
                </div>

                {/* Important distinction banner per UX Rule */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1.75rem',
                    fontSize: '0.85rem',
                    color: '#1e40af',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
                    ℹ️ Important: Enquiry vs Confirmed Order
                  </strong>
                  Submitting this form sends an inquiry to the shop team but does <strong>not</strong> hold or reserve physical stock. If you need guaranteed items for pickup, please use the basket checkout on our storefront.
                </div>

                {error && (
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      background: '#fff1f0',
                      border: '1px solid #ffa39e',
                      borderRadius: 'var(--radius-md)',
                      color: '#cf1322',
                      fontSize: '0.875rem',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="page-enquiry-name">Your Full Name *</label>
                    <input
                      id="page-enquiry-name"
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Eleanor Vance"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="page-enquiry-email">Email Address *</label>
                      <input
                        id="page-enquiry-email"
                        type="email"
                        required
                        className="form-input"
                        placeholder="you@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="page-enquiry-phone">Phone Number *</label>
                      <input
                        id="page-enquiry-phone"
                        type="tel"
                        required
                        className="form-input"
                        placeholder="e.g. +1 555-0199"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="page-enquiry-product">Subject / Related Product (Optional)</label>
                    <select
                      id="page-enquiry-product"
                      className="form-select"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">General Shop Question / Custom Request</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.packaging})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="page-enquiry-message">Your Message *</label>
                    <textarea
                      id="page-enquiry-message"
                      required
                      rows={5}
                      className="form-textarea"
                      placeholder="Tell us what you would like to know (batch restock date, dietary queries, special orders)..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <Link href="/" className="btn btn-secondary">
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary"
                      style={{ padding: '0.75rem 1.6rem' }}
                      id="page-submit-enquiry-btn"
                    >
                      <Send size={16} />
                      <span>{submitting ? 'Sending...' : 'Submit Customer Enquiry'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
