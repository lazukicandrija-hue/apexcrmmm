'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Property { id:string; title:string; location:string; price:number; type:string; status:string; created_at:string; }
interface Buyer { id:string; first_name:string; last_name:string; next_action_date:string; status:string; desired_type:string; }

export default function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);

  useEffect(() => {
    fetch('/api/properties').then(r=>r.json()).then(d=>setProperties(d.properties||[]));
    fetch('/api/buyers').then(r=>r.json()).then(d=>setBuyers(d.buyers||[]));
  }, []);

  const activeProps = properties.filter(p => p.status === 'Aktivna').length;
  const soldProps = properties.filter(p => p.status === 'Prodato').length;
  const today = new Date().toISOString().split('T')[0];
  const overdueBuyers = buyers.filter(b => b.next_action_date && b.next_action_date < today).length;

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
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon gold">🏠</div>
          </div>
          <div className="stat-card-value">{properties.length}</div>
          <div className="stat-card-label">Ukupno Nekretnina</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">✓</div>
          </div>
          <div className="stat-card-value">{activeProps}</div>
          <div className="stat-card-label">Aktivnih</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🔑</div>
          </div>
          <div className="stat-card-value">{soldProps}</div>
          <div className="stat-card-label">Prodatih</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon gold">👤</div>
          </div>
          <div className="stat-card-value">{buyers.length}</div>
          <div className="stat-card-label">Kupaca</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">⏰</div>
          </div>
          <div className="stat-card-value">{overdueBuyers}</div>
          <div className="stat-card-label">Prosročenih Akcija</div>
        </div>
      </div>

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
