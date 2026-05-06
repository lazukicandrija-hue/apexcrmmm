'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface User { id: string; username: string; full_name: string; role: string; }
interface SearchResult { type:string; id:string; title:string; subtitle:string; badge:string; href:string; icon:string; }

const PONUDA_TYPES = ['Novogradnja', 'Starogradnja', 'Lokali', 'Rente'];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ponudaOpen, setPonudaOpen] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({currentPassword:'',newPassword:'',confirmPassword:''});
  const [pwToast, setPwToast] = useState<{msg:string;type:string}|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout|null>(null);

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

  // Close search on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    if (pathname.includes('api-keys')) return 'API Ključevi';
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
            <>
            <Link href="/dashboard/users"
              className={`nav-item ${pathname.includes('users') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>⚙️</span> Korisnici
            </Link>
            <Link href="/dashboard/api-keys"
              className={`nav-item ${pathname.includes('api-keys') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span>🤖</span> API Ključevi
            </Link>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setPwModal(true)}>🔑 Promeni Lozinku</button>
          <button className="nav-item" onClick={handleLogout}>🚪 Odjava</button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="topbar-title">{getTopbarTitle()}</div>
          </div>
          {/* Global Search */}
          <div ref={searchRef} style={{position:'relative',flex:'0 1 360px'}}>
            <div style={{position:'relative'}}>
              <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',opacity:0.4}} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                className="form-input"
                placeholder="Pretraži nekretnine, kupce, vlasnike..."
                value={searchQuery}
                onChange={e => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (searchTimeout.current) clearTimeout(searchTimeout.current);
                  if (val.trim().length < 2) { setSearchResults([]); setSearchOpen(false); return; }
                  searchTimeout.current = setTimeout(async () => {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
                    const d = await res.json();
                    setSearchResults(d.results || []);
                    setSearchOpen(true);
                  }, 300);
                }}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                style={{paddingLeft:36,fontSize:'0.85rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(212,175,55,0.15)',borderRadius:8,width:'100%'}}
              />
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:6,background:'#1a1a1a',border:'1px solid rgba(212,175,55,0.2)',borderRadius:10,overflow:'hidden',zIndex:100,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
                {searchResults.map(r => (
                  <Link key={`${r.type}-${r.id}`} href={r.href}
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',color:'#fff',fontSize:'0.85rem',borderBottom:'1px solid rgba(255,255,255,0.05)',transition:'background 0.15s'}}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{fontSize:18}}>{r.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.title}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--gray-300)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.subtitle}</div>
                    </div>
                    <span className={`badge ${r.badge==='Aktivna'||r.badge==='Aktivan'?'badge-active':r.badge==='Prodato'?'badge-sold':'badge-negotiation'}`} style={{fontSize:'0.7rem'}}>{r.badge}</span>
                  </Link>
                ))}
                {searchResults.length === 0 && (
                  <div style={{padding:'16px',textAlign:'center',color:'var(--gray-300)',fontSize:'0.85rem'}}>Nema rezultata</div>
                )}
              </div>
            )}
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

      {/* Password Change Modal */}
      {pwModal && (
        <div className="modal-overlay" onClick={() => setPwModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔒 Promeni Lozinku</div>
              <button className="modal-close" onClick={() => setPwModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (pwForm.newPassword !== pwForm.confirmPassword) {
                setPwToast({msg:'Lozinke se ne poklapaju',type:'error'}); setTimeout(()=>setPwToast(null),3000); return;
              }
              const res = await fetch('/api/auth/password', {
                method:'PUT', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({currentPassword:pwForm.currentPassword,newPassword:pwForm.newPassword})
              });
              const d = await res.json();
              if (res.ok) {
                setPwToast({msg:d.message,type:'success'}); setTimeout(()=>{setPwToast(null);setPwModal(false);},2000);
                setPwForm({currentPassword:'',newPassword:'',confirmPassword:''});
              } else { setPwToast({msg:d.error,type:'error'}); setTimeout(()=>setPwToast(null),3000); }
            }}>
              <div className="modal-body">
                {pwToast && <div style={{padding:'8px 12px',borderRadius:8,marginBottom:12,fontSize:'0.85rem',
                  background:pwToast.type==='error'?'rgba(255,60,60,0.15)':'rgba(76,175,80,0.15)',
                  color:pwToast.type==='error'?'#ff6b6b':'#4caf50',border:`1px solid ${pwToast.type==='error'?'rgba(255,60,60,0.3)':'rgba(76,175,80,0.3)'}`
                }}>{pwToast.msg}</div>}
                <div className="form-group"><label>Trenutna Lozinka *</label><input className="form-input" type="password" required value={pwForm.currentPassword} onChange={e=>setPwForm({...pwForm,currentPassword:e.target.value})} /></div>
                <div className="form-group"><label>Nova Lozinka *</label><input className="form-input" type="password" required minLength={4} value={pwForm.newPassword} onChange={e=>setPwForm({...pwForm,newPassword:e.target.value})} /></div>
                <div className="form-group"><label>Potvrdi Novu Lozinku *</label><input className="form-input" type="password" required value={pwForm.confirmPassword} onChange={e=>setPwForm({...pwForm,confirmPassword:e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setPwModal(false)}>Otkaži</button>
                <button type="submit" className="btn-gold">Promeni</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{background:'#000',minHeight:'100vh'}} />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
