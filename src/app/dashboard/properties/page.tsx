'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Property {
  id:string; title:string; location:string; price:number; type:string; area:number;
  rooms:number; status:string; published:number; owner_first_name:string; owner_last_name:string;
  owner_phone:string; created_at:string; contract_signed:number;
}
interface Owner { id:string; first_name:string; last_name:string; phone:string; email:string; }

const CATEGORY_LABELS: Record<string, string> = {
  'Novogradnja': 'Novogradnja',
  'Starogradnja': 'Starogradnja',
  'Lokali': 'Lokali',
  'Rente': 'Rente',
};

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

function PropertiesPageInner() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') || '';

  const [properties, setProperties] = useState<Property[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({minPrice:'',maxPrice:'',minRooms:'',maxRooms:'',minArea:'',maxArea:'',floor:'',parking:'',heating:'',terrace:'',owner:'',location:''});
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [form, setForm] = useState({
    title:'',description:'',location:'',price:'',type:category || 'Novogradnja',area:'',rooms:'',
    status:'Aktivna',owner_id:'',newOwnerFirst:'',newOwnerLast:'',newOwnerPhone:'',
    newOwnerEmail:'',newOwnerNotes:'',createNewOwner:false,
    floor:'',condition:'',parking:'',terrace:'',heating:''
  });

  // Update default form type when category changes
  useEffect(() => {
    if (category) {
      setForm(f => ({...f, type: category}));
    }
  }, [category]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('type', category);
    if (filterStatus) params.set('status', filterStatus);
    // Advanced filters
    Object.entries(advFilters).forEach(([k,v]) => { if (v) params.set(k, v); });
    fetch(`/api/properties?${params}`).then(r=>r.json()).then(d=>setProperties(d.properties||[]));
    fetch('/api/owners').then(r=>r.json()).then(d=>setOwners(d.owners||[]));
  }, [search, category, filterStatus, advFilters]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ownerId = form.owner_id;

    if (form.createNewOwner) {
      const res = await fetch('/api/owners', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({first_name:form.newOwnerFirst,last_name:form.newOwnerLast,phone:form.newOwnerPhone,email:form.newOwnerEmail,notes:form.newOwnerNotes})
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error,'error'); return; }
      ownerId = d.id;
    }

    if (!ownerId) { showToast('Izaberite vlasnika','error'); return; }

    const res = await fetch('/api/properties', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...form, price:Number(form.price), area:Number(form.area)||null, rooms:Number(form.rooms)||null, owner_id:ownerId, images:[]})
    });
    if (res.ok) { showToast('Nekretnina kreirana!'); setShowModal(false); load();
      setForm({title:'',description:'',location:'',price:'',type:category || 'Novogradnja',area:'',rooms:'',status:'Aktivna',owner_id:'',newOwnerFirst:'',newOwnerLast:'',newOwnerPhone:'',newOwnerEmail:'',newOwnerNotes:'',createNewOwner:false,floor:'',condition:'',parking:'',terrace:'',heating:''});
    } else { const d = await res.json(); showToast(d.error||'Greška','error'); }
  };

  const togglePublish = async (id:string) => {
    const res = await fetch(`/api/properties/${id}/publish`, {method:'POST'});
    if (res.ok) { const d = await res.json(); showToast(d.message); load(); }
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Obrisati nekretninu?')) return;
    await fetch(`/api/properties/${id}`, {method:'DELETE'});
    showToast('Nekretnina obrisana'); load();
  };

  const formatPrice = (p:number) => p >= 1000 ? `€${p.toLocaleString('sr-RS')}` : `€${p}/mes`;

  const pageTitle = CATEGORY_LABELS[category] || 'Sve Nekretnine';
  const isRente = category === 'Rente';

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="table-card">
        <div className="table-header">
          <div className="table-title">{pageTitle} ({properties.length})</div>
          <div className="table-actions">
            <div className="search-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input className="search-input" placeholder="Pretraži..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="">Svi statusi</option>
              <option>Aktivna</option><option>Prodato</option><option>U pregovoru</option>
            </select>
            <button className="btn-outline btn-sm" onClick={()=>setShowAdvanced(!showAdvanced)}>🔍 {showAdvanced?'Sakrij':'Filteri'}</button>
            <a href="/api/export/properties" className="btn-outline btn-sm">📥 CSV</a>
            <button className="btn-gold btn-sm" onClick={()=>setShowModal(true)}>+ Dodaj</button>
          </div>
        </div>
        {showAdvanced && (
          <div style={{background:'rgba(212,175,55,0.04)',border:'1px solid rgba(212,175,55,0.1)',borderRadius:12,padding:16,marginBottom:16,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:10}}>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Cena od (€)</label><input className="form-input" type="number" placeholder="Min" value={advFilters.minPrice} onChange={e=>setAdvFilters({...advFilters,minPrice:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Cena do (€)</label><input className="form-input" type="number" placeholder="Max" value={advFilters.maxPrice} onChange={e=>setAdvFilters({...advFilters,maxPrice:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Sobe od</label><input className="form-input" type="number" placeholder="Min" value={advFilters.minRooms} onChange={e=>setAdvFilters({...advFilters,minRooms:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Sobe do</label><input className="form-input" type="number" placeholder="Max" value={advFilters.maxRooms} onChange={e=>setAdvFilters({...advFilters,maxRooms:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>m² od</label><input className="form-input" type="number" placeholder="Min" value={advFilters.minArea} onChange={e=>setAdvFilters({...advFilters,minArea:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>m² do</label><input className="form-input" type="number" placeholder="Max" value={advFilters.maxArea} onChange={e=>setAdvFilters({...advFilters,maxArea:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Sprat</label><input className="form-input" placeholder="Npr. 3" value={advFilters.floor} onChange={e=>setAdvFilters({...advFilters,floor:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Parking</label><select className="form-select" value={advFilters.parking} onChange={e=>setAdvFilters({...advFilters,parking:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Svi</option><option>Garaža</option><option>Parking mesto</option><option>Nema</option></select></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Grejanje</label><select className="form-select" value={advFilters.heating} onChange={e=>setAdvFilters({...advFilters,heating:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Svi</option><option>Centralno</option><option>Etažno</option><option>Gas</option><option>Klima</option></select></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Terasa</label><select className="form-select" value={advFilters.terrace} onChange={e=>setAdvFilters({...advFilters,terrace:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Svi</option><option>Da</option><option>Nema</option></select></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Vlasnik</label><input className="form-input" placeholder="Ime ili prezime" value={advFilters.owner} onChange={e=>setAdvFilters({...advFilters,owner:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Lokacija</label><select className="form-select" value={advFilters.location} onChange={e=>setAdvFilters({...advFilters,location:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Sve</option>{NOVI_SAD_LOKACIJE.map(l=><option key={l}>{l}</option>)}</select></div>
            <div style={{display:'flex',alignItems:'flex-end'}}><button className="btn-outline btn-sm" onClick={()=>setAdvFilters({minPrice:'',maxPrice:'',minRooms:'',maxRooms:'',minArea:'',maxArea:'',floor:'',parking:'',heating:'',terrace:'',owner:'',location:''})}>✕ Resetuj</button></div>
          </div>
        )}
        <div className="table-overflow">
          <table className="data-table">
            <thead>
              <tr>
                <th>Naslov</th>
                <th>Lokacija</th>
                <th>{isRente ? 'Mesečno' : 'Cena'}</th>
                {!category && <th>Tip</th>}
                <th>m²</th>
                <th>Status</th>
                <th>Ugovor</th>
                <th>Vlasnik</th>
                <th>Sajt</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {properties.map(p=>(
                <tr key={p.id}>
                  <td><Link href={`/dashboard/properties/${p.id}`} style={{color:'#fff',fontWeight:500}}>{p.title}</Link></td>
                  <td style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>{p.location}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{formatPrice(p.price)}</td>
                  {!category && <td><span className="badge badge-new">{p.type}</span></td>}
                  <td>{p.area}m²</td>
                  <td><span className={`badge ${p.status==='Aktivna'?'badge-active':p.status==='Prodato'?'badge-sold':'badge-negotiation'}`}>{p.status}</span></td>
                  <td><span style={{fontSize:'0.78rem',fontWeight:600,padding:'3px 8px',borderRadius:6,
                    background: p.contract_signed ? 'rgba(76,175,80,0.12)' : 'rgba(255,152,0,0.1)',
                    color: p.contract_signed ? '#66bb6a' : '#ffb74d'
                  }}>{p.contract_signed ? '✓ Da' : '✕ Ne'}</span></td>
                  <td style={{fontSize:'0.85rem'}}>{p.owner_first_name} {p.owner_last_name}<br/><span style={{color:'var(--gray-300)',fontSize:'0.75rem'}}>{p.owner_phone}</span></td>
                  <td><button className={`publish-toggle ${p.published?'published':'unpublished'}`} onClick={()=>togglePublish(p.id)}>{p.published?'✓ Objavljeno':'Objavi'}</button></td>
                  <td><button className="btn-danger btn-sm" onClick={()=>handleDelete(p.id)}>🗑</button></td>
                </tr>
              ))}
              {properties.length===0 && <tr><td colSpan={category ? 9 : 10} style={{textAlign:'center',padding:40,color:'var(--gray-300)'}}>Nema nekretnina u kategoriji {pageTitle}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nova {pageTitle === 'Rente' ? 'Renta' : 'Nekretnina'}{category ? ` — ${pageTitle}` : ''}</div>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Naslov *</label>
                  <input className="form-input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={isRente ? 'Npr. Garsonjera — Grbavica' : 'Npr. Trosoban Stan — Centar'} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Lokacija *</label>
                    <select className="form-select" required value={form.location} onChange={e=>setForm({...form,location:e.target.value})}>
                      <option value="">Izaberite deo grada</option>
                      {NOVI_SAD_LOKACIJE.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{isRente ? 'Mesečna Cena (€) *' : 'Cena (€) *'}</label>
                    <input className="form-input" type="number" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tip</label>
                    <select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                      <option>Novogradnja</option><option>Starogradnja</option><option>Lokali</option><option>Rente</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select className="form-select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                      <option>Aktivna</option><option>Prodato</option><option>U pregovoru</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Površina (m²)</label>
                    <input className="form-input" type="number" value={form.area} onChange={e=>setForm({...form,area:e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Broj Soba</label>
                    <input className="form-input" type="number" value={form.rooms} onChange={e=>setForm({...form,rooms:e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Opis</label>
                  <textarea className="form-textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Opis nekretnine..." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Sprat</label>
                    <input className="form-input" value={form.floor} onChange={e=>setForm({...form,floor:e.target.value})} placeholder="Npr. 5. sprat" />
                  </div>
                  <div className="form-group">
                    <label>Stanje</label>
                    <select className="form-select" value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}>
                      <option value="">-</option>
                      <option>Renoviran</option><option>Useljiv</option><option>Potrebna Adaptacija</option><option>U izgradnji</option><option>Lux</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Parking</label>
                    <select className="form-select" value={form.parking} onChange={e=>setForm({...form,parking:e.target.value})}>
                      <option value="">-</option>
                      <option>Garaža</option><option>Parking mesto</option><option>Ulica</option><option>Nema</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Terasa</label>
                    <select className="form-select" value={form.terrace} onChange={e=>setForm({...form,terrace:e.target.value})}>
                      <option value="">-</option>
                      <option>Da</option><option>2 terase</option><option>Lodža</option><option>Balkon</option><option>Nema</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Grejanje</label>
                  <select className="form-select" value={form.heating} onChange={e=>setForm({...form,heating:e.target.value})}>
                    <option value="">-</option>
                    <option>Centralno</option><option>Etažno</option><option>Gas</option><option>Klima</option><option>TA peć</option>
                  </select>
                </div>

                <div style={{borderTop:'1px solid rgba(212,175,55,0.1)',margin:'20px 0',paddingTop:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <label style={{color:'var(--gold)',fontFamily:'Cinzel,serif',fontSize:'0.95rem'}}>Vlasnik</label>
                    <button type="button" className="btn-outline btn-sm" onClick={()=>setForm({...form,createNewOwner:!form.createNewOwner})}>
                      {form.createNewOwner ? 'Izaberi Postojećeg' : '+ Novi Vlasnik'}
                    </button>
                  </div>

                  {!form.createNewOwner ? (
                    <div className="form-group">
                      <select className="form-select" value={form.owner_id} onChange={e=>setForm({...form,owner_id:e.target.value})} required>
                        <option value="">Izaberite vlasnika</option>
                        {owners.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name} — {o.phone}</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="form-row">
                        <div className="form-group"><label>Ime *</label><input className="form-input" required value={form.newOwnerFirst} onChange={e=>setForm({...form,newOwnerFirst:e.target.value})} /></div>
                        <div className="form-group"><label>Prezime *</label><input className="form-input" required value={form.newOwnerLast} onChange={e=>setForm({...form,newOwnerLast:e.target.value})} /></div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>Telefon</label><input className="form-input" value={form.newOwnerPhone} onChange={e=>setForm({...form,newOwnerPhone:e.target.value})} /></div>
                        <div className="form-group"><label>Email</label><input className="form-input" value={form.newOwnerEmail} onChange={e=>setForm({...form,newOwnerEmail:e.target.value})} /></div>
                      </div>
                      <div className="form-group"><label>Napomene</label><textarea className="form-textarea" value={form.newOwnerNotes} onChange={e=>setForm({...form,newOwnerNotes:e.target.value})} /></div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={()=>setShowModal(false)}>Otkaži</button>
                <button type="submit" className="btn-gold">Kreiraj</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div />}>
      <PropertiesPageInner />
    </Suspense>
  );
}
