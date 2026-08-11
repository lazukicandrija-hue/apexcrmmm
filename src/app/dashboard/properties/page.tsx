'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Property {
  id:string; code:string; title:string; location:string; price:number; type:string; area:number;
  rooms:number; status:string; published:number; owner_first_name:string; owner_last_name:string;
  owner_phone:string; created_at:string; contract_signed:number; project_id:string|null;
  featured_order:number|null;
}
interface Owner { id:string; first_name:string; last_name:string; phone:string; email:string; }
interface Project { id:string; name:string; location:string; description:string; developer:string; total_units:number; unit_count:number; sold_count:number; published:number; }

const CATEGORY_LABELS: Record<string, string> = {
  'Novogradnja': 'Novogradnja',
  'Sekundarni Stanovi': 'Sekundarni Stanovi',
  'Kuće': 'Kuće',
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters, setAdvFilters] = useState({minPrice:'',maxPrice:'',minRooms:'',maxRooms:'',minArea:'',maxArea:'',floor:'',parking:'',heating:'',terrace:'',owner:'',location:''});
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [form, setForm] = useState({
    title:'',description:'',location:'',price:'',type:category || 'Sekundarni Stanovi',area:'',rooms:'',
    status:'Aktivna',owner_id:'',newOwnerName:'',newOwnerPhone:'',
    newOwnerEmail:'',newOwnerNotes:'',createNewOwner:true,
    floor:'',condition:'',parking:'',terrace:'',heating:'',
    street:'',building_number:'',apartment_number:'',project_id:''
  });
  const [projectForm, setProjectForm] = useState({name:'',location:'',description:'',developer:'',total_units:''});
  const [agents, setAgents] = useState<{id:string;full_name:string;role:string}[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [currentUser, setCurrentUser] = useState<{id:string;full_name:string;role:string}|null>(null);

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
    if (filterAgent) params.set('agent_id', filterAgent);
    fetch(`/api/properties?${params}`).then(r=>r.json()).then(d=>setProperties(d.properties||[]));
    fetch('/api/owners').then(r=>r.json()).then(d=>setOwners(d.owners||[]));
    if (category === 'Novogradnja') {
      fetch('/api/projects').then(r=>r.json()).then(d=>setProjects(d.projects||[]));
    }
  }, [search, category, filterStatus, advFilters, filterAgent]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/agents').then(r=>r.json()).then(d=>setAgents(d.agents||[]));
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(d.user) setCurrentUser(d.user); });
  }, []);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // ── Manual validation (native required attrs fail silently in scrollable modals) ──
    if (!form.title.trim()) { showToast('Unesite naslov nekretnine','error'); return; }
    if (!form.location) { showToast('Izaberite lokaciju','error'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) { showToast('Unesite validnu cenu','error'); return; }

    let ownerId = form.owner_id;

    if (form.createNewOwner) {
      if (!form.newOwnerName.trim()) {
        showToast('Unesite ime vlasnika','error'); return;
      }
      const nameParts = form.newOwnerName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';
      setSubmitting(true);
      try {
        const res = await fetch('/api/owners', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({first_name:firstName,last_name:lastName,phone:form.newOwnerPhone,email:form.newOwnerEmail,notes:form.newOwnerNotes})
        });
        const d = await res.json();
        if (!res.ok) { showToast(d.error||'Greška pri kreiranju vlasnika','error'); setSubmitting(false); return; }
        ownerId = d.id;
      } catch {
        showToast('Greška pri kreiranju vlasnika','error'); setSubmitting(false); return;
      }
    }

    if (!ownerId) { showToast('Izaberite vlasnika','error'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/properties', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...form, price:Number(form.price), area:Number(form.area)||null, rooms:Number(form.rooms)||null, owner_id:ownerId, images:[], project_id:form.project_id||null, agent_id:currentUser?.id||null})
      });
      if (res.ok) {
        showToast('Nekretnina kreirana!');
        setShowModal(false);
        load();
        setForm({title:'',description:'',location:'',price:'',type:category || 'Sekundarni Stanovi',area:'',rooms:'',status:'Aktivna',owner_id:'',newOwnerName:'',newOwnerPhone:'',newOwnerEmail:'',newOwnerNotes:'',createNewOwner:true,floor:'',condition:'',parking:'',terrace:'',heating:'',street:'',building_number:'',apartment_number:'',project_id:''});
      } else {
        const d = await res.json();
        showToast(d.error||'Greška pri kreiranju nekretnine','error');
      }
    } catch {
      showToast('Greška pri komunikaciji sa serverom','error');
    }
    setSubmitting(false);
  };

  const togglePublish = async (id:string) => {
    const res = await fetch(`/api/properties/${id}/publish`, {method:'POST'});
    if (res.ok) { const d = await res.json(); showToast(d.message); load(); }
    else { const d = await res.json(); showToast(d.error || 'Greška', 'error'); }
  };

  const STATUS_CYCLE = ['Aktivna', 'U pregovoru', 'Prodato'];

  const toggleStatus = async (id:string) => {
    // Optimistic update: immediately update the status in the UI
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p;
      const currentIdx = STATUS_CYCLE.indexOf(p.status);
      const newStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
      return {...p, status: newStatus};
    }));
    const res = await fetch(`/api/properties/${id}/status`, {method:'POST'});
    if (res.ok) { const d = await res.json(); showToast(d.message); }
    else { load(); } // Revert on error by reloading
  };

  const toggleFeatured = async (id:string) => {
    const res = await fetch(`/api/properties/${id}/featured`, {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    if (res.ok) { const d = await res.json(); showToast(d.message); load(); loadFeatured(); }
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Obrisati nekretninu?')) return;
    await fetch(`/api/properties/${id}`, {method:'DELETE'});
    showToast('Nekretnina obrisana'); load(); loadFeatured();
  };

  const formatPrice = (p:number) => p >= 1000 ? `€${p.toLocaleString('sr-RS')}` : `€${p}/mes`;

  // Featured properties management
  const [featuredList, setFeaturedList] = useState<Property[]>([]);
  const [showFeatured, setShowFeatured] = useState(false);

  const loadFeatured = useCallback(() => {
    fetch('/api/properties/featured').then(r=>r.json()).then(d=>setFeaturedList(d.featured||[]));
  }, []);

  useEffect(() => { loadFeatured(); }, [loadFeatured]);

  const moveFeatured = async (index: number, direction: 'up'|'down') => {
    const newList = [...featuredList];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[index], newList[swapIdx]] = [newList[swapIdx], newList[index]];
    setFeaturedList(newList);
    const res = await fetch('/api/properties/featured', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ order: newList.map(p => p.id) })
    });
    if (res.ok) { showToast('Redosled ažuriran'); load(); }
  };

  const removeFeatured = async (id: string) => {
    await fetch(`/api/properties/${id}/featured`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ featured_order: null })
    });
    showToast('Uklonjeno sa istaknutih'); load(); loadFeatured();
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/projects', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...projectForm, total_units:Number(projectForm.total_units)||null})
    });
    if (res.ok) { showToast('Projekat kreiran!'); setShowProjectModal(false); setProjectForm({name:'',location:'',description:'',developer:'',total_units:''}); load(); }
    else { const d = await res.json(); showToast(d.error||'Greška','error'); }
  };

  const toggleProject = (pid: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const handleDeleteProject = async (pid: string) => {
    if (!confirm('Obrisati projekat? Stanovi neće biti obrisani.')) return;
    await fetch(`/api/projects/${pid}`, {method:'DELETE'});
    showToast('Projekat obrisan'); load();
  };

  const toggleProjectPublish = async (pid: string, currentlyPublished: number) => {
    try {
      const res = await fetch(`/api/projects/${pid}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      load();
    } catch (e) {
      showToast((e as Error).message || 'Greška', 'error');
    }
  };

  const pageTitle = CATEGORY_LABELS[category] || 'Sve Nekretnine';
  const isRente = category === 'Rente';
  const isNovogradnja = category === 'Novogradnja';

  // For novogradnja: separate project-linked and standalone properties
  const projectProperties = isNovogradnja ? properties.filter(p => p.project_id) : [];
  const standaloneProperties = isNovogradnja ? properties.filter(p => !p.project_id) : properties;

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
            <select className="filter-select" value={filterAgent} onChange={e=>setFilterAgent(e.target.value)}>
              <option value="">Svi agenti</option>
              {agents.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
            <button className="btn-outline btn-sm" onClick={()=>setShowAdvanced(!showAdvanced)}>🔍 {showAdvanced?'Sakrij':'Filteri'}</button>
            <button className="btn-outline btn-sm" onClick={()=>setShowFeatured(!showFeatured)} style={{borderColor: featuredList.length > 0 ? 'rgba(212,175,55,0.6)' : undefined}}>⭐ Istaknuti ({featuredList.length})</button>
            <a href="/api/export/properties" className="btn-outline btn-sm">📥 CSV</a>
            {isNovogradnja && <button className="btn-outline btn-sm" onClick={()=>setShowProjectModal(true)} style={{borderColor:'rgba(212,175,55,0.4)'}}>🏗️ + Projekat</button>}
            {!isNovogradnja && <button className="btn-gold btn-sm" onClick={()=>setShowModal(true)}>+ Dodaj Stan</button>}
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
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Grejanje</label><select className="form-select" value={advFilters.heating} onChange={e=>setAdvFilters({...advFilters,heating:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Svi</option><option>Centralno</option><option>Etažno</option><option>Gas</option><option>Klima</option><option>TA peć</option><option>Struja</option><option>Toplotna pumpa</option><option>Podno grejanje</option></select></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Terasa</label><select className="form-select" value={advFilters.terrace} onChange={e=>setAdvFilters({...advFilters,terrace:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Svi</option><option>Da</option><option>Nema</option></select></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Vlasnik</label><input className="form-input" placeholder="Ime ili prezime" value={advFilters.owner} onChange={e=>setAdvFilters({...advFilters,owner:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}} /></div>
            <div><label style={{fontSize:'0.72rem',color:'var(--gray-300)',display:'block',marginBottom:4}}>Lokacija</label><select className="form-select" value={advFilters.location} onChange={e=>setAdvFilters({...advFilters,location:e.target.value})} style={{padding:'6px 10px',fontSize:'0.82rem'}}><option value="">Sve</option>{NOVI_SAD_LOKACIJE.map(l=><option key={l}>{l}</option>)}</select></div>
            <div style={{display:'flex',alignItems:'flex-end'}}><button className="btn-outline btn-sm" onClick={()=>setAdvFilters({minPrice:'',maxPrice:'',minRooms:'',maxRooms:'',minArea:'',maxArea:'',floor:'',parking:'',heating:'',terrace:'',owner:'',location:''})}>✕ Resetuj</button></div>
          </div>
        )}
        {/* Featured Properties Management Panel */}
        {showFeatured && (
          <div style={{background:'rgba(212,175,55,0.06)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontFamily:'Cinzel,serif',fontSize:'0.95rem',color:'var(--gold)',fontWeight:600}}>⭐ Istaknuti Oglasi — Redosled na Sajtu</div>
              <div style={{fontSize:'0.75rem',color:'var(--gray-300)'}}>Oglasi označeni zvezdicom se prikazuju prvi na sajtu. Koristite strelice za promenu redosleda.</div>
            </div>
            {featuredList.length === 0 ? (
              <div style={{textAlign:'center',padding:20,color:'var(--gray-300)',fontSize:'0.85rem'}}>Nema istaknutih oglasa. Kliknite ⭐ u tabeli da istaknete oglas.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {featuredList.map((fp, idx) => (
                  <div key={fp.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'rgba(0,0,0,0.3)',borderRadius:8,border:'1px solid rgba(212,175,55,0.1)'}}>
                    <span style={{color:'var(--gold)',fontWeight:700,fontSize:'0.85rem',minWidth:24,textAlign:'center'}}>{idx+1}.</span>
                    <span style={{color:'var(--gold)',fontFamily:'monospace',fontSize:'0.78rem',background:'rgba(212,175,55,0.1)',padding:'2px 6px',borderRadius:4}}>{fp.code}</span>
                    <span style={{flex:1,fontWeight:500,fontSize:'0.88rem'}}>{fp.title}</span>
                    <span style={{color:'var(--gray-300)',fontSize:'0.78rem'}}>{fp.location}</span>
                    <span style={{color:'var(--gold)',fontWeight:600,fontSize:'0.82rem'}}>{fp.price >= 1000 ? `€${fp.price.toLocaleString('sr-RS')}` : `€${fp.price}/mes`}</span>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>moveFeatured(idx,'up')} disabled={idx===0} style={{background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:6,padding:'4px 8px',cursor:idx===0?'not-allowed':'pointer',opacity:idx===0?0.3:1,color:'var(--gold)',fontSize:'0.78rem'}}>▲</button>
                      <button onClick={()=>moveFeatured(idx,'down')} disabled={idx===featuredList.length-1} style={{background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:6,padding:'4px 8px',cursor:idx===featuredList.length-1?'not-allowed':'pointer',opacity:idx===featuredList.length-1?0.3:1,color:'var(--gold)',fontSize:'0.78rem'}}>▼</button>
                      <button onClick={()=>removeFeatured(fp.id)} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#ef4444',fontSize:'0.78rem'}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Novogradnja: Project Groups */}
        {isNovogradnja && projects.length > 0 && (
          <div style={{marginBottom:20}}>
            {projects.map(proj => {
              const projUnits = projectProperties.filter(p => p.project_id === proj.id);
              const isExpanded = expandedProjects.has(proj.id);
              return (
                <div key={proj.id} style={{marginBottom:12,border:'1px solid rgba(212,175,55,0.15)',borderRadius:12,overflow:'hidden',background:'rgba(212,175,55,0.03)'}}>
                  <div onClick={()=>toggleProject(proj.id)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',cursor:'pointer',transition:'background 0.2s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(212,175,55,0.06)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{color:'var(--gold)',fontSize:'1.1rem',fontWeight:700,transition:'transform 0.2s',transform:isExpanded?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
                      <div>
                        <div style={{fontWeight:600,fontSize:'1rem',fontFamily:'Cinzel,serif',color:'var(--gold)'}}>{proj.name}</div>
                        <div style={{fontSize:'0.78rem',color:'var(--gray-300)',marginTop:2}}>📍 {proj.location} {proj.developer && `· 🏢 ${proj.developer}`}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:'0.82rem',color:'var(--gray-200)',background:'rgba(212,175,55,0.1)',padding:'3px 10px',borderRadius:20,fontWeight:600}}>
                        {projUnits.length} {projUnits.length === 1 ? 'stan' : 'stanova'}
                        {proj.sold_count > 0 && <span style={{color:'#66bb6a'}}> · {proj.sold_count} prodato</span>}
                      </span>
                      {proj.published ? (
                        <button className="btn-sm" onClick={e=>{e.stopPropagation();toggleProjectPublish(proj.id, proj.published)}} style={{fontSize:'0.72rem',color:'#4CAF50',background:'rgba(76,175,80,0.12)',padding:'4px 10px',borderRadius:6,fontWeight:600,border:'1px solid rgba(76,175,80,0.3)',cursor:'pointer'}}>🌐 Na sajtu ✓</button>
                      ) : (
                        <button className="btn-gold btn-sm" onClick={e=>{e.stopPropagation();toggleProjectPublish(proj.id, proj.published)}} style={{padding:'4px 10px',fontSize:'0.72rem'}}>🌐 Objavi na sajt</button>
                      )}
                      <Link href={`/dashboard/projects/${proj.id}`} className="btn-outline btn-sm" onClick={e=>e.stopPropagation()} style={{padding:'4px 10px',fontSize:'0.72rem',borderColor:'rgba(212,175,55,0.3)'}}>✏️ Uredi</Link>
                      <button className="btn-danger btn-sm" onClick={e=>{e.stopPropagation();handleDeleteProject(proj.id)}} style={{padding:'4px 8px',fontSize:'0.72rem'}}>✕</button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{borderTop:'1px solid rgba(212,175,55,0.1)',padding:'0'}}>
                      <div style={{display:'flex',justifyContent:'flex-end',padding:'10px 18px',borderBottom:'1px solid rgba(212,175,55,0.06)'}}>
                        <button className="btn-gold btn-sm" onClick={e=>{e.stopPropagation();setForm({...form,project_id:proj.id,type:'Novogradnja',location:proj.location,title:`${proj.name} - `});setShowModal(true)}} style={{fontSize:'0.78rem'}}>+ DODAJ STAN</button>
                      </div>
                      <table className="data-table" style={{marginBottom:0}}>
                        <thead><tr><th>Naslov</th><th>Lokacija</th><th>Cena</th><th>m²</th><th>Status</th><th>Ugovor</th><th>Sajt</th><th>⭐</th><th>Akcije</th></tr></thead>
                        <tbody>
                          {projUnits.map(p=>(
                            <tr key={p.id}>
                              <td><Link href={`/dashboard/properties/${p.id}`} style={{color:'#fff',fontWeight:500}}><span style={{color:'var(--gold)',fontWeight:700,fontFamily:'monospace',fontSize:'0.82rem',marginRight:8,background:'rgba(212,175,55,0.1)',padding:'2px 6px',borderRadius:4}}>{p.code}</span>{p.title}</Link></td>
                              <td style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>{p.location}</td>
                              <td style={{color:'var(--gold)',fontWeight:600}}>{formatPrice(p.price)}</td>
                              <td>{p.area}m²</td>
                              <td><span className={`badge ${p.status==='Aktivna'?'badge-active':p.status==='Prodato'?'badge-sold':'badge-negotiation'}`}>{p.status}</span></td>
                              <td><span style={{fontSize:'0.78rem',fontWeight:600,padding:'3px 8px',borderRadius:6,background:p.contract_signed?'rgba(76,175,80,0.12)':'rgba(255,152,0,0.1)',color:p.contract_signed?'#66bb6a':'#ffb74d'}}>{p.contract_signed?'✓ Da':'✕ Ne'}</span></td>
                              <td><button className={`publish-toggle ${p.published?'published':'unpublished'}`} onClick={()=>togglePublish(p.id)}>{p.published?'✓':'Objavi'}</button></td>
                              <td><button onClick={()=>toggleFeatured(p.id)} title={p.featured_order ? `Istaknuto #${p.featured_order}` : 'Istakni na sajtu'} style={{background:p.featured_order?'rgba(212,175,55,0.15)':'transparent',border:`1px solid ${p.featured_order?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'0.85rem'}}>{p.featured_order ? '⭐' : '☆'}</button></td>
                              <td style={{display:'flex',gap:4}}><Link href={`/dashboard/properties/${p.id}`} className="btn-outline btn-sm" style={{padding:'4px 8px',fontSize:'0.72rem',borderColor:'rgba(212,175,55,0.3)'}}>✏️</Link><button className="btn-danger btn-sm" onClick={()=>handleDelete(p.id)}>🗑</button></td>
                            </tr>
                          ))}
                          {projUnits.length===0 && <tr><td colSpan={9} style={{textAlign:'center',padding:20,color:'var(--gray-300)'}}>Nema stanova u projektu</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Main properties table - hidden for Novogradnja since it only shows projects */}
        {!isNovogradnja && (
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
                <th>⭐</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {standaloneProperties.map(p=>(
                <tr key={p.id}>
                  <td><Link href={`/dashboard/properties/${p.id}`} style={{color:'#fff',fontWeight:500}}><span style={{color:'var(--gold)',fontWeight:700,fontFamily:'monospace',fontSize:'0.82rem',marginRight:8,background:'rgba(212,175,55,0.1)',padding:'2px 6px',borderRadius:4}}>{p.code}</span>{p.title}</Link></td>
                  <td style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>{p.location}</td>
                  <td style={{color:'var(--gold)',fontWeight:600}}>{formatPrice(p.price)}</td>
                  {!category && <td><span className="badge badge-new">{p.type}</span></td>}
                  <td>{p.area}m²</td>
                  <td><button onClick={()=>toggleStatus(p.id)} title="Klikni za promenu statusa" style={{cursor:'pointer',border:'none',background:'transparent',padding:0}}><span className={`badge ${p.status==='Aktivna'?'badge-active':p.status==='Prodato'?'badge-sold':'badge-negotiation'}`} style={{cursor:'pointer'}}>{p.status}</span></button></td>
                  <td><span style={{fontSize:'0.78rem',fontWeight:600,padding:'3px 8px',borderRadius:6,
                    background: p.contract_signed ? 'rgba(76,175,80,0.12)' : 'rgba(255,152,0,0.1)',
                    color: p.contract_signed ? '#66bb6a' : '#ffb74d'
                  }}>{p.contract_signed ? '✓ Da' : '✕ Ne'}</span></td>
                  <td style={{fontSize:'0.85rem'}}>{p.owner_first_name} {p.owner_last_name}<br/><span style={{color:'var(--gray-300)',fontSize:'0.75rem'}}>{p.owner_phone}</span></td>
                  <td><button className={`publish-toggle ${p.published?'published':'unpublished'}`} onClick={()=>togglePublish(p.id)}>{p.published?'✓ Objavljeno':'Objavi'}</button></td>
                  <td><button onClick={()=>toggleFeatured(p.id)} title={p.featured_order ? `Istaknuto #${p.featured_order}` : 'Istakni na sajtu'} style={{background:p.featured_order?'rgba(212,175,55,0.15)':'transparent',border:`1px solid ${p.featured_order?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:'0.85rem',transition:'all 0.2s'}}>{p.featured_order ? '⭐' : '☆'}</button></td>
                  <td><button className="btn-danger btn-sm" onClick={()=>handleDelete(p.id)}>🗑</button></td>
                </tr>
              ))}
              {standaloneProperties.length===0 && <tr><td colSpan={category ? 10 : 11} style={{textAlign:'center',padding:40,color:'var(--gray-300)'}}>Nema nekretnina u kategoriji {pageTitle}</td></tr>}
            </tbody>
          </table>
        </div>
        )}
        {/* Novogradnja empty state when no projects */}
        {isNovogradnja && projects.length === 0 && (
          <div style={{textAlign:'center',padding:40,color:'var(--gray-300)',fontSize:'0.9rem'}}>Nema projekata. Kliknite "🏗️ + Projekat" da dodate prvi projekat.</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nova {pageTitle === 'Rente' ? 'Renta' : 'Nekretnina'}{category ? ` — ${pageTitle}` : ''}</div>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                <div className="form-group">
                  <label>Naslov *</label>
                  <input className="form-input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={isRente ? 'Npr. Garsonjera — Grbavica' : 'Npr. Trosoban Stan — Centar'} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Lokacija *</label>
                    <select className="form-select" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}>
                      <option value="">Izaberite deo grada</option>
                      {NOVI_SAD_LOKACIJE.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{isRente ? 'Mesečna Cena (€) *' : 'Cena (€) *'}</label>
                    <input className="form-input" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ulica</label>
                    <input className="form-input" value={form.street} onChange={e=>setForm({...form,street:e.target.value})} placeholder="Npr. Bulevar Oslobođenja" />
                  </div>
                  <div className="form-group">
                    <label>Broj zgrade/kuće</label>
                    <input className="form-input" value={form.building_number} onChange={e=>setForm({...form,building_number:e.target.value})} placeholder="Npr. 45" />
                  </div>
                  <div className="form-group">
                    <label>Broj stana</label>
                    <input className="form-input" value={form.apartment_number} onChange={e=>setForm({...form,apartment_number:e.target.value})} placeholder="Npr. 12" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tip</label>
                    <select className="form-select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                      <option>Novogradnja</option><option>Sekundarni Stanovi</option><option>Kuće</option><option>Lokali</option><option>Rente</option>
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
                    <option>Centralno</option><option>Etažno</option><option>Gas</option><option>Klima</option><option>TA peć</option><option>Struja</option><option>Toplotna pumpa</option><option>Podno grejanje</option>
                  </select>
                </div>

                <div style={{borderTop:'1px solid rgba(212,175,55,0.1)',margin:'20px 0',paddingTop:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <label style={{color:'var(--gold)',fontFamily:'Cinzel,serif',fontSize:'0.95rem'}}>Vlasnik</label>
                    <button type="button" className="btn-outline btn-sm" onClick={()=>setForm({...form,createNewOwner:!form.createNewOwner})}>
                      {form.createNewOwner ? 'Izaberi Postojećeg' : 'Upiši Ručno'}
                    </button>
                  </div>

                  {form.createNewOwner ? (
                    <>
                      <div className="form-group"><label>Ime i Prezime *</label><input className="form-input" value={form.newOwnerName} onChange={e=>setForm({...form,newOwnerName:e.target.value})} placeholder="Npr. Marko Marković" /></div>
                      <div className="form-row">
                        <div className="form-group"><label>Telefon</label><input className="form-input" value={form.newOwnerPhone} onChange={e=>setForm({...form,newOwnerPhone:e.target.value})} /></div>
                        <div className="form-group"><label>Email</label><input className="form-input" value={form.newOwnerEmail} onChange={e=>setForm({...form,newOwnerEmail:e.target.value})} /></div>
                      </div>
                      <div className="form-group"><label>Napomene</label><textarea className="form-textarea" value={form.newOwnerNotes} onChange={e=>setForm({...form,newOwnerNotes:e.target.value})} /></div>
                    </>
                  ) : (
                    <div className="form-group">
                      <select className="form-select" value={form.owner_id} onChange={e=>setForm({...form,owner_id:e.target.value})}>
                        <option value="">Izaberite vlasnika</option>
                        {owners.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name} — {o.phone}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={()=>setShowModal(false)}>Otkaži</button>
                <button type="submit" className="btn-gold" disabled={submitting}>{submitting ? '⏳ Kreiranje...' : 'Kreiraj'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Creation Modal */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={()=>setShowProjectModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:500}}>
            <div className="modal-header">
              <div className="modal-title">🏗️ Novi Projekat Novogradnje</div>
              <button className="modal-close" onClick={()=>setShowProjectModal(false)}>×</button>
            </div>
            <form onSubmit={handleProjectSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Naziv Projekta *</label><input className="form-input" required value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})} placeholder='Npr. Sajmište KP95' /></div>
                <div className="form-row">
                  <div className="form-group"><label>Lokacija *</label><select className="form-select" required value={projectForm.location} onChange={e=>setProjectForm({...projectForm,location:e.target.value})}><option value="">Izaberite</option>{NOVI_SAD_LOKACIJE.map(l=><option key={l}>{l}</option>)}</select></div>
                  <div className="form-group"><label>Investitor</label><input className="form-input" value={projectForm.developer} onChange={e=>setProjectForm({...projectForm,developer:e.target.value})} placeholder='Npr. Graviton' /></div>
                </div>
                <div className="form-group"><label>Ukupan Broj Stanova</label><input className="form-input" type="number" value={projectForm.total_units} onChange={e=>setProjectForm({...projectForm,total_units:e.target.value})} /></div>
                <div className="form-group"><label>Opis</label><textarea className="form-textarea" value={projectForm.description} onChange={e=>setProjectForm({...projectForm,description:e.target.value})} placeholder='Kratak opis projekta...' /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={()=>setShowProjectModal(false)}>Otkaži</button>
                <button type="submit" className="btn-gold">Kreiraj Projekat</button>
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
