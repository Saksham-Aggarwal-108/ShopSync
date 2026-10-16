'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, MessageSquare, ShieldCheck, Clock, MapPin, Store } from 'lucide-react';
import { ShopSettings } from '@/types';

interface NavbarProps {
  settings: ShopSettings;
  cartCount: number;
  onOpenCart: () => void;
  onOpenEnquiry: () => void;
}

export default function Navbar({ settings, cartCount, onOpenCart, onOpenEnquiry }: NavbarProps) {
  return (
    <header className="glass-header">
      {/* Top info mini-bar */}
      <div style={{ background: 'var(--primary-900)', color: '#ffffff', fontSize: '0.8rem', padding: '0.35rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.9 }}>
              <Clock size={13} /> {settings.businessHours}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.9 }}>
              <MapPin size={13} /> {settings.address}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: !settings.isStoreOpen
                  ? '#fca5a5'
                  : settings.ordersPaused
                  ? '#fde68a'
                  : '#86efac',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: !settings.isStoreOpen
                    ? '#f87171'
                    : settings.ordersPaused
                    ? '#f59e0b'
                    : '#4ade80',
                  boxShadow: settings.isStoreOpen && !settings.ordersPaused ? '0 0 8px #4ade80' : 'none',
                }}
              />
              {!settings.isStoreOpen
                ? 'STORE CLOSED'
                : settings.ordersPaused
                ? 'ORDERS PAUSED • BROWSING & ENQUIRIES OPEN'
                : 'ACCEPTING ORDERS TODAY'}
            </span>
            <Link
              href="/admin"
              style={{
                color: '#ffffff',
                opacity: 0.85,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.15rem 0.5rem',
                background: 'rgba(255, 255, 255, 0.12)',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={13} /> Owner Cockpit
            </Link>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="container" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary-800) 0%, var(--primary-600) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Store size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                ShopSync
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--primary-100)', color: 'var(--primary-800)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                LOCAL
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {settings.shopName}
            </div>
          </div>
        </Link>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onOpenEnquiry}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem' }}
            id="enquiry-nav-btn"
          >
            <MessageSquare size={16} />
            <span style={{ display: 'inline' }}>Ask / Enquire</span>
          </button>

          <button
            onClick={onOpenCart}
            className="btn btn-primary"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.15rem' }}
            id="cart-nav-btn"
          >
            <ShoppingBag size={18} />
            <span>Basket</span>
            {cartCount > 0 && (
              <span
                style={{
                  background: 'var(--accent-coral)',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  marginLeft: '0.2rem',
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
