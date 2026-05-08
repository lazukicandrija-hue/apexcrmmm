'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Property { id:string; title:string; location:string; price:number; type:string; status:string; created_at:string; next_action_date:string; }
interface Buyer { id:string; first_name:string; last_name:string; next_action_date:string; status:string; desired_type:string; }
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
  const totalOverdue = overdueBuyers.length + overdueProps.length;
  const totalSoon = soonBuyers.length + soonProps.length;

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
