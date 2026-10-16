'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Package,
  Plus,
  Minus,
  RefreshCw,
  MessageSquare,
  Settings,
  ShieldCheck,
  TrendingUp,
  Truck,
  Eye,
  Check,
  Calendar,
  Layers,
  Inbox,
  Power,
  LogOut,
  ExternalLink,
  ChevronRight,
  Flame,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import {
  Product,
  Order,
  Enquiry,
  ShopSettings,
  NotificationLog,
  OrderStatus,
  EnquiryStatus,
} from '@/types';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'inventory' | 'enquiries' | 'settings'>('overview');
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [orderFilter, setOrderFilter] = useState<string>('ALL');
  const [enquiryFilter, setEnquiryFilter] = useState<string>('ALL');

  // Modals
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('Item out of stock or batch damaged');

  const [reschedulingOrder, setReschedulingOrder] = useState<Order | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');

  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);

  const [adminToast, setAdminToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => {
      setAdminToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  // Auth check & data load
  useEffect(() => {
    async function verifyAndLoad() {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/admin/login');
          return;
        }
        setAuthChecked(true);

        const [storeRes, ordersRes, enqRes, logsRes] = await Promise.all([
          fetch('/api/store'),
          fetch('/api/orders'),
          fetch('/api/enquiries'),
          fetch('/api/notifications'),
        ]);

        const storeData = await storeRes.json();
        const ordersData = await ordersRes.json();
        const enqData = await enqRes.json();
        const logsData = await logsRes.json();

        if (storeData.settings) setSettings(storeData.settings);
        if (storeData.products) setProducts(storeData.products);
        if (Array.isArray(ordersData)) setOrders(ordersData);
        if (Array.isArray(enqData)) setEnquiries(enqData);
        if (Array.isArray(logsData)) setLogs(logsData);
      } catch (err) {
        console.error('Failed to load admin', err);
      } finally {
        setLoading(false);
      }
    }
    verifyAndLoad();
  }, [router]);

  const loadAllData = async () => {
    try {
      const [storeRes, ordersRes, enqRes, logsRes] = await Promise.all([
        fetch('/api/store'),
        fetch('/api/orders'),
        fetch('/api/enquiries'),
        fetch('/api/notifications'),
      ]);

      const storeData = await storeRes.json();
      const ordersData = await ordersRes.json();
      const enqData = await enqRes.json();
      const logsData = await logsRes.json();

      if (storeData.settings) setSettings(storeData.settings);
      if (storeData.products) setProducts(storeData.products);
      if (Array.isArray(ordersData)) setOrders(ordersData);
      if (Array.isArray(enqData)) setEnquiries(enqData);
      if (Array.isArray(logsData)) setLogs(logsData);
    } catch (err) {
      console.error('Refresh error', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  // Toggle Pause Orders
  const togglePauseOrders = async () => {
    if (!settings) return;
    const nextPaused = !settings.ordersPaused;
    try {
      const res = await fetch('/api/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordersPaused: nextPaused }),
      });
      if (res.ok) {
        setSettings({ ...settings, ordersPaused: nextPaused });
        showToast(
          nextPaused
            ? 'New order intake PAUSED. Product browsing & enquiries remain active.'
            : 'Order intake RESUMED. Shop is accepting orders.'
        );
      }
    } catch {
      showToast('Failed to toggle order intake');
    }
  };

  // Toggle Store Open/Closed
  const toggleStoreStatus = async () => {
    if (!settings) return;
    const nextState = !settings.isStoreOpen;
    try {
      const res = await fetch('/api/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStoreOpen: nextState }),
      });
      if (res.ok) {
        setSettings({ ...settings, isStoreOpen: nextState });
        showToast(`Store is now ${nextState ? 'OPEN' : 'CLOSED'}`);
      }
    } catch {
      showToast('Failed to toggle store status');
    }
  };

  // Order status update
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    extra?: { cancellationReason?: string; rescheduledDate?: string; rescheduledSlot?: string }
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Order status updated to "${status}"`);
        loadAllData();
        setRejectingOrder(null);
        setReschedulingOrder(null);
      } else {
        showToast(data.error || 'Failed to update order');
      }
    } catch {
      showToast('Error updating order');
    }
  };

  // Stock action
  const handleStockAction = async (
    productId: string,
    action: 'increment' | 'decrement' | 'toggle_out_of_stock',
    amount = 1
  ) => {
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Shelf count updated for ${data.product.title}`);
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? data.product : p))
        );
      }
    } catch {
      showToast('Failed to update shelf count');
    }
  };

  // Product save
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isNewProduct ? 'Product created!' : 'Product updated');
        setEditingProduct(null);
        loadAllData();
      }
    } catch {
      showToast('Failed to save product');
    }
  };

  // Enquiry status
  const handleEnquiryStatus = async (enquiryId: string, status: EnquiryStatus) => {
    try {
      const res = await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Enquiry marked as "${status}"`);
        loadAllData();
      }
    } catch {
      showToast('Failed to update enquiry status');
    }
  };

  // Settings save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/store', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast('Settings saved successfully');
      }
    } catch {
      showToast('Failed to save settings');
    }
  };

  const handleRetryNotification = async (notificationId?: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Notification retry processed');
        loadAllData();
      } else {
        showToast(data.error || 'Retry failed');
      }
    } catch {
      showToast('Error retrying notification');
    }
  };

  if (!authChecked || loading || !settings) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f3ef' }}>
        <p style={{ fontWeight: 600, color: 'var(--primary-900)' }}>Authenticating & Loading Cockpit...</p>
      </div>
    );
  }

  // Today calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(
    (o) =>
      o.scheduledDate === todayStr &&
      ['Pending', 'Confirmed', 'Processing', 'Ready', 'PENDING_REVIEW', 'READY_FOR_PICKUP'].includes(o.status)
  );
  const capacityPct = Math.min(
    100,
    Math.round((todayOrders.length / settings.dailyCapacity) * 100)
  );

  const pendingOrders = orders.filter((o) => o.status === 'Pending' || o.status === 'PENDING_REVIEW');
  const lowStockProducts = products.filter((p) => {
    const avail = Math.max(0, p.quantityOnHand - p.reservedQuantity);
    return avail <= p.lowStockThreshold;
  });
  const newEnquiries = enquiries.filter((e) => e.status === 'New' || e.status === 'NEW');

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'ALL') return true;
    if (orderFilter === 'Pending') return o.status === 'Pending' || o.status === 'PENDING_REVIEW';
    if (orderFilter === 'Fulfilled') return o.status === 'Fulfilled' || o.status === 'COMPLETED';
    if (orderFilter === 'Ready') return o.status === 'Ready' || o.status === 'READY_FOR_PICKUP';
    if (orderFilter === 'Cancelled') return o.status === 'Cancelled' || o.status === 'REJECTED';
    return o.status === orderFilter;
  });

  // Filtered enquiries list
  const filteredEnquiries = enquiries.filter((e) => {
    if (enquiryFilter === 'ALL') return true;
    if (enquiryFilter === 'New') return e.status === 'New' || e.status === 'NEW';
    if (enquiryFilter === 'Contacted') return e.status === 'Contacted' || e.status === 'IN_PROGRESS';
    if (enquiryFilter === 'Resolved') return e.status === 'Resolved' || e.status === 'REPLIED' || e.status === 'CONVERTED';
    return e.status === enquiryFilter;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f4f3ef', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header style={{ background: 'var(--primary-900)', color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="container" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>ShopSync</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#ffffff', color: 'var(--primary-900)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                  SHOPKEEPER PORTAL
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{settings.shopName}</span>
            </div>
          </div>

          {/* Master Controls: Pause Orders & Store Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Pause Orders Switch */}
            <button
              onClick={togglePauseOrders}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: settings.ordersPaused ? '#fffbeb' : 'rgba(255,255,255,0.1)',
                color: settings.ordersPaused ? '#b45309' : '#ffffff',
                border: settings.ordersPaused ? '1px solid #fde68a' : '1px solid rgba(255,255,255,0.2)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.785rem',
                fontWeight: 700,
              }}
              title="Pause or resume taking new order requests while allowing product browsing & enquiries"
            >
              {settings.ordersPaused ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
              <span>{settings.ordersPaused ? 'Orders: PAUSED' : 'Orders: ACTIVE'}</span>
            </button>

            {/* Store Master Open/Close */}
            <button
              onClick={toggleStoreStatus}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: settings.isStoreOpen ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                color: settings.isStoreOpen ? '#86efac' : '#fca5a5',
                border: `1px solid ${settings.isStoreOpen ? '#22c55e' : '#ef4444'}`,
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.785rem',
                fontWeight: 700,
              }}
            >
              <Power size={13} />
              <span>{settings.isStoreOpen ? 'Store: OPEN' : 'Store: CLOSED'}</span>
            </button>

            <button
              onClick={handleRefresh}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.785rem', color: '#ffffff', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>

            <Link
              href="/"
              target="_blank"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: '#ffffff',
                fontSize: '0.785rem',
                fontWeight: 600,
                padding: '0.35rem 0.7rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <ExternalLink size={13} /> View Store
            </Link>

            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: '#fca5a5',
                fontSize: '0.785rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
              title="Sign out of Shopkeeper Cockpit"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid var(--surface-border)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div className="container" style={{ display: 'flex', gap: '1.25rem', overflowX: 'auto' }}>
          {[
            { id: 'overview', label: 'Overview & Urgent Tasks', icon: Flame, badge: pendingOrders.length + lowStockProducts.length + newEnquiries.length },
            { id: 'orders', label: 'Order Management', icon: Package, badge: pendingOrders.length },
            { id: 'inventory', label: 'Products & Inventory', icon: Layers, badge: lowStockProducts.length },
            { id: 'enquiries', label: 'Enquiries Inbox', icon: Inbox, badge: newEnquiries.length },
            { id: 'settings', label: 'Capacity & Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.85rem 0.2rem',
                  borderBottom: isActive ? '3px solid var(--primary-700)' : '3px solid transparent',
                  color: isActive ? 'var(--primary-800)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    style={{
                      background: 'var(--accent-coral)',
                      color: '#ffffff',
                      fontSize: '0.675rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flexGrow: 1, padding: '1.75rem 0 4rem' }}>
        <div className="container">
          {/* TAB: OVERVIEW & URGENT TASKS FIRST */}
          {activeTab === 'overview' && (
            <div>
              {/* Urgent Tasks Strip */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '0.35rem' }}>
                  Operational Overview
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Prioritizing tasks requiring immediate shop floor attention.
                </p>
              </div>

              {/* Urgent Action Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                {/* 1. Pending Orders */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: pendingOrders.length > 0 ? '1.5px solid #f59e0b' : '1px solid var(--surface-border)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)' }}>
                        Pending Order Requests
                      </span>
                      <span style={{ background: pendingOrders.length > 0 ? '#fef08a' : '#f1f5f9', color: pendingOrders.length > 0 ? '#854d0e' : '#64748b', fontWeight: 800, fontSize: '0.8rem', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)' }}>
                        {pendingOrders.length} Pending
                      </span>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      {pendingOrders.length}
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {pendingOrders.length > 0
                        ? 'Customer orders soft-reserved awaiting your confirmation.'
                        : 'No pending orders waiting for review.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setOrderFilter('Pending');
                      setActiveTab('orders');
                    }}
                    className="btn btn-outline"
                    style={{ marginTop: '1rem', width: '100%', fontSize: '0.825rem', padding: '0.45rem' }}
                  >
                    <span>Triage Pending Orders</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* 2. Low-Stock Alerts */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: lowStockProducts.length > 0 ? '1.5px solid #ef4444' : '1px solid var(--surface-border)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)' }}>
                        Low Stock Warnings
                      </span>
                      <span style={{ background: lowStockProducts.length > 0 ? '#fee2e2' : '#f1f5f9', color: lowStockProducts.length > 0 ? '#991b1b' : '#64748b', fontWeight: 800, fontSize: '0.8rem', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)' }}>
                        {lowStockProducts.length} Near 0
                      </span>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      {lowStockProducts.length}
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {lowStockProducts.length > 0
                        ? `${lowStockProducts.map((p) => p.title).join(', ')}`
                        : 'All inventory is above minimum shelf thresholds.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="btn btn-outline"
                    style={{ marginTop: '1rem', width: '100%', fontSize: '0.825rem', padding: '0.45rem' }}
                  >
                    <span>Reconcile Inventory Shelf</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* 3. New Enquiries */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: newEnquiries.length > 0 ? '1.5px solid #3b82f6' : '1px solid var(--surface-border)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)' }}>
                        Uncontacted Enquiries
                      </span>
                      <span style={{ background: newEnquiries.length > 0 ? '#dbeafe' : '#f1f5f9', color: newEnquiries.length > 0 ? '#1e40af' : '#64748b', fontWeight: 800, fontSize: '0.8rem', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)' }}>
                        {newEnquiries.length} New
                      </span>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      {newEnquiries.length}
                    </div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {newEnquiries.length > 0
                        ? 'Customer queries awaiting response via email or phone.'
                        : 'All customer queries have been addressed.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEnquiryFilter('New');
                      setActiveTab('enquiries');
                    }}
                    className="btn btn-outline"
                    style={{ marginTop: '1rem', width: '100%', fontSize: '0.825rem', padding: '0.45rem' }}
                  >
                    <span>Open Enquiry Inbox</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* 4. Today's Capacity Gauge */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--surface-border)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)' }}>
                        Today&apos;s Fulfilment Load
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--primary-800)' }}>
                        {todayOrders.length} / {settings.dailyCapacity}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      {capacityPct}% Capacity
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginTop: '0.5rem' }}>
                      <div
                        style={{
                          width: `${capacityPct}%`,
                          height: '100%',
                          background: capacityPct >= 100 ? '#ef4444' : capacityPct >= 75 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      {capacityPct >= 100
                        ? '⚠️ Daily capacity reached. New orders automatically blocked.'
                        : `${settings.dailyCapacity - todayOrders.length} slots remaining for today.`}
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('settings')}
                    className="btn btn-outline"
                    style={{ marginTop: '1rem', width: '100%', fontSize: '0.825rem', padding: '0.45rem' }}
                  >
                    <span>Configure Daily Limits</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '1rem' }}>
                  Quick Operational Controls
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={togglePauseOrders}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    {settings.ordersPaused ? '▶️ Resume Taking Orders' : '⏸️ Pause Order Requests'}
                  </button>

                  <button
                    onClick={() => {
                      setEditingProduct({
                        title: '',
                        packaging: '',
                        price: 3.5,
                        quantityOnHand: 10,
                        lowStockThreshold: 3,
                        category: 'Produce',
                        description: '',
                        imageUrl: '/images/products/milk.jpg',
                        isActive: true,
                      });
                      setIsNewProduct(true);
                      setActiveTab('inventory');
                    }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Plus size={15} /> Add New Catalog Product
                  </button>

                  <Link
                    href="/"
                    target="_blank"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <ExternalLink size={15} /> Preview Storefront as Customer
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                    Order Management
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Process orders through each stage: Pending ➔ Confirmed ➔ Processing ➔ Ready ➔ Fulfilled.
                  </p>
                </div>

                {/* Filter Tabs matching exact Phase 2 statuses */}
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {['ALL', 'Pending', 'Confirmed', 'Processing', 'Ready', 'Fulfilled', 'Cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setOrderFilter(st)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.785rem',
                        fontWeight: 700,
                        background: orderFilter === st ? 'var(--primary-800)' : '#ffffff',
                        color: orderFilter === st ? '#ffffff' : 'var(--text-main)',
                        border: '1px solid var(--surface-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                  <Package size={40} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600, color: 'var(--primary-900)' }}>
                    No orders found in status &quot;{orderFilter}&quot;.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {filteredOrders.map((order) => {
                    const isPending = order.status === 'Pending' || order.status === 'PENDING_REVIEW';
                    const isConfirmed = order.status === 'Confirmed';
                    const isProcessing = order.status === 'Processing';
                    const isReady = order.status === 'Ready' || order.status === 'READY_FOR_PICKUP';
                    const isFulfilled = order.status === 'Fulfilled' || order.status === 'COMPLETED';
                    const isCancelled = order.status === 'Cancelled' || order.status === 'REJECTED';

                    return (
                      <div
                        key={order.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid var(--surface-border)',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                                {order.orderNumber}
                              </h3>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: isPending
                                    ? '#fef08a'
                                    : isConfirmed
                                    ? '#bbf7d0'
                                    : isProcessing
                                    ? '#fed7aa'
                                    : isReady
                                    ? '#bfdbfe'
                                    : isFulfilled
                                    ? '#dcfce7'
                                    : '#fee2e2',
                                  color: isPending
                                    ? '#854d0e'
                                    : isConfirmed
                                    ? '#14532d'
                                    : isProcessing
                                    ? '#9a3412'
                                    : isReady
                                    ? '#1e3a8a'
                                    : isFulfilled
                                    ? '#166534'
                                    : '#991b1b',
                                }}
                              >
                                {order.status}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              Customer: <strong>{order.customerName}</strong> • {order.customerPhone} • {order.customerEmail}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-800)' }}>
                              {order.fulfilmentType === 'delivery' ? '🚚 Delivery' : '🏪 Counter Pickup'} • {order.scheduledDate}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.785rem', color: 'var(--text-light)' }}>
                              {order.scheduledSlot}
                            </span>
                          </div>
                        </div>

                        {/* Items ordered */}
                        <div style={{ background: 'var(--surface-bg)', borderRadius: 'var(--radius-md)', padding: '0.85rem', border: '1px solid var(--surface-border)', marginBottom: '0.85rem' }}>
                          {order.items.map((item) => (
                            <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                              <span>
                                <strong>{item.quantity}x</strong> {item.productTitle} ({item.packaging})
                              </span>
                              <strong>£{item.subtotal.toFixed(2)}</strong>
                            </div>
                          ))}
                          {order.deliveryAddress && (
                            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              📍 Delivery: {order.deliveryAddress}
                            </div>
                          )}
                          {order.customerNotes && (
                            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#b45309' }}>
                              📝 Note: &quot;{order.customerNotes}&quot;
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--surface-border)', paddingTop: '0.4rem', marginTop: '0.4rem', fontWeight: 800 }}>
                            <span>Total Due:</span>
                            <span>£{order.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Action Buttons across Order Lifecycle */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid var(--surface-border-subtle)', paddingTop: '0.65rem' }}>
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'Confirmed')}
                                className="btn btn-primary"
                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
                              >
                                <CheckCircle2 size={14} /> 1. Confirm & Reserve Stock
                              </button>

                              <button
                                onClick={() => {
                                  setReschedulingOrder(order);
                                  setRescheduleDate(order.scheduledDate);
                                  setRescheduleSlot(order.scheduledSlot);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                              >
                                <Calendar size={13} /> Reschedule
                              </button>

                              <button
                                onClick={() => setRejectingOrder(order)}
                                className="btn btn-danger"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                              >
                                <XCircle size={13} /> Cancel Order
                              </button>
                            </>
                          )}

                          {isConfirmed && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'Processing')}
                                className="btn btn-primary"
                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem', background: '#d97706' }}
                              >
                                <Layers size={14} /> 2. Mark Processing / Packing
                              </button>

                              <button
                                onClick={() => setRejectingOrder(order)}
                                className="btn btn-danger"
                                style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                              >
                                Cancel Order
                              </button>
                            </>
                          )}

                          {isProcessing && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Ready')}
                              className="btn btn-primary"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem', background: '#2563eb' }}
                            >
                              <Package size={14} /> 3. Mark Ready for Pickup / Delivery
                            </button>
                          )}

                          {isReady && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'Fulfilled')}
                              className="btn btn-primary"
                              style={{ padding: '0.45rem 0.95rem', fontSize: '0.825rem' }}
                            >
                              <CheckCircle2 size={14} /> 4. Mark Fulfilled & Deduct Stock
                            </button>
                          )}

                          <Link
                            href={`/order/${order.id}?token=${order.trackingToken}`}
                            target="_blank"
                            className="btn btn-secondary"
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
                          >
                            <Eye size={13} /> Customer View
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PRODUCTS & INVENTORY MANAGEMENT */}
          {activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                    Product & Inventory Management
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Real-time physical shelf counts, low-stock thresholds, and rapid adjustment buttons.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingProduct({
                      title: '',
                      packaging: '',
                      price: 3.5,
                      quantityOnHand: 10,
                      lowStockThreshold: 3,
                      category: 'Produce',
                      description: '',
                      imageUrl: '/images/products/milk.jpg',
                      isActive: true,
                    });
                    setIsNewProduct(true);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                >
                  <Plus size={15} /> Add New Product
                </button>
              </div>

              {/* Products list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {products.map((p) => {
                  const available = Math.max(0, p.quantityOnHand - p.reservedQuantity);
                  const isLow = available <= p.lowStockThreshold;

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: 'var(--radius-lg)',
                        border: isLow ? '1.5px solid #f59e0b' : '1px solid var(--surface-border)',
                        padding: '1rem 1.25rem',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 260 }}>
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: '10px',
                            overflow: 'hidden',
                            position: 'relative',
                            background: '#eeeae4',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={p.imageUrl}
                            alt={p.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-900)' }}>
                              {p.title}
                            </h4>
                            {isLow && (
                              <span style={{ fontSize: '0.7rem', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                                LOW STOCK
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                            {p.packaging} • £{p.price.toFixed(2)} • {p.category}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                            🕒 Stock verified: {new Date(p.lastVerifiedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Stock Counts */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            Physical Count
                          </span>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                            {p.quantityOnHand}
                          </strong>
                        </div>

                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            Reserved
                          </span>
                          <strong style={{ fontSize: '1.1rem', color: '#b45309' }}>
                            {p.reservedQuantity}
                          </strong>
                        </div>

                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            Available to Buy
                          </span>
                          <strong style={{ fontSize: '1.2rem', color: available > 0 ? 'var(--primary-700)' : '#cf1322' }}>
                            {available}
                          </strong>
                        </div>
                      </div>

                      {/* Quick controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleStockAction(p.id, 'decrement', 1)}
                          className="quick-stock-btn"
                          title="Decrease 1"
                        >
                          <Minus size={13} />
                        </button>
                        <button
                          onClick={() => handleStockAction(p.id, 'increment', 1)}
                          className="quick-stock-btn"
                          title="Add 1"
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          onClick={() => handleStockAction(p.id, 'increment', 5)}
                          className="quick-stock-btn"
                          style={{ width: 'auto', padding: '0 0.5rem', fontSize: '0.75rem' }}
                          title="Add 5"
                        >
                          +5
                        </button>

                        <button
                          onClick={() => handleStockAction(p.id, 'toggle_out_of_stock')}
                          className="btn btn-secondary"
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            background: p.quantityOnHand === 0 ? 'var(--badge-green-bg)' : '#fee2e2',
                            color: p.quantityOnHand === 0 ? 'var(--badge-green-text)' : '#991b1b',
                          }}
                        >
                          {p.quantityOnHand === 0 ? 'Restock 10' : 'Set Sold Out'}
                        </button>

                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setIsNewProduct(false);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: ENQUIRIES INBOX */}
          {activeTab === 'enquiries' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                    Enquiry Inbox
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Manage customer inquiries through statuses: New, Contacted, and Resolved.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['ALL', 'New', 'Contacted', 'Resolved'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setEnquiryFilter(st)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.785rem',
                        fontWeight: 700,
                        background: enquiryFilter === st ? 'var(--primary-800)' : '#ffffff',
                        color: enquiryFilter === st ? '#ffffff' : 'var(--text-main)',
                        border: '1px solid var(--surface-border)',
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEnquiries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: 'var(--radius-lg)' }}>
                  <Inbox size={40} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600 }}>No enquiries in category &quot;{enquiryFilter}&quot;.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {filteredEnquiries.map((enq) => {
                    const isNew = enq.status === 'New' || enq.status === 'NEW';
                    const isContacted = enq.status === 'Contacted' || enq.status === 'IN_PROGRESS';
                    const isResolved = enq.status === 'Resolved' || enq.status === 'REPLIED' || enq.status === 'CONVERTED';

                    return (
                      <div
                        key={enq.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: 'var(--radius-lg)',
                          border: isNew ? '1.5px solid #3b82f6' : '1px solid var(--surface-border)',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary-900)' }}>
                                {enq.enquiryNumber}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '4px',
                                  background: isNew ? '#dbeafe' : isContacted ? '#fef08a' : '#dcfce7',
                                  color: isNew ? '#1e40af' : isContacted ? '#854d0e' : '#166534',
                                }}
                              >
                                {isNew ? 'New' : isContacted ? 'Contacted' : 'Resolved'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              From: <strong>{enq.customerName}</strong> ({enq.customerEmail} • {enq.customerPhone})
                            </span>
                          </div>

                          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            {new Date(enq.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {enq.productTitle && (
                          <div style={{ fontSize: '0.785rem', background: 'var(--primary-50)', color: 'var(--primary-800)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.65rem', display: 'inline-block', fontWeight: 600 }}>
                            Subject: {enq.productTitle}
                          </div>
                        )}

                        <div style={{ background: 'var(--surface-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '0.85rem', border: '1px solid var(--surface-border)' }}>
                          &quot;{enq.message}&quot;
                        </div>

                        {/* Status switcher */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => handleEnquiryStatus(enq.id, 'New')}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                background: isNew ? 'var(--primary-700)' : 'var(--surface-bg)',
                                color: isNew ? '#ffffff' : 'var(--text-muted)',
                                border: '1px solid var(--surface-border)',
                                fontWeight: 600,
                              }}
                            >
                              New
                            </button>
                            <button
                              onClick={() => handleEnquiryStatus(enq.id, 'Contacted')}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                background: isContacted ? '#d97706' : 'var(--surface-bg)',
                                color: isContacted ? '#ffffff' : 'var(--text-muted)',
                                border: '1px solid var(--surface-border)',
                                fontWeight: 600,
                              }}
                            >
                              Contacted
                            </button>
                            <button
                              onClick={() => handleEnquiryStatus(enq.id, 'Resolved')}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                background: isResolved ? '#16a34a' : 'var(--surface-bg)',
                                color: isResolved ? '#ffffff' : 'var(--text-muted)',
                                border: '1px solid var(--surface-border)',
                                fontWeight: 600,
                              }}
                            >
                              Resolved
                            </button>
                          </div>

                          <a
                            href={`mailto:${enq.customerEmail}?subject=Re: Enquiry ${enq.enquiryNumber} — ${settings.shopName}`}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.785rem' }}
                          >
                            <MessageSquare size={13} /> Reply via Email
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: CAPACITY & SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '1rem' }}>
                  Fulfilment Capacity Limits
                </h3>

                <form onSubmit={handleSaveSettings}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="settings-daily-capacity">
                      Daily Fulfilment Limit (Max Orders / Day) *
                    </label>
                    <input
                      id="settings-daily-capacity"
                      type="number"
                      required
                      min={1}
                      max={100}
                      className="form-input"
                      value={settings.dailyCapacity}
                      onChange={(e) => setSettings({ ...settings, dailyCapacity: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Once reached on any date, checkout blocks that day while keeping enquiries open.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Order Intake Switch</label>
                    <button
                      type="button"
                      onClick={togglePauseOrders}
                      className="btn"
                      style={{
                        width: '100%',
                        background: settings.ordersPaused ? '#fffbeb' : '#f0fdf4',
                        color: settings.ordersPaused ? '#b45309' : '#166534',
                        border: settings.ordersPaused ? '1.5px solid #fde68a' : '1.5px solid #86efac',
                        padding: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {settings.ordersPaused ? '⏸️ Orders Currently PAUSED (Click to Resume)' : '▶️ Orders Currently ACTIVE (Click to Pause)'}
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="settings-notice-banner">Storefront Announcement Banner</label>
                    <textarea
                      id="settings-notice-banner"
                      rows={2}
                      className="form-textarea"
                      value={settings.noticeBanner}
                      onChange={(e) => setSettings({ ...settings, noticeBanner: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="settings-hours">Business Hours Display</label>
                    <input
                      id="settings-hours"
                      type="text"
                      className="form-input"
                      value={settings.businessHours}
                      onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="settings-address">Counter Pickup Address</label>
                    <input
                      id="settings-address"
                      type="text"
                      className="form-input"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                    Save Capacity & Settings
                  </button>
                </form>
              </div>

              {/* Notification Outbox */}
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      Notification Outbox Logs
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Audit trail of customer emails with bounded retries and simulated dev fallback.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {logs.some((l) => l.status === 'FAILED') && (
                      <button
                        type="button"
                        onClick={() => handleRetryNotification()}
                        style={{
                          fontSize: '0.75rem',
                          background: '#fee2e2',
                          color: '#991b1b',
                          border: '1px solid #f87171',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Retry All Failed
                      </button>
                    )}
                    <span style={{ fontSize: '0.75rem', background: 'var(--badge-green-bg)', color: 'var(--badge-green-text)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                      FAULT TOLERANT
                    </span>
                  </div>
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                      No notifications logged yet.
                    </div>
                  ) : (
                    logs.map((log) => {
                      const isDelivered = log.status === 'DELIVERED';
                      const isSimulated = log.status === 'SIMULATED';
                      const isFailed = log.status === 'FAILED';

                      const badgeBg = isDelivered ? '#dcfce7' : isSimulated ? '#fef3c7' : isFailed ? '#fee2e2' : '#dbeafe';
                      const badgeColor = isDelivered ? '#166534' : isSimulated ? '#92400e' : isFailed ? '#991b1b' : '#1e40af';
                      const badgeLabel = isDelivered ? '✓ DELIVERED' : isSimulated ? 'ℹ️ SIMULATED (DEV)' : isFailed ? '⚠️ FAILED' : '⏳ PENDING';

                      return (
                        <div
                          key={log.id}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            background: isFailed ? '#fff5f5' : 'var(--surface-bg)',
                            border: `1px solid ${isFailed ? '#fca5a5' : 'var(--surface-border)'}`,
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <strong style={{ color: 'var(--primary-900)' }}>{log.recipient}</strong>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <span
                                style={{
                                  background: badgeBg,
                                  color: badgeColor,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                }}
                              >
                                {badgeLabel}
                              </span>
                              {isFailed && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryNotification(log.id)}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.1rem 0.4rem',
                                    background: '#ffffff',
                                    border: '1px solid #f87171',
                                    color: '#991b1b',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {log.subject}
                          </div>
                          {log.errorMessage && (
                            <div style={{ color: isFailed ? '#b91c1c' : '#92400e', fontSize: '0.7rem', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                              {log.errorMessage}
                            </div>
                          )}
                          <div style={{ color: 'var(--text-light)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                            {new Date(log.timestamp).toLocaleTimeString()} • Attempts: {log.attempts}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Rejection Modal */}
      {rejectingOrder && (
        <div className="modal-overlay" onClick={() => setRejectingOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#cf1322', marginBottom: '0.5rem' }}>
              Cancel Order {rejectingOrder.orderNumber}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Cancelling releases all held stock reservations back to shelf inventory.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-cancel-reason">Reason for Cancellation *</label>
              <select
                id="admin-cancel-reason"
                className="form-select"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="Item out of stock or batch damaged">Item out of stock or batch damaged</option>
                <option value="Fulfilment capacity exceeded for requested time">Fulfilment capacity exceeded for requested time</option>
                <option value="Delivery address outside our local zone">Delivery address outside our local zone</option>
                <option value="Customer requested cancellation">Customer requested cancellation</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setRejectingOrder(null)} className="btn btn-secondary">
                Keep Order
              </button>
              <button
                onClick={() =>
                  handleUpdateOrderStatus(rejectingOrder.id, 'Cancelled', {
                    cancellationReason: rejectReason,
                  })
                }
                className="btn btn-danger"
              >
                Confirm Cancellation & Release Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingOrder && (
        <div className="modal-overlay" onClick={() => setReschedulingOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '0.5rem' }}>
              Reschedule Order {reschedulingOrder.orderNumber}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Adjust target date & time window for {reschedulingOrder.customerName}.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-reschedule-date">New Scheduled Date *</label>
              <input
                id="admin-reschedule-date"
                type="date"
                required
                className="form-input"
                value={rescheduleDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-reschedule-slot">New Time Window *</label>
              <select
                id="admin-reschedule-slot"
                className="form-select"
                value={rescheduleSlot}
                onChange={(e) => setRescheduleSlot(e.target.value)}
              >
                {settings.timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setReschedulingOrder(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdateOrderStatus(reschedulingOrder.id, 'Confirmed', {
                    rescheduledDate: rescheduleDate,
                    rescheduledSlot: rescheduleSlot,
                  })
                }
                className="btn btn-primary"
              >
                Save New Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Edit/Add Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-900)', marginBottom: '1rem' }}>
              {isNewProduct ? 'Add New Product' : `Edit ${editingProduct.title}`}
            </h3>

            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-modal-title">Product Title *</label>
                <input
                  id="admin-modal-title"
                  type="text"
                  required
                  className="form-input"
                  value={editingProduct.title || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-modal-packaging">Packaging Description *</label>
                  <input
                    id="admin-modal-packaging"
                    type="text"
                    required
                    placeholder="e.g. 500g Jar, 1L Bottle"
                    className="form-input"
                    value={editingProduct.packaging || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, packaging: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="admin-modal-category">Category *</label>
                  <input
                    id="admin-modal-category"
                    type="text"
                    required
                    className="form-input"
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-modal-price">Price (£) *</label>
                  <input
                    id="admin-modal-price"
                    type="number"
                    step="0.01"
                    required
                    className="form-input"
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="admin-modal-stock">Physical Count *</label>
                  <input
                    id="admin-modal-stock"
                    type="number"
                    required
                    min={0}
                    className="form-input"
                    value={editingProduct.quantityOnHand || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, quantityOnHand: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="admin-modal-threshold">Low Threshold</label>
                  <input
                    id="admin-modal-threshold"
                    type="number"
                    min={0}
                    className="form-input"
                    value={editingProduct.lowStockThreshold || 2}
                    onChange={(e) => setEditingProduct({ ...editingProduct, lowStockThreshold: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="admin-modal-desc">Description</label>
                <textarea
                  id="admin-modal-desc"
                  rows={2}
                  className="form-textarea"
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setEditingProduct(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminToast && (
        <div className="toast-bar">
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '0.9rem' }}>{adminToast}</span>
        </div>
      )}
    </div>
  );
}
