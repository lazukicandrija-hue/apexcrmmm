'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Buyer {
  id:string; first_name:string; last_name:string; phone:string; email:string;
  desired_type:string; location:string; budget:number; notes:string;
  next_action_date:string; status:string; created_at:string;
  financing:string; desired_rooms:string; preferred_locations:string;
}

const NOVI_SAD_LOKACIJE = [
  'Centar','Stari Grad','Liman I','Liman II','Liman III','Liman IV',
  'Grbavica','Novo Naselje','Telep','Detelinara','Podbara','Rotkvarija',
  'Sajmište','Salajka','Petrovaradin','Sremska Kamenica',
  'Adamovićevo Naselje','Satelit','Klisa','Veternik','Futog',
  'Adice','Avijatičarsko Naselje','Vidovdansko Naselje','Bistrica','Banatic',
  'Šangaj','Somborski Bulevar','Bulevar Oslobođenja',
  'Kej','Riblja Pijaca','Šarengrad','Karadjordjevo','Slana Bara',
  'Industrijska Zona','Rimski Šančevi','Stepanovićevo','Čenej',
  'Kovilj','Begeč','Ledinci','Paragovo','Popovica','Bukovac',
];

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [form, setForm] = useState({
    full_name:'',phone:'',email:'',desired_type:'',location:'',
    budget:'',notes:'',next_action_date:'',status:'Aktivan',
    financing:'',desired_rooms:'',preferred_locations:[] as string[]
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
    const nameParts = form.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    if (!firstName) { showToast('Unesite ime kupca','error'); return; }
    const res = await fetch('/api/buyers', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...form, first_name: firstName, last_name: lastName, budget:Number(form.budget)||null})
    });
    if (res.ok) {
      showToast('Kupac kreiran!'); setShowModal(false); load();
      setForm({full_name:'',phone:'',email:'',desired_type:'',location:'',budget:'',notes:'',next_action_date:'',status:'Aktivan',financing:'',desired_rooms:'',preferred_locations:[]});
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
            <thead><tr><th>Ime</th><th>Telefon</th><th>Traži</th><th>Sobe</th><th>Finansiranje</th><th>Budžet</th><th>Sledeća Akcija</th><th>Status</th><th>Akcije</th></tr></thead>
            <tbody>
              {buyers.map(b=>(
                <tr key={b.id}>
                  <td><Link href={`/dashboard/buyers/${b.id}`} style={{color:'#fff',fontWeight:500}}>{b.first_name} {b.last_name}</Link></td>
                  <td style={{fontSize:'0.85rem'}}>{b.phone}</td>
                  <td><span className="badge badge-new">{b.desired_type||'-'}</span></td>
                  <td style={{fontSize:'0.85rem'}}>{b.desired_rooms||'-'}</td>
                  <td><span style={{fontSize:'0.78rem',padding:'3px 8px',borderRadius:6,background:b.financing==='Keš'?'rgba(76,175,80,0.12)':b.financing==='Kredit'?'rgba(33,150,243,0.12)':b.financing==='Kombinovano'?'rgba(255,152,0,0.12)':'transparent',color:b.financing==='Keš'?'#66bb6a':b.financing==='Kredit'?'#64b5f6':b.financing==='Kombinovano'?'#ffb74d':'var(--gray-300)'}}>{b.financing||'-'}</span></td>
                  <td style={{color:'var(--gold)'}}>€{b.budget?.toLocaleString('sr-RS')||'-'}</td>
                  <td><span className={`badge ${getDateBadge(b.next_action_date)}`}>{getDateLabel(b.next_action_date)}</span></td>
                  <td><span className={`badge ${b.status==='Aktivan'?'badge-active':b.status==='Pauzirana Potraga'?'badge-negotiation':'badge-sold'}`}>{b.status}</span></td>
                  <td><button className="btn-danger btn-sm" onClick={()=>handleDelete(b.id)}>🗑</button></td>
                </tr>
              ))}
              {buyers.length===0 && <tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'var(--gray-300)'}}>Nema kupaca</td></tr>}
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
                <div className="form-group"><label>Ime i Prezime *</label><input className="form-input" required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Npr. Marko Marković" /></div>
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
                  <div className="form-group">
                    <label>Željena Sobnost</label>
                    <select className="form-select" value={form.desired_rooms} onChange={e=>setForm({...form,desired_rooms:e.target.value})}>
                      <option value="">-</option><option>Garsonjera</option><option>Jednosoban</option><option>Jednoiposoban</option><option>Dvosoban</option><option>Dvoiposoban</option><option>Trosoban</option><option>Troiposoban</option><option>Četvorosoban</option><option>4+</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Način Finansiranja</label>
                    <select className="form-select" value={form.financing} onChange={e=>setForm({...form,financing:e.target.value})}>
                      <option value="">-</option><option>Keš</option><option>Kredit</option><option>Kombinovano</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Budžet (€)</label><input className="form-input" type="number" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Lokacija (tekst)</label><input className="form-input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Centar, Novi Sad" /></div>
                  <div className="form-group"><label>Sledeća Akcija</label><input className="form-input" type="date" value={form.next_action_date} onChange={e=>setForm({...form,next_action_date:e.target.value})} /></div>
                </div>
                <div className="form-group">
                  <label>Željene Lokacije (delovi grada)</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6,maxHeight:140,overflowY:'auto',padding:8,background:'rgba(255,255,255,0.03)',borderRadius:8,border:'1px solid rgba(212,175,55,0.1)'}}>
                    {NOVI_SAD_LOKACIJE.map(loc=>(
                      <label key={loc} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.78rem',padding:'4px 10px',borderRadius:16,cursor:'pointer',userSelect:'none',
                        background:form.preferred_locations.includes(loc)?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.04)',
                        border:`1px solid ${form.preferred_locations.includes(loc)?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.08)'}`,
                        color:form.preferred_locations.includes(loc)?'var(--gold)':'var(--gray-300)',transition:'all 0.15s'}}>
                        <input type="checkbox" checked={form.preferred_locations.includes(loc)} onChange={e=>{
                          setForm({...form, preferred_locations: e.target.checked ? [...form.preferred_locations, loc] : form.preferred_locations.filter(l=>l!==loc)});
                        }} style={{display:'none'}} />
                        {form.preferred_locations.includes(loc)?'✓ ':''}{loc}
                      </label>
                    ))}
                  </div>
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
