'use client';

import React, { useState } from 'react';
import { X, MessageSquare, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { Product, ShopSettings } from '@/types';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  settings: ShopSettings;
  defaultDate?: string;
}

export default function EnquiryModal({
  isOpen,
  onClose,
  product,
  settings,
  defaultDate,
}: EnquiryModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState(() => {
    if (defaultDate) {
      return `Hi Greenwood team, I noticed daily capacity is full for ${defaultDate}. Can I check if you have any flexibility for an extra order on that day?`;
    }
    if (product) {
      return `Hi Greenwood team, I'd like to ask about availability or restock timing for ${product.title}.`;
    }
    return '';
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{ enquiryNumber: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          productId: product?.id,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to submit enquiry.');
        setSubmitting(false);
        return;
      }

      setSubmittedData({ enquiryNumber: data.enquiry.enquiryNumber });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'var(--primary-100)',
                color: 'var(--primary-800)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                {product ? `Ask about ${product.title}` : 'Direct Shop Enquiry'}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {product ? `Packaging: ${product.packaging}` : settings.shopName}
              </span>
            </div>
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

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {submittedData ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <CheckCircle2 size={32} />
              </div>

              <span
                style={{
                  display: 'inline-block',
                  background: 'var(--badge-green-bg)',
                  color: 'var(--badge-green-text)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  marginBottom: '0.4rem',
                }}
              >
                ENQUIRY LOGGED
              </span>

              <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                Ref: {submittedData.enquiryNumber}
              </h4>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.75rem auto 1.5rem', maxWidth: 420 }}>
                Thank you! We have received your message. An automatic confirmation email has been logged to your inbox, and our shop manager will reply during store hours.
              </p>

              <button
                onClick={onClose}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {errorMessage && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#fff1f0',
                    border: '1px solid #ffa39e',
                    borderRadius: 'var(--radius-md)',
                    color: '#cf1322',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="enquiry-name">Your Full Name *</label>
                <input
                  id="enquiry-name"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Richard Hendricks"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="enquiry-email">Email Address *</label>
                  <input
                    id="enquiry-email"
                    type="email"
                    required
                    className="form-input"
                    placeholder="you@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="enquiry-phone">Phone Number *</label>
                  <input
                    id="enquiry-phone"
                    type="tel"
                    required
                    className="form-input"
                    placeholder="e.g. +1 555-0182"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="enquiry-message">Your Message or Enquiry *</label>
                <textarea
                  id="enquiry-message"
                  required
                  rows={4}
                  className="form-textarea"
                  placeholder="Ask about ingredients, shelf life, weekend reservations, or upcoming batch arrivals..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div style={{ background: 'var(--surface-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                💡 <strong>Shop Notice</strong>: Enquiries do not automatically reserve stock. To place an immediate hold on remaining items, please use the basket checkout.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '0.7rem 1.4rem' }}
                  id="submit-enquiry-btn"
                >
                  <Send size={15} />
                  <span>{submitting ? 'Submitting...' : 'Send Enquiry'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
