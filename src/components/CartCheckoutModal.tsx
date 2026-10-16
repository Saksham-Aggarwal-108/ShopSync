'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Truck,
  Store,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Product, ShopSettings, Order } from '@/types';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  settings: ShopSettings;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOpenEnquiryForDate?: (date: string) => void;
}

export default function CartCheckoutModal({
  isOpen,
  onClose,
  cart,
  settings,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOpenEnquiryForDate,
}: CartCheckoutModalProps) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'confirmation'>('cart');
  const [fulfilmentType, setFulfilmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [scheduledSlot, setScheduledSlot] = useState(() => settings.timeSlots[0] || 'Morning');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Capacity checking state
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [capacityStatus, setCapacityStatus] = useState<{
    dailyCapacity: number;
    activeOrdersCount: number;
    remainingCapacity: number;
    isFull: boolean;
  } | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Fetch capacity status when target date changes
  useEffect(() => {
    if (!isOpen || !scheduledDate) return;
    let isMounted = true;
    setCapacityLoading(true);

    fetch(`/api/capacity?date=${scheduledDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setCapacityStatus(data);
          setCapacityLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setCapacityLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [scheduledDate, isOpen]);

  if (!isOpen) return null;

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const payload = {
        customerName,
        customerEmail,
        customerPhone,
        fulfilmentType,
        deliveryAddress: fulfilmentType === 'delivery' ? deliveryAddress : undefined,
        scheduledDate,
        scheduledSlot,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        customerNotes,
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to place order. Please review your cart.');
        setSubmitting(false);
        return;
      }

      setPlacedOrder(data.order);
      onClearCart();
      setStep('confirmation');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'A network error occurred. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: step === 'confirmation' ? 520 : 640 }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--surface-border)',
            background: 'var(--surface-bg)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-900)' }}>
              {step === 'cart' && 'Your Basket'}
              {step === 'checkout' && 'Schedule & Checkout'}
              {step === 'confirmation' && 'Order Received'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {step === 'cart' && `${cart.length} item${cart.length === 1 ? '' : 's'} selected`}
              {step === 'checkout' && 'Select fulfilment time & verify details'}
              {step === 'confirmation' && 'Reserved & awaiting shop confirmation'}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.4rem',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* STEP 1: CART OVERVIEW */}
          {step === 'cart' && (
            <div>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <Store size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--primary-900)' }}>
                    Your basket is empty
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Browse our fresh seasonal produce and pantry goods to get started.
                  </p>
                  <button
                    onClick={onClose}
                    className="btn btn-primary"
                    style={{ marginTop: '1.25rem' }}
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {cart.map((item) => {
                      const availableStock = Math.max(
                        0,
                        item.product.quantityOnHand - item.product.reservedQuantity
                      );
                      const isAtMax = item.quantity >= availableStock;

                      return (
                        <div
                          key={item.product.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--surface-border)',
                            background: '#ffffff',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ flexGrow: 1 }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-900)' }}>
                              {item.product.title}
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              <span>{item.product.packaging}</span> •{' '}
                              <span style={{ fontWeight: 600 }}>
                                {settings.currencySymbol}{item.product.price.toFixed(2)} each
                              </span>
                            </div>
                            {isAtMax && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--badge-amber-text)', fontWeight: 600, display: 'block', marginTop: '0.2rem' }}>
                                (Max available stock: {availableStock})
                              </span>
                            )}
                          </div>

                          {/* Quantity Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid var(--surface-border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--surface-bg)',
                              }}
                            >
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center' }}
                                title="Decrease"
                              >
                                <Minus size={13} />
                              </button>
                              <span style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                disabled={isAtMax}
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  opacity: isAtMax ? 0.4 : 1,
                                }}
                                title="Increase"
                              >
                                <Plus size={13} />
                              </button>
                            </div>

                            <span
                              style={{
                                minWidth: '60px',
                                textAlign: 'right',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: 'var(--primary-900)',
                              }}
                            >
                              {settings.currencySymbol}{(item.product.price * item.quantity).toFixed(2)}
                            </span>

                            <button
                              onClick={() => onRemoveItem(item.product.id)}
                              style={{ color: '#cf1322', padding: '0.35rem' }}
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cart Total & Next Button */}
                  <div
                    style={{
                      marginTop: '1.5rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--surface-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'block' }}>
                        Subtotal
                      </span>
                      <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                        {settings.currencySymbol}{totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => setStep('checkout')}
                      className="btn btn-primary"
                      style={{ padding: '0.75rem 1.4rem' }}
                      id="proceed-checkout-btn"
                    >
                      <span>Proceed to Schedule</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SCHEDULE & CHECKOUT FORM */}
          {step === 'checkout' && (
            <form onSubmit={handleCheckoutSubmit}>
              {/* Error banner */}
              {errorMessage && (
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
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                  <div>
                    <strong style={{ display: 'block' }}>Checkout Issue</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Fulfilment Type Switcher */}
              <div className="form-group">
                <label className="form-label">Fulfilment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setFulfilmentType('pickup')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: fulfilmentType === 'pickup' ? '2px solid var(--primary-700)' : '1px solid var(--surface-border)',
                      background: fulfilmentType === 'pickup' ? 'var(--primary-50)' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontWeight: 600,
                      color: 'var(--primary-900)',
                    }}
                  >
                    <Store size={18} style={{ color: 'var(--primary-700)' }} />
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '0.9rem' }}>In-Store Pickup</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Free • Ready at shop counter
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfilmentType('delivery')}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: fulfilmentType === 'delivery' ? '2px solid var(--primary-700)' : '1px solid var(--surface-border)',
                      background: fulfilmentType === 'delivery' ? 'var(--primary-50)' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontWeight: 600,
                      color: 'var(--primary-900)',
                    }}
                  >
                    <Truck size={18} style={{ color: 'var(--primary-700)' }} />
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '0.9rem' }}>Local Delivery</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Within local neighbourhood
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Delivery Address Field (if delivery chosen) */}
              {fulfilmentType === 'delivery' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="delivery-address">
                    Delivery Address & Postcode *
                  </label>
                  <input
                    id="delivery-address"
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. 24 Meadow Lane, Apartment 4B"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>
              )}

              {/* Date & Time Slot with Capacity Guard */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="scheduled-date">
                    <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Scheduled Date *
                  </label>
                  <input
                    id="scheduled-date"
                    type="date"
                    required
                    className="form-input"
                    value={scheduledDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="scheduled-slot">
                    <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Time Window *
                  </label>
                  <select
                    id="scheduled-slot"
                    className="form-select"
                    value={scheduledSlot}
                    onChange={(e) => setScheduledSlot(e.target.value)}
                  >
                    {settings.timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Real-Time Daily Capacity Indicator */}
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: capacityStatus?.isFull ? '#fff1f0' : 'var(--primary-50)',
                  border: capacityStatus?.isFull ? '1px solid #ffa39e' : '1px solid var(--primary-100)',
                  fontSize: '0.85rem',
                }}
              >
                {capacityLoading ? (
                  <span style={{ color: 'var(--text-muted)' }}>Checking shop fulfilment capacity for date...</span>
                ) : capacityStatus?.isFull ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cf1322', fontWeight: 700 }}>
                      <ShieldAlert size={16} />
                      Daily Fulfilment Limit Reached for {scheduledDate}
                    </div>
                    <p style={{ marginTop: '0.25rem', color: '#5c6861', fontSize: '0.8rem' }}>
                      Our shop restricts daily volume to {capacityStatus.dailyCapacity} orders to guarantee quality and timely fulfillment. Please pick another date or submit an enquiry for special arrangements.
                    </p>
                    {onOpenEnquiryForDate && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenEnquiryForDate(scheduledDate);
                        }}
                        className="btn btn-outline"
                        style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Enquire for this date
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-800)', fontWeight: 600 }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--primary-600)' }} />
                    <span>
                      {capacityStatus?.remainingCapacity || 0} slots remaining for {scheduledDate} ({capacityStatus?.activeOrdersCount || 0} of {capacityStatus?.dailyCapacity || settings.dailyCapacity} booked)
                    </span>
                  </div>
                )}
              </div>

              {/* Customer Contact Details */}
              <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--primary-900)' }}>
                  Contact Information (No account required)
                </h4>

                <div className="form-group">
                  <label className="form-label" htmlFor="customer-name">Full Name *</label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Jessica Miller"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="customer-email">Email Address *</label>
                    <input
                      id="customer-email"
                      type="email"
                      required
                      className="form-input"
                      placeholder="you@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="customer-phone">Phone Number *</label>
                    <input
                      id="customer-phone"
                      type="tel"
                      required
                      className="form-input"
                      placeholder="e.g. +1 555-0192"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="customer-notes">Order Notes / Dietary Preferences (Optional)</label>
                  <input
                    id="customer-notes"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Leave on porch, packing in paper bags"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--surface-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Back to Basket
                </button>

                <button
                  type="submit"
                  disabled={submitting || capacityStatus?.isFull || settings.ordersPaused}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 1.4rem' }}
                  id="submit-order-btn"
                >
                  {settings.ordersPaused
                    ? 'Order Intake Paused'
                    : submitting
                    ? 'Reserving Stock...'
                    : `Confirm Order (${settings.currencySymbol}${totalAmount.toFixed(2)})`}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: ORDER CONFIRMATION & LIVE TRACKING LINK */}
          {step === 'confirmation' && placedOrder && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
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
                  background: 'var(--badge-amber-bg)',
                  color: 'var(--badge-amber-text)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  marginBottom: '0.5rem',
                }}
              >
                STATUS: PENDING SHOP CONFIRMATION
              </span>

              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                Order #{placedOrder.orderNumber}
              </h3>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: 440, margin: '0.5rem auto 1.5rem' }}>
                Thank you, {placedOrder.customerName}! Your items are soft-reserved. Our shop team will review inventory and confirm your pickup/delivery window shortly.
              </p>

              {/* Order summary box */}
              <div
                style={{
                  background: 'var(--surface-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  marginBottom: '1.5rem',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fulfilment Mode:</span>
                  <strong style={{ textTransform: 'capitalize' }}>{placedOrder.fulfilmentType}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Scheduled Date:</span>
                  <strong>{placedOrder.scheduledDate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Time Slot:</span>
                  <strong>{placedOrder.scheduledSlot}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--surface-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span>Total Due (Pay on Pickup/Delivery):</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--primary-900)' }}>
                    {settings.currencySymbol}{placedOrder.totalAmount.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link
                  href={`/order/${placedOrder.id}?token=${placedOrder.trackingToken}`}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem' }}
                  id="view-live-tracking-btn"
                >
                  Track Order Status Live
                </Link>

                <button
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  Done / Back to Shop
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
