'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Property { id:string; title:string; location:string; price:number; type:string; status:string; created_at:string; next_action_date:string; reminder_text:string; }
interface Buyer { id:string; first_name:string; last_name:string; next_action_date:string; status:string; desired_type:string; location:string; budget:number; }
interface Analytics {
  byType: {type:string;count:number}[];
  byStatus: {status:string;count:number}[];
  priceRanges: {range:string;count:number}[];
  buyerPipeline: {status:string;count:number}[];
  topLocations: {location:string;count:number}[];
  totalValue: number;
  staleProperties: {id:string;title:string;location:string;price:number;days_active:number}[];
}

const COLORS = ['#D4AF37','#4caf50','#2196f3','#ff6b6b','#ab47bc','#ff9800'];
const STATUS_COLORS: Record<string,string> = {'Aktivna':'#4caf50','Prodato':'#2196f3','U pregovoru':'#ff9800','Aktivan':'#4caf50','Pauzirana Potraga':'#ff9800','Kupio Stan':'#2196f3'};

export default function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics|null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/properties').then(r=>r.json()).then(d=>setProperties(d.properties||[]));
    fetch('/api/buyers').then(r=>r.json()).then(d=>setBuyers(d.buyers||[]));
    fetch('/api/analytics').then(r=>r.json()).then(d=>setAnalytics(d));
  }, []);

  const activeProps = properties.filter(p => p.status === 'Aktivna').length;
  const soldProps = properties.filter(p => p.status === 'Prodato').length;
  const today = new Date().toISOString().split('T')[0];
  const overdueBuyers = buyers.filter(b => b.next_action_date && b.next_action_date < today);
  const overdueProps = properties.filter(p => p.next_action_date && p.next_action_date < today);
  const soonBuyers = buyers.filter(b => {
    if (!b.next_action_date || b.next_action_date < today) return false;
    const diff = (new Date(b.next_action_date).getTime() - new Date(today).getTime()) / 86400000;
    return diff <= 3;
  });
  const soonProps = properties.filter(p => {
    if (!p.next_action_date || p.next_action_date < today) return false;
    const diff = (new Date(p.next_action_date).getTime() - new Date(today).getTime()) / 86400000;
    return diff <= 3;
  });
  const todayProps = properties.filter(p => p.next_action_date === today);
  const todayBuyers = buyers.filter(b => b.next_action_date === today);
  const totalOverdue = overdueBuyers.length + overdueProps.length;
  const totalSoon = soonBuyers.length + soonProps.length;
  const totalToday = todayProps.length + todayBuyers.length;

  // Auto-show popup when data loads and there are reminders
  useEffect(() => {
    if (!popupDismissed && (totalOverdue > 0 || totalToday > 0 || totalSoon > 0)) {
      setShowPopup(true);
    }
  }, [totalOverdue, totalToday, totalSoon, popupDismissed]);

  const dismissPopup = () => { setShowPopup(false); setPopupDismissed(true); };

  const getDateBadge = (date: string) => {
    if (!date) return '';
    if (date < today) return 'badge-overdue';
    const diff = (new Date(date).getTime() - new Date(today).getTime()) / 86400000;
    if (diff <= 2) return 'badge-soon';
    return 'badge-future';
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('sr-RS') : '-';
  const formatPrice = (p: number) => p >= 1000 ? `€${p.toLocaleString('sr-RS')}` : `€${p}/mesec`;

  return (
    <>
      {/* ===== POPUP REMINDER MODAL ===== */}
      {showPopup && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',animation:'fadeIn 0.3s ease'}} onClick={dismissPopup}>
          <div style={{background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',border:'1px solid rgba(212,175,55,0.3)',borderRadius:16,padding:'28px 32px',maxWidth:560,width:'90%',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5),0 0 40px rgba(212,175,55,0.1)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:28}}>🔔</span>
                <div>
                  <div style={{fontSize:'1.2rem',fontWeight:700,fontFamily:'Cinzel,serif',color:'var(--gold)'}}>Podsetnici</div>
                  <div style={{fontSize:'0.75rem',color:'var(--gray-300)'}}>{new Date().toLocaleDateString('sr-RS',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
                </div>
              </div>
              <button onClick={dismissPopup} style={{background:'none',border:'none',color:'var(--gray-300)',fontSize:24,cursor:'pointer',padding:4}}>✕</button>
            </div>

            {/* Overdue */}
            {totalOverdue > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <span style={{fontSize:16}}>🚨</span>
                  <span style={{color:'#ff6b6b',fontWeight:700,fontSize:'0.9rem'}}>PROSROČENO ({totalOverdue})</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {overdueProps.map(p=>(
                    <Link key={p.id} href={`/dashboard/properties/${p.id}`} onClick={dismissPopup}
                      style={{display:'flex',flexDirection:'column',padding:'10px 14px',background:'rgba(255,60,60,0.1)',border:'1px solid rgba(255,60,60,0.2)',borderRadius:10,color:'#fff',textDecoration:'none',transition:'background 0.2s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,60,60,0.18)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,60,60,0.1)'}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem'}}>🏠 {p.title}</span>
                        <span className="badge badge-overdue">{formatDate(p.next_action_date)}</span>
                      </div>
                      {p.reminder_text && <div style={{fontSize:'0.78rem',color:'#ffcdd2',marginTop:4}}>📋 {p.reminder_text}</div>}
                    </Link>
                  ))}
                  {overdueBuyers.map(b=>(
                    <Link key={b.id} href={`/dashboard/buyers/${b.id}`} onClick={dismissPopup}
                      style={{display:'flex',flexDirection:'column',padding:'10px 14px',background:'rgba(255,60,60,0.1)',border:'1px solid rgba(255,60,60,0.2)',borderRadius:10,color:'#fff',textDecoration:'none',transition:'background 0.2s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,60,60,0.18)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,60,60,0.1)'}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem'}}>👤 {b.first_name} {b.last_name}</span>
                        <span className="badge badge-overdue">{formatDate(b.next_action_date)}</span>
                      </div>
                      <div style={{fontSize:'0.78rem',color:'#ffcdd2',marginTop:4}}>Traži: {b.desired_type||'neodređeno'} {b.location ? `— ${b.location}` : ''}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Today */}
            {totalToday > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <span style={{fontSize:16}}>📅</span>
                  <span style={{color:'var(--gold)',fontWeight:700,fontSize:'0.9rem'}}>DANAS ({totalToday})</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {todayProps.map(p=>(
                    <Link key={p.id} href={`/dashboard/properties/${p.id}`} onClick={dismissPopup}
                      style={{display:'flex',flexDirection:'column',padding:'10px 14px',background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:10,color:'#fff',textDecoration:'none',transition:'background 0.2s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(212,175,55,0.15)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(212,175,55,0.08)'}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem'}}>🏠 {p.title}</span>
                        <span className="badge badge-soon">DANAS</span>
                      </div>
                      {p.reminder_text && <div style={{fontSize:'0.78rem',color:'#ffe082',marginTop:4}}>📋 {p.reminder_text}</div>}
                    </Link>
                  ))}
                  {todayBuyers.map(b=>(
                    <Link key={b.id} href={`/dashboard/buyers/${b.id}`} onClick={dismissPopup}
                      style={{display:'flex',flexDirection:'column',padding:'10px 14px',background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:10,color:'#fff',textDecoration:'none',transition:'background 0.2s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(212,175,55,0.15)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(212,175,55,0.08)'}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem'}}>👤 {b.first_name} {b.last_name}</span>
                        <span className="badge badge-soon">DANAS</span>
                      </div>
                      <div style={{fontSize:'0.78rem',color:'#ffe082',marginTop:4}}>Traži: {b.desired_type||'neodređeno'} {b.location ? `— ${b.location}` : ''}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming (next 3 days) */}
            {totalSoon > 0 && totalOverdue === 0 && totalToday === 0 && (
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <span style={{fontSize:16}}>⏰</span>
                  <span style={{color:'#81d4fa',fontWeight:700,fontSize:'0.9rem'}}>USKORO ({totalSoon})</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {soonProps.map(p=>(
                    <Link key={p.id} href={`/dashboard/properties/${p.id}`} onClick={dismissPopup}
                      style={{display:'flex',flexDirection:'column',padding:'10px 14px',background:'rgba(33,150,243,0.08)',border:'1px solid rgba(33,150,243,0.2)',borderRadius:10,color:'#fff',textDecoration:'none'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem'}}>🏠 {p.title}</span>
                        <span className="badge badge-soon">{formatDate(p.next_action_date)}</span>
                      </div>
                      {p.reminder_text && <div style={{fontSize:'0.78rem',color:'#b3e5fc',marginTop:4}}>📋 {p.reminder_text}</div>}
                    </Link>
                  ))}
                  {soonBuyers.map(b=>(
                    <Link key={b.id} href={`/dashboard/buyers/${b.id}`} onClick={dismissPopup}
                      style={{display:'flex',flexDirection:'column',padding:'10px 14px',background:'rgba(33,150,243,0.08)',border:'1px solid rgba(33,150,243,0.2)',borderRadius:10,color:'#fff',textDecoration:'none'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem'}}>👤 {b.first_name} {b.last_name}</span>
                        <span className="badge badge-soon">{formatDate(b.next_action_date)}</span>
                      </div>
                      <div style={{fontSize:'0.78rem',color:'#b3e5fc',marginTop:4}}>Traži: {b.desired_type||'neodređeno'} {b.location ? `— ${b.location}` : ''}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <button onClick={dismissPopup} style={{width:'100%',marginTop:8,padding:'12px',background:'var(--gold)',color:'#000',border:'none',borderRadius:10,fontWeight:700,fontSize:'0.95rem',cursor:'pointer',fontFamily:'Cinzel,serif',letterSpacing:1}}>
              ✓ RAZUMEM
            </button>
          </div>
        </div>
      )}
      {/* Stale Properties Alert (30+ days) */}
      {analytics?.staleProperties && analytics.staleProperties.length > 0 && (
        <div style={{marginBottom:24,background:'rgba(255,152,0,0.08)',border:'1px solid rgba(255,152,0,0.2)',borderRadius:12,padding:'16px 20px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <span style={{fontSize:20}}>⏳</span>
            <span style={{color:'#ffb74d',fontWeight:600,fontSize:'0.95rem'}}>Dugo na Tržištu — 30+ dana ({analytics.staleProperties.length})</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {analytics.staleProperties.map(p => (
              <Link key={p.id} href={`/dashboard/properties/${p.id}`}
                style={{color:'#fff',fontSize:'0.85rem',display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'rgba(0,0,0,0.15)',borderRadius:6}}>
                <span>🏠 {p.title} — {p.location}</span>
                <span style={{color:'#ffb74d',fontWeight:600,fontSize:'0.78rem'}}>{Math.round(p.days_active)} dana</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reminders Alert */}
      {(totalOverdue > 0 || totalSoon > 0) && (
        <div style={{marginBottom:24,borderRadius:12,overflow:'hidden'}}>
          {totalOverdue > 0 && (
            <div style={{background:'rgba(255,60,60,0.12)',border:'1px solid rgba(255,60,60,0.25)',borderRadius:totalSoon>0?'12px 12px 0 0':12,padding:'16px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:20}}>🚨</span>
                <span style={{color:'#ff6b6b',fontWeight:600,fontSize:'0.95rem'}}>Prosročeni Follow-up ({totalOverdue})</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {overdueProps.map(p => (
                  <Link key={p.id} href={`/dashboard/properties/${p.id}`}
                    style={{color:'#fff',fontSize:'0.85rem',display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'rgba(0,0,0,0.2)',borderRadius:6}}>
                    <span>🏠 {p.title}</span>
                    <span className="badge badge-overdue">{formatDate(p.next_action_date)}</span>
                  </Link>
                ))}
                {overdueBuyers.map(b => (
                  <Link key={b.id} href={`/dashboard/buyers/${b.id}`}
                    style={{color:'#fff',fontSize:'0.85rem',display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'rgba(0,0,0,0.2)',borderRadius:6}}>
                    <span>👤 {b.first_name} {b.last_name}</span>
                    <span className="badge badge-overdue">{formatDate(b.next_action_date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {totalSoon > 0 && (
            <div style={{background:'rgba(255,193,7,0.08)',border:'1px solid rgba(255,193,7,0.2)',borderRadius:totalOverdue>0?'0 0 12px 12px':12,padding:'16px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:20}}>⏰</span>
                <span style={{color:'#D4AF37',fontWeight:600,fontSize:'0.95rem'}}>Uskoro ({totalSoon})</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {soonProps.map(p => (
                  <Link key={p.id} href={`/dashboard/properties/${p.id}`}
                    style={{color:'#fff',fontSize:'0.85rem',display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'rgba(0,0,0,0.15)',borderRadius:6}}>
                    <span>🏠 {p.title}</span>
                    <span className="badge badge-soon">{formatDate(p.next_action_date)}</span>
                  </Link>
                ))}
                {soonBuyers.map(b => (
                  <Link key={b.id} href={`/dashboard/buyers/${b.id}`}
                    style={{color:'#fff',fontSize:'0.85rem',display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'rgba(0,0,0,0.15)',borderRadius:6}}>
                    <span>👤 {b.first_name} {b.last_name}</span>
                    <span className="badge badge-soon">{formatDate(b.next_action_date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon gold">🏠</div></div>
          <div className="stat-card-value">{properties.length}</div>
          <div className="stat-card-label">Ukupno Nekretnina</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon green">✓</div></div>
          <div className="stat-card-value">{activeProps}</div>
          <div className="stat-card-label">Aktivnih</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon blue">🔑</div></div>
          <div className="stat-card-value">{soldProps}</div>
          <div className="stat-card-label">Prodatih</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon gold">👤</div></div>
          <div className="stat-card-value">{buyers.length}</div>
          <div className="stat-card-label">Kupaca</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon red">⏰</div></div>
          <div className="stat-card-value">{totalOverdue}</div>
          <div className="stat-card-label">Prosročenih Akcija</div>
        </div>
      </div>

      {/* Analytics Charts */}
      {analytics && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:24}}>
          {/* Pipeline / Status */}
          <div className="table-card" style={{padding:24}}>
            <div className="table-title" style={{marginBottom:20}}>📊 Pipeline Nekretnina</div>
            <div style={{display:'flex',alignItems:'center',gap:30}}>
              <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
                <svg viewBox="0 0 36 36" style={{width:120,height:120,transform:'rotate(-90deg)'}}>
                  {(() => {
                    const total = analytics.byStatus.reduce((s,b) => s+b.count,0);
                    let offset = 0;
                    return analytics.byStatus.map((s, i) => {
                      const pct = total > 0 ? (s.count / total) * 100 : 0;
                      const dash = `${pct} ${100 - pct}`;
                      const el = <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={STATUS_COLORS[s.status]||COLORS[i]} strokeWidth="3.5" strokeDasharray={dash} strokeDashoffset={`-${offset}`} />;
                      offset += pct;
                      return el;
                    });
                  })()}
                </svg>
                <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:700}}>{properties.length}</div>
                  <div style={{fontSize:10,color:'var(--gray-300)'}}>UKUPNO</div>
                </div>
              </div>
              <div style={{flex:1}}>
                {analytics.byStatus.map((s, i) => (
                  <div key={s.status} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:STATUS_COLORS[s.status]||COLORS[i]}} />
                      <span style={{fontSize:'0.85rem'}}>{s.status}</span>
                    </div>
                    <span style={{fontWeight:600,color:'var(--gold)'}}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {analytics.totalValue > 0 && (
              <div style={{marginTop:20,padding:'12px 16px',background:'rgba(212,175,55,0.06)',borderRadius:8,border:'1px solid rgba(212,175,55,0.12)'}}>
                <div style={{fontSize:'0.75rem',color:'var(--gray-300)',marginBottom:4}}>Ukupna Vrednost Portfolija</div>
                <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--gold)'}}>€{analytics.totalValue.toLocaleString('sr-RS')}</div>
              </div>
            )}
          </div>

          {/* By Type */}
          <div className="table-card" style={{padding:24}}>
            <div className="table-title" style={{marginBottom:20}}>🏗️ Po Tipu</div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {analytics.byType.map((t, i) => {
                const max = Math.max(...analytics.byType.map(x=>x.count));
                return (
                  <div key={t.type}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{fontSize:'0.85rem'}}>{t.type}</span>
                      <span style={{fontWeight:600,color:'var(--gold)',fontSize:'0.85rem'}}>{t.count}</span>
                    </div>
                    <div style={{height:8,background:'rgba(255,255,255,0.05)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(t.count/max)*100}%`,background:COLORS[i],borderRadius:4,transition:'width 0.8s ease'}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price Ranges */}
          <div className="table-card" style={{padding:24}}>
            <div className="table-title" style={{marginBottom:20}}>💰 Cenovni Raspon</div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {analytics.priceRanges.map((r, i) => {
                const max = Math.max(...analytics.priceRanges.map(x=>x.count));
                return (
                  <div key={r.range}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{fontSize:'0.85rem'}}>{r.range}</span>
                      <span style={{fontWeight:600,color:'var(--gold)',fontSize:'0.85rem'}}>{r.count}</span>
                    </div>
                    <div style={{height:8,background:'rgba(255,255,255,0.05)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(r.count/max)*100}%`,background:COLORS[i%COLORS.length],borderRadius:4,transition:'width 0.8s ease'}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buyer Pipeline */}
          <div className="table-card" style={{padding:24}}>
            <div className="table-title" style={{marginBottom:20}}>👤 Pipeline Kupaca</div>
            <div style={{display:'flex',alignItems:'center',gap:30}}>
              <div style={{position:'relative',width:120,height:120,flexShrink:0}}>
                <svg viewBox="0 0 36 36" style={{width:120,height:120,transform:'rotate(-90deg)'}}>
                  {(() => {
                    const total = analytics.buyerPipeline.reduce((s,b) => s+b.count,0);
                    let offset = 0;
                    return analytics.buyerPipeline.map((s, i) => {
                      const pct = total > 0 ? (s.count / total) * 100 : 0;
                      const dash = `${pct} ${100 - pct}`;
                      const el = <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={STATUS_COLORS[s.status]||COLORS[i]} strokeWidth="3.5" strokeDasharray={dash} strokeDashoffset={`-${offset}`} />;
                      offset += pct;
                      return el;
                    });
                  })()}
                </svg>
                <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:700}}>{buyers.length}</div>
                  <div style={{fontSize:10,color:'var(--gray-300)'}}>KUPCI</div>
                </div>
              </div>
              <div style={{flex:1}}>
                {analytics.buyerPipeline.map((s, i) => (
                  <div key={s.status} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:STATUS_COLORS[s.status]||COLORS[i]}} />
                      <span style={{fontSize:'0.85rem'}}>{s.status}</span>
                    </div>
                    <span style={{fontWeight:600,color:'var(--gold)'}}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
        <div className="table-card">
          <div className="table-header">
            <div className="table-title">Poslednje Nekretnine</div>
            <Link href="/dashboard/properties" className="btn-outline btn-sm">Sve →</Link>
          </div>
          <div className="table-overflow">
            <table className="data-table">
              <thead><tr><th>Naslov</th><th>Cena</th><th>Status</th></tr></thead>
              <tbody>
                {properties.slice(0,5).map(p=>(
                  <tr key={p.id}>
                    <td><Link href={`/dashboard/properties/${p.id}`} style={{color:'#fff'}}>{p.title}</Link></td>
                    <td style={{color:'var(--gold)'}}>{formatPrice(p.price)}</td>
                    <td><span className={`badge ${p.status==='Aktivna'?'badge-active':p.status==='Prodato'?'badge-sold':'badge-negotiation'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div className="table-title">Akcije za Kupce</div>
            <Link href="/dashboard/buyers" className="btn-outline btn-sm">Svi →</Link>
          </div>
          <div className="table-overflow">
            <table className="data-table">
              <thead><tr><th>Kupac</th><th>Traži</th><th>Sledeća Akcija</th></tr></thead>
              <tbody>
                {buyers.filter(b=>b.next_action_date).slice(0,5).map(b=>(
                  <tr key={b.id}>
                    <td><Link href={`/dashboard/buyers/${b.id}`} style={{color:'#fff'}}>{b.first_name} {b.last_name}</Link></td>
                    <td>{b.desired_type}</td>
                    <td><span className={`badge ${getDateBadge(b.next_action_date)}`}>{formatDate(b.next_action_date)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
