'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Buyer {
  id:string; first_name:string; last_name:string; phone:string; email:string;
  desired_type:string; location:string; budget:number; notes:string;
  next_action_date:string; status:string; created_at:string;
}

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [form, setForm] = useState({
    first_name:'',last_name:'',phone:'',email:'',desired_type:'',location:'',
    budget:'',notes:'',next_action_date:'',status:'Aktivan'
  });

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (filterStatus) p.set('status', filterStatus);
    if (filterType) p.set('type', filterType);
    fetch(`/api/buyers?${p}`).then(r=>r.json()).then(d=>setBuyers(d.buyers||[]));
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const getDateBadge = (date:string) => {
    if (!date) return '';
    if (date < today) return 'badge-overdue';
    const diff = (new Date(date).getTime() - new Date(today).getTime()) / 86400000;
    return diff <= 2 ? 'badge-soon' : 'badge-future';
  };

  const getDateLabel = (date:string) => {
    if (!date) return '-';
    if (date < today) return `⚠️ ${new Date(date).toLocaleDateString('sr-RS')}`;
    return new Date(date).toLocaleDateString('sr-RS');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/buyers', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...form, budget:Number(form.budget)||null})
    });
    if (res.ok) {
      showToast('Kupac kreiran!'); setShowModal(false); load();
      setForm({first_name:'',last_name:'',phone:'',email:'',desired_type:'',location:'',budget:'',notes:'',next_action_date:'',status:'Aktivan'});
    } else { const d = await res.json(); showToast(d.error||'Greška','error'); }
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Obrisati kupca?')) return;
    await fetch(`/api/buyers/${id}`, {method:'DELETE'});
    showToast('Kupac obrisan'); load();
  };

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="table-card">
        <div className="table-header">
          <div className="table-title">Kupci ({buyers.length})</div>
          <div className="table-actions">
            <div className="search-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input className="search-input" placeholder="Pretraži..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="">Svi statusi</option>
              <option>Aktivan</option><option>Pauzirana Potraga</option><option>Kupio Stan</option>
            </select>
            <select className="filter-select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="">Svi tipovi</option>
              <option>Novogradnja</option><option>Starogradnja</option><option>Rente</option><option>Lokali</option>
            </select>
            <a href="/api/export/buyers" className="btn-outline btn-sm">📥 CSV</a>
            <button className="btn-gold btn-sm" onClick={()=>setShowModal(true)}>+ Dodaj</button>
          </div>
        </div>
        <div className="table-overflow">
          <table className="data-table">
            <thead><tr><th>Ime</th><th>Telefon</th><th>Traži</th><th>Lokacija</th><th>Budžet</th><th>Sledeća Akcija</th><th>Status</th><th>Akcije</th></tr></thead>
            <tbody>
              {buyers.map(b=>(
                <tr key={b.id}>
                  <td><Link href={`/dashboard/buyers/${b.id}`} style={{color:'#fff',fontWeight:500}}>{b.first_name} {b.last_name}</Link></td>
                  <td style={{fontSize:'0.85rem'}}>{b.phone}</td>
                  <td><span className="badge badge-new">{b.desired_type||'-'}</span></td>
                  <td style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>{b.location||'-'}</td>
                  <td style={{color:'var(--gold)'}}>€{b.budget?.toLocaleString('sr-RS')||'-'}</td>
                  <td><span className={`badge ${getDateBadge(b.next_action_date)}`}>{getDateLabel(b.next_action_date)}</span></td>
                  <td><span className={`badge ${b.status==='Aktivan'?'badge-active':b.status==='Pauzirana Potraga'?'badge-negotiation':'badge-sold'}`}>{b.status}</span></td>
                  <td><button className="btn-danger btn-sm" onClick={()=>handleDelete(b.id)}>🗑</button></td>
                </tr>
              ))}
              {buyers.length===0 && <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--gray-300)'}}>Nema kupaca</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Novi Kupac</div>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Ime *</label><input className="form-input" required value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} /></div>
                  <div className="form-group"><label>Prezime *</label><input className="form-input" required value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Telefon</label><input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
                  <div className="form-group"><label>Email</label><input className="form-input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Traženi Tip</label>
                    <select className="form-select" value={form.desired_type} onChange={e=>setForm({...form,desired_type:e.target.value})}>
                      <option value="">-</option><option>Novogradnja</option><option>Starogradnja</option><option>Rente</option><option>Lokali</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Lokacija</label><input className="form-input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Centar, Novi Sad" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Budžet (€)</label><input className="form-input" type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} /></div>
                  <div className="form-group"><label>Sledeća Akcija</label><input className="form-input" type="date" value={form.next_action_date} onChange={e=>setForm({...form,next_action_date:e.target.value})} /></div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                    <option>Aktivan</option><option>Pauzirana Potraga</option><option>Kupio Stan</option>
                  </select>
                </div>
                <div className="form-group"><label>Napomene</label><textarea className="form-textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Šta traži, posebni zahtevi..." /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={()=>setShowModal(false)}>Otkaži</button>
                <button type="submit" className="btn-gold">Kreiraj Kupca</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
