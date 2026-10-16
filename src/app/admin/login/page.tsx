'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, KeyRound, Store } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@greenwood.local');
  const [password, setPassword] = useState('shopsync2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please verify credentials.');
        setLoading(false);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('A network error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@greenwood.local');
    setPassword('shopsync2026');
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem 1rem',
        background: 'linear-gradient(180deg, #f4f3ef 0%, #e9e5dd 100%)',
      }}
    >
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Branding header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary-900) 0%, var(--primary-700) 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.85rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-900)' }}>
            ShopSync Owner Cockpit
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Greenwood Provisions • Private Management Portal
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--surface-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
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
                gap: '0.6rem',
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">
                Shopkeeper Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-light)',
                  }}
                />
                <input
                  id="admin-email"
                  type="email"
                  required
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="admin-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-light)',
                  }}
                />
                <input
                  id="admin-password"
                  type="password"
                  required
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
              id="admin-login-submit-btn"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Cockpit'}</span>
              <ArrowRight size={17} />
            </button>
          </form>

          {/* Demo Credentials Box (Development Only) */}
          {process.env.NODE_ENV !== 'production' && (
            <div
              style={{
                marginTop: '1.75rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--surface-border)',
                background: 'var(--surface-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-800)', textTransform: 'uppercase' }}>
                  <KeyRound size={13} /> Demo Credentials (Dev Mode)
                </span>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  style={{ fontSize: '0.75rem', color: 'var(--primary-700)', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Auto-fill
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>Email: <strong>admin@greenwood.local</strong></div>
                <div>Password: <strong>shopsync2026</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Return to storefront link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            <Store size={15} /> Return to Customer Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
