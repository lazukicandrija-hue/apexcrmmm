'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface User { id: string; username: string; full_name: string; role: string; }

const PONUDA_TYPES = ['Novogradnja', 'Starogradnja', 'Lokali', 'Rente'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ponudaOpen, setPonudaOpen] = useState(false);

  const currentCategory = searchParams.get('category') || '';

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
      else router.push('/login');
    }).catch(() => router.push('/login'));
  }, [router]);

  // Auto-expand ponuda section when on a properties sub-page
  useEffect(() => {
    if (pathname.includes('properties') && currentCategory) {
      setPonudaOpen(true);
    }
  }, [pathname, currentCategory]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const isActive = (href: string) => {
    const [path, query] = href.split('?');
    if (path !== pathname) return false;
    if (query) {
      const params = new URLSearchParams(query);
      const cat = params.get('category');
      return cat === currentCategory;
    }
    return !currentCategory;
  };

  const getTopbarTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname.includes('properties')) {
      if (currentCategory === 'Rente') return 'Rente';
      if (currentCategory === 'Novogradnja') return 'Novogradnja';
      if (currentCategory === 'Starogradnja') return 'Starogradnja';
      if (currentCategory === 'Lokali') return 'Lokali';
      if (PONUDA_TYPES.some(t => t === currentCategory)) return currentCategory;
      return 'Ponuda';
    }
    if (pathname.includes('buyers')) return 'Kupci';
    if (pathname.includes('users')) return 'Korisnici';
    return '';
  };

  if (!user) return <div className="login-page"><div className="login-card"><div className="login-logo">APEX</div><p style={{color:'#aaa',marginTop:16}}>Učitavanje...</p></div></div>;

  return (
    <div className="dashboard-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.jpeg" alt="APEX Real Estate" className="sidebar-logo-img" />
          </div>
        </div>
        <nav className="sidebar-nav">
          {/* Dashboard */}
          <Link href="/dashboard"
            className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}>
            <span>📊</span> Dashboard
          </Link>

          {/* Ponuda section */}
          <button
            className={`nav-item nav-group-toggle ${pathname.includes('properties') ? 'active-group' : ''}`}
            onClick={() => setPonudaOpen(!ponudaOpen)}
          >
            <span>🏠</span> Ponuda
            <svg className={`nav-chevron ${ponudaOpen ? 'open' : ''}`} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <div className={`nav-group ${ponudaOpen ? 'open' : ''}`}>
            <Link href="/dashboard/properties?category=Novogradnja"
              className={`nav-item nav-sub ${isActive('/dashboard/properties?category=Novogradnja') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>🏗️</span> Novogradnja
            </Link>
            <Link href="/dashboard/properties?category=Starogradnja"
              className={`nav-item nav-sub ${isActive('/dashboard/properties?category=Starogradnja') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>🏛️</span> Starogradnja
            </Link>
            <Link href="/dashboard/properties?category=Lokali"
              className={`nav-item nav-sub ${isActive('/dashboard/properties?category=Lokali') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>🏪</span> Lokali
            </Link>
            <Link href="/dashboard/properties?category=Rente"
              className={`nav-item nav-sub ${isActive('/dashboard/properties?category=Rente') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>🔑</span> Rente
            </Link>
          </div>

          {/* Kupci */}
          <Link href="/dashboard/buyers"
            className={`nav-item ${pathname.includes('buyers') ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}>
            <span>👤</span> Kupci
          </Link>

          {/* Admin */}
          {user?.role === 'admin' && (
            <Link href="/dashboard/users"
              className={`nav-item ${pathname.includes('users') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>⚙️</span> Korisnici
            </Link>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={handleLogout}>🚪 Odjava</button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="topbar-title">{getTopbarTitle()}</div>
          </div>
          <div className="topbar-user">
            <div className="topbar-user-info">
              <div className="topbar-user-name">{user.full_name}</div>
              <div className="topbar-user-role">{user.role}</div>
            </div>
            <div className="topbar-avatar">{user.full_name.charAt(0)}</div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
