'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Package,
  Store,
  Truck,
  AlertCircle,
  XCircle,
  Phone,
  MapPin,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { OrderItem, OrderStatus } from '@/types';

interface OrderTrackingData {
  orderNumber: string;
  customerName: string;
  fulfilmentType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  scheduledDate: string;
  scheduledSlot: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  customerNotes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [order, setOrder] = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTracking = async () => {
    try {
      const url = `/api/orders/${id}/track${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Unable to find order tracking details.');
        return;
      }

      setOrder(data);
      setError(null);
    } catch {
      setError('Network error while looking up order.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [id, token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTracking();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid var(--primary-100)', borderTopColor: 'var(--primary-700)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 600 }}>Locating Order #{id}...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-bg)', padding: '3rem 1rem' }}>
        <div className="container" style={{ maxWidth: 540, textAlign: 'center' }}>
          <div style={{ background: '#ffffff', borderRadius: 'var(--radius-xl)', padding: '2.5rem', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
            <AlertCircle size={48} style={{ color: '#cf1322', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--primary-900)' }}>
              Order Not Found
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {error || 'The tracking link may have expired or is missing authentication tokens.'}
            </p>
            <Link href="/" className="btn btn-primary">
              <ArrowLeft size={16} /> Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Determine Timeline Step Index (0: Pending, 1: Confirmed, 2: Processing, 3: Ready, 4: Fulfilled)
  let activeStep = 0;
  if (['Confirmed', 'CONFIRMED', 'RESCHEDULED'].includes(order.status)) activeStep = 1;
  if (order.status === 'Processing') activeStep = 2;
  if (['Ready', 'READY_FOR_PICKUP'].includes(order.status)) activeStep = 3;
  if (['Fulfilled', 'COMPLETED'].includes(order.status)) activeStep = 4;

  const isCancelled = ['Cancelled', 'CANCELLED', 'REJECTED'].includes(order.status);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)', padding: '2rem 1rem 4rem' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        {/* Top Back Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-700)' }}>
            <ArrowLeft size={16} /> Back to Greenwood Provisions
          </Link>

          <button
            onClick={handleRefresh}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            disabled={refreshing}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>

        {/* Order Card Container */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--surface-border)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: '1.75rem',
              background: 'linear-gradient(135deg, var(--primary-900) 0%, var(--primary-800) 100%)',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Live Order Tracker
                </span>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', marginTop: '0.15rem' }}>
                  {order.orderNumber}
                </h1>
                <p style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.2rem' }}>
                  Placed by {order.customerName} on {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {(order.status === 'Pending' || order.status === 'PENDING_REVIEW') && (
                  <span style={{ background: '#fef08a', color: '#854d0e', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem' }}>
                    ⏳ Pending Shopkeeper Confirmation
                  </span>
                )}
                {order.status === 'Confirmed' && (
                  <span style={{ background: '#bbf7d0', color: '#14532d', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem' }}>
                    ✅ Confirmed & Reserved
                  </span>
                )}
                {order.status === 'Processing' && (
                  <span style={{ background: '#fed7aa', color: '#9a3412', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem' }}>
                    📦 Packing Items
                  </span>
                )}
                {(order.status === 'Ready' || order.status === 'READY_FOR_PICKUP') && (
                  <span style={{ background: '#93c5fd', color: '#1e3a8a', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem' }}>
                    🛍️ Ready for Collection
                  </span>
                )}
                {(order.status === 'Fulfilled' || order.status === 'COMPLETED') && (
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem' }}>
                    🎉 Completed & Collected
                  </span>
                )}
                {isCancelled && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.85rem' }}>
                    ❌ Cancelled
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Timeline (if not cancelled) */}
          {!isCancelled && (
            <div style={{ padding: '2rem 1.75rem 1.5rem', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface-bg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {[
                  { title: 'Pending', sub: 'Soft-reserved' },
                  { title: 'Confirmed', sub: 'Hard-reserved' },
                  { title: 'Processing', sub: 'Packing' },
                  { title: order.fulfilmentType === 'delivery' ? 'Out for Delivery' : 'Ready', sub: 'Counter ready' },
                  { title: 'Fulfilled', sub: 'Completed' },
                ].map((step, idx) => {
                  const isDone = activeStep >= idx;
                  const isCurrent = activeStep === idx;

                  return (
                    <div key={step.title} style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: isDone ? 'var(--primary-700)' : '#e2e8f0',
                          color: isDone ? '#ffffff' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 0.5rem',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          border: isCurrent ? '3px solid var(--primary-100)' : 'none',
                        }}
                      >
                        {isDone ? <CheckCircle2 size={18} /> : idx + 1}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isDone ? 'var(--primary-900)' : 'var(--text-muted)' }}>
                        {step.title}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                        {step.sub}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancellation Notice */}
          {isCancelled && (
            <div style={{ padding: '1.5rem 1.75rem', background: '#fff1f0', borderBottom: '1px solid #ffa39e', display: 'flex', gap: '0.75rem' }}>
              <XCircle size={20} style={{ color: '#cf1322', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#cf1322', display: 'block', fontSize: '0.95rem' }}>
                  Order Not Fulfilled
                </strong>
                <p style={{ fontSize: '0.85rem', color: '#5c6861', marginTop: '0.2rem' }}>
                  Reason: {order.cancellationReason || 'Shop was unable to allocate stock for this slot.'} Any temporary reservation holds have been returned to available shelf inventory.
                </p>
              </div>
            </div>
          )}

          {/* Fulfilment & Schedule Details */}
          <div style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '1rem' }}>
              Fulfilment Schedule
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                background: 'var(--surface-bg)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--surface-border)',
                marginBottom: '1.75rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>
                  Fulfilment Type
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, textTransform: 'capitalize', color: 'var(--primary-900)', marginTop: '0.2rem' }}>
                  {order.fulfilmentType === 'delivery' ? <Truck size={16} /> : <Store size={16} />}
                  {order.fulfilmentType === 'delivery' ? 'Local Delivery' : 'In-Store Pickup'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>
                  Target Date
                </span>
                <span style={{ fontWeight: 700, color: 'var(--primary-900)', marginTop: '0.2rem', display: 'block' }}>
                  📅 {order.scheduledDate}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>
                  Time Window
                </span>
                <span style={{ fontWeight: 700, color: 'var(--primary-900)', marginTop: '0.2rem', display: 'block' }}>
                  ⏰ {order.scheduledSlot}
                </span>
              </div>

              {order.fulfilmentType === 'delivery' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>
                    Destination Address
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem', display: 'block' }}>
                    📍 {order.deliveryAddress}
                  </span>
                </div>
              )}
            </div>

            {/* Items Ordered */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '0.85rem' }}>
              Reserved Items & Packaging
            </h3>

            <div style={{ border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              {order.items.map((item, i) => (
                <div
                  key={item.productId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.15rem',
                    borderBottom: i === order.items.length - 1 ? 'none' : '1px solid var(--surface-border)',
                    background: '#ffffff',
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-900)' }}>
                      {item.productTitle}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Packaging: <strong>{item.packaging}</strong> • Qty: {item.quantity} × £{item.unitPrice.toFixed(2)}
                    </span>
                  </div>

                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-900)' }}>
                    £{item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}

              <div
                style={{
                  background: 'var(--surface-bg)',
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '2px solid var(--surface-border)',
                }}
              >
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Payment Terms
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary-800)' }}>
                    Pay on Collection / Handover (Cash, UPI or Card)
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', textAlign: 'right', color: 'var(--text-light)' }}>
                    Total Due
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                    £{order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Shop Contact & Help Box */}
            <div
              style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-100)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-900)' }}>
                  Questions or Need to Reschedule?
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Call Greenwood Provisions counter directly quoting order <strong>{order.orderNumber}</strong>.
                </p>
              </div>

              <a
                href="tel:+15553829401"
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                <Phone size={14} /> Call Counter
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
