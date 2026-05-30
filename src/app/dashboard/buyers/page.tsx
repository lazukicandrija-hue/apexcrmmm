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

const ROOM_OPTIONS = [
  { value: 'Garsonjera', label: 'G' },
  { value: 'Jednosoban', label: '1' },
  { value: 'Jednoiposoban', label: '1.5' },
  { value: 'Dvosoban', label: '2' },
  { value: 'Dvoiposoban', label: '2.5' },
  { value: 'Trosoban', label: '3' },
  { value: 'Troiposoban', label: '3.5' },
  { value: 'Četvorosoban', label: '4' },
  { value: '4+', label: '4+' },
];

const TYPE_OPTIONS = ['Stan', 'Kuća', 'Plac', 'Lokal'];

function parseArr(val: string): string[] {
  if (!val) return [];
  try { const arr = JSON.parse(val); return Array.isArray(arr) ? arr : [val]; } catch { return val ? [val] : []; }
}
function parseLocs(val: string): string[] {
  if (!val) return [];
  try { const arr = JSON.parse(val); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
function roomShort(room: string): string {
  return ROOM_OPTIONS.find(r => r.value === room)?.label || room;
}

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRooms, setFilterRooms] = useState('');
  const [filterBudgetMin, setFilterBudgetMin] = useState('');  const [filterBudgetMax, setFilterBudgetMax] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [form, setForm] = useState({
    full_name:'',phone:'',email:'',desired_type:[] as string[],location:'',
    budget:'',notes:'',next_action_date:'',status:'Aktivan',
    financing:'',desired_rooms:[] as string[],preferred_locations:[] as string[]
  });

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (filterStatus) p.set('status', filterStatus);
    fetch(`/api/buyers?${p}`).then(r=>r.json()).then(d=>setBuyers(d.buyers||[]));
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  // Client-side filtering for type, rooms, budget, location
  const filteredBuyers = buyers.filter(b => {
    if (filterType) {
      const types = parseArr(b.desired_type);
      if (!types.includes(filterType)) return false;
    }
    if (filterRooms) {
      const rooms = parseArr(b.desired_rooms);
      if (!rooms.includes(filterRooms)) return false;
    }
    if (filterBudgetMin || filterBudgetMax) {
      const budget = b.budget || 0;
      if (filterBudgetMin && budget < Number(filterBudgetMin)) return false;
      if (filterBudgetMax && budget > Number(filterBudgetMax)) return false;
    }
    if (filterLocation) {
      const locs = parseLocs(b.preferred_locations);
      if (!locs.includes(filterLocation)) return false;
    }
    return true;
  });

  const getFollowUp = (date: string) => {
    if (!date) return { icon: '⚪', cls: '', label: '-' };
    const d = new Date(date).toLocaleDateString('sr-RS');
    if (date < today) return { icon: '🔴', cls: 'badge-overdue', label: d };
    const diff = (new Date(date).getTime() - new Date(today).getTime()) / 86400000;
    if (diff <= 1) return { icon: '🟡', cls: 'badge-soon', label: d };
    return { icon: '🟢', cls: 'badge-future', label: d };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameParts = form.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    if (!firstName) { showToast('Unesite ime kupca','error'); return; }
    const res = await fetch('/api/buyers', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        first_name: firstName, last_name: lastName,
        phone: form.phone, email: form.email,
        desired_type: JSON.stringify(form.desired_type),
        desired_rooms: JSON.stringify(form.desired_rooms),
        financing: form.financing,
        budget: Number(form.budget)||null,
        location: form.location,
        preferred_locations: form.preferred_locations,
        notes: form.notes,
        next_action_date: form.next_action_date,
        status: form.status,
      })
    });
    if (res.ok) {
      showToast('Kupac kreiran!'); setShowModal(false); load();
      setForm({full_name:'',phone:'',email:'',desired_type:[],location:'',budget:'',notes:'',next_action_date:'',status:'Aktivan',financing:'',desired_rooms:[],preferred_locations:[]});
    } else { const d = await res.json(); showToast(d.error||'Greška','error'); }
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Obrisati kupca?')) return;
    await fetch(`/api/buyers/${id}`, {method:'DELETE'});
    showToast('Kupac obrisan'); load();
  };

  // Collect unique locations from all buyers for filter
  const allLocations = Array.from(new Set(buyers.flatMap(b => parseLocs(b.preferred_locations)))).sort();
  // Collect unique types from existing data + standard options
  const allTypes = Array.from(new Set(buyers.flatMap(b => parseArr(b.desired_type)).filter(Boolean)));
  const typeOptions = Array.from(new Set([...TYPE_OPTIONS, ...allTypes.filter(t => !TYPE_OPTIONS.includes(t))]));

  const hasFilters = filterType || filterRooms || filterBudgetMin || filterBudgetMax || filterLocation;

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="table-card">
        <div className="table-header">
          <div className="table-title">Kupci ({filteredBuyers.length}{hasFilters ? ` / ${buyers.length}` : ''})</div>
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
              {typeOptions.map(t => <option key={t}>{t}</option>)}
            </select>
            <a href="/api/export/buyers" className="btn-outline btn-sm">📥 CSV</a>
            <button className="btn-gold btn-sm" onClick={()=>setShowModal(true)}>+ Dodaj</button>
          </div>
        </div>
        {/* Filter row 2 - rooms, budget, location */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'0 20px 14px',borderBottom:'1px solid rgba(212,175,55,0.08)'}}>
          <select className="filter-select" value={filterRooms} onChange={e=>setFilterRooms(e.target.value)} style={{fontSize:'0.78rem',padding:'5px 24px 5px 8px'}}>
            <option value="">Sve sobe</option>
            {ROOM_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.value})</option>)}
          </select>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:'0.72rem',color:'var(--gray-400)',whiteSpace:'nowrap'}}>Budžet €</span>
            <input type="number" placeholder="Od" value={filterBudgetMin} onChange={e=>setFilterBudgetMin(e.target.value)} style={{width:80,fontSize:'0.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid rgba(212,175,55,0.15)',background:'rgba(255,255,255,0.04)',color:'#fff',outline:'none'}} />
            <span style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>–</span>
            <input type="number" placeholder="Do" value={filterBudgetMax} onChange={e=>setFilterBudgetMax(e.target.value)} style={{width:80,fontSize:'0.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid rgba(212,175,55,0.15)',background:'rgba(255,255,255,0.04)',color:'#fff',outline:'none'}} />
          </div>
          <select className="filter-select" value={filterLocation} onChange={e=>setFilterLocation(e.target.value)} style={{fontSize:'0.78rem',padding:'5px 24px 5px 8px'}}>
            <option value="">Sve lokacije</option>
            {allLocations.map(l => <option key={l}>{l}</option>)}
          </select>
          {hasFilters && (
            <button onClick={()=>{setFilterType('');setFilterRooms('');setFilterBudgetMin('');setFilterBudgetMax('');setFilterLocation('');}} style={{fontSize:'0.75rem',padding:'4px 10px',borderRadius:6,background:'rgba(255,77,77,0.1)',border:'1px solid rgba(255,77,77,0.2)',color:'#ff6b6b',cursor:'pointer'}}>✕ Resetuj filtere</button>
          )}
        </div>
        <div className="table-overflow">
          <table className="data-table">
            <thead><tr>
              <th>Ime</th><th>Telefon</th><th>Tip</th><th>Sobe</th><th>Lokacije</th><th>Budžet</th><th>Sledeća Akcija</th><th>Status</th><th>Akcije</th>
            </tr></thead>
            <tbody>
              {filteredBuyers.map(b => {
                const types = parseArr(b.desired_type);
                const rooms = parseArr(b.desired_rooms);
                const locs = parseLocs(b.preferred_locations);
                const fu = getFollowUp(b.next_action_date);
                return (
                  <tr key={b.id}>
                    <td><Link href={`/dashboard/buyers/${b.id}`} style={{color:'#fff',fontWeight:500}}>{b.first_name} {b.last_name}</Link></td>
                    <td style={{fontSize:'0.85rem'}}>{b.phone}</td>
                    <td style={{fontSize:'0.8rem'}}>{types.length > 0 ? types.join(', ') : '-'}</td>
                    <td style={{fontSize:'0.85rem',color:'var(--gold)',fontWeight:500}}>{rooms.length > 0 ? rooms.map(r => roomShort(r)).join(', ') : '-'}</td>
                    <td>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3,maxWidth:220}}>
                        {locs.length > 0 ? locs.slice(0,4).map(l => (
                          <span key={l} style={{fontSize:'0.65rem',padding:'1px 6px',borderRadius:10,background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.15)',color:'var(--gold)',whiteSpace:'nowrap'}}>{l}</span>
                        )) : <span style={{color:'var(--gray-400)',fontSize:'0.8rem'}}>-</span>}
                        {locs.length > 4 && <span style={{fontSize:'0.65rem',color:'var(--gray-300)'}}>+{locs.length-4}</span>}
                      </div>
                    </td>
                    <td style={{color:'var(--gold)'}}>€{b.budget?.toLocaleString('sr-RS')||'-'}</td>
                    <td>
                      <span className={`badge ${fu.cls}`} style={{fontSize:'0.75rem'}}>
                        {fu.icon} {fu.label}
                      </span>
                    </td>
                    <td><span className={`badge ${b.status==='Aktivan'?'badge-active':b.status==='Pauzirana Potraga'?'badge-negotiation':'badge-sold'}`}>{b.status}</span></td>
                    <td><button className="btn-danger btn-sm" onClick={()=>handleDelete(b.id)}>🗑</button></td>
                  </tr>
                );
              })}
              {filteredBuyers.length===0 && <tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'var(--gray-300)'}}>{buyers.length > 0 ? 'Nema kupaca sa ovim filterima' : 'Nema kupaca'}</td></tr>}
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
                {/* Multi-select tip nekretnine */}
                <div className="form-group">
                  <label>Tip Nekretnine</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
                    {TYPE_OPTIONS.map(t => {
                      const sel = form.desired_type.includes(t);
                      return (
                        <label key={t} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.82rem',padding:'5px 14px',borderRadius:20,cursor:'pointer',userSelect:'none',
                          background:sel?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.04)',
                          border:`1px solid ${sel?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.08)'}`,
                          color:sel?'var(--gold)':'var(--gray-300)',transition:'all 0.15s',fontWeight:sel?600:400}}>
                          <input type="checkbox" checked={sel} onChange={e=>{
                            setForm({...form, desired_type: e.target.checked ? [...form.desired_type, t] : form.desired_type.filter(x=>x!==t)});
                          }} style={{display:'none'}} />
                          {sel?'✓ ':''}{t}
                        </label>
                      );
                    })}
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
                <div className="form-group"><label>Sledeća Akcija</label><input className="form-input" type="date" value={form.next_action_date} onChange={e=>setForm({...form,next_action_date:e.target.value})} /></div>
                {/* Multi-select sobe */}
                <div className="form-group">
                  <label>Željene Sobe</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
                    {ROOM_OPTIONS.map(r => {
                      const sel = form.desired_rooms.includes(r.value);
                      return (
                        <label key={r.value} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.82rem',padding:'5px 14px',borderRadius:20,cursor:'pointer',userSelect:'none',
                          background:sel?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.04)',
                          border:`1px solid ${sel?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.08)'}`,
                          color:sel?'var(--gold)':'var(--gray-300)',transition:'all 0.15s',fontWeight:sel?600:400}}>
                          <input type="checkbox" checked={sel} onChange={e=>{
                            setForm({...form, desired_rooms: e.target.checked ? [...form.desired_rooms, r.value] : form.desired_rooms.filter(x=>x!==r.value)});
                          }} style={{display:'none'}} />
                          {sel?'✓ ':''}{r.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                {/* Multi-select lokacije */}
                <div className="form-group">
                  <label>Željene Lokacije</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6,maxHeight:140,overflowY:'auto',padding:8,background:'rgba(255,255,255,0.03)',borderRadius:8,border:'1px solid rgba(212,175,55,0.1)'}}>
                    {NOVI_SAD_LOKACIJE.map(loc=>{
                      const sel = form.preferred_locations.includes(loc);
                      return (
                        <label key={loc} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.78rem',padding:'4px 10px',borderRadius:16,cursor:'pointer',userSelect:'none',
                          background:sel?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.04)',
                          border:`1px solid ${sel?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.08)'}`,
                          color:sel?'var(--gold)':'var(--gray-300)',transition:'all 0.15s'}}>
                          <input type="checkbox" checked={sel} onChange={e=>{
                            setForm({...form, preferred_locations: e.target.checked ? [...form.preferred_locations, loc] : form.preferred_locations.filter(l=>l!==loc)});
                          }} style={{display:'none'}} />
                          {sel?'✓ ':''}{loc}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                    <option>Aktivan</option><option>Pauzirana Potraga</option><option>Kupio Stan</option>
                  </select>
                </div>
                <div className="form-group"><label>Napomena</label><textarea className="form-textarea" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Nešto specifično što je kupac rekao..." /></div>
                <div className="form-group"><label>Detaljne Napomene</label><textarea className="form-textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Šta traži, posebni zahtevi..." /></div>
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
