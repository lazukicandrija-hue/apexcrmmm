'use client';
import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Property {
  id:string; code:string; title:string; description:string; notes:string; location:string; price:number; type:string;
  area:number; rooms:number; status:string; published:number; images:string; next_action_date:string;
  owner_first_name:string; owner_last_name:string; owner_phone:string; owner_email:string; owner_notes:string;
  owner_id:string; created_at:string; updated_at:string;
  floor:string; condition:string; parking:string; terrace:string; heating:string;
  cadastral_notes:string; contract_signed:number; reminder_text:string;
  street:string; building_number:string; apartment_number:string;
}
interface NoteEntry { id:string; content:string; created_at:string; }
interface AuditEntry { id:string; field_name:string; old_value:string; new_value:string; user_name:string; changed_at:string; }
interface BuyerMatch { buyer:{id:string;first_name:string;last_name:string;phone:string;desired_type:string;location:string;budget:number;}; score:number; reasons:string[]; }
interface Owner { id:string; first_name:string; last_name:string; phone:string; }
interface AdListing { id:string; platform:string; status:string; external_url:string; last_synced_at:string; }

const NOVI_SAD_LOKACIJE = [
  'Centar','Stari Grad','Liman I','Liman II','Liman III','Liman IV',
  'Grbavica','Novo Naselje','Telep','Detelinara','Podbara','Rotkvarija',
  'Sajmi\u0161te','Salajka','Petrovaradin','Sremska Kamenica',
  'Adamovi\u0107evo Naselje','Satelit','Klisa','Veternik','Futog',
  'Adice','Avijati\u010darsko Naselje','Vidovdansko Naselje','Bistrica','Banatic',
  '\u0160angaj','Somborski Bulevar','Bulevar Oslobo\u0111enja',
  'Kej','Riblja Pijaca','\u0160arengrad','Karadjordjevo','Slana Bara',
  'Industrijska Zona','Rimski \u0160an\u010devi','Stepanovi\u0107evo','\u010cenej',
  'Kovilj','Bege\u010d','Ledinci','Paragovo','Popovica','Bukovac',
];

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [property, setProperty] = useState<Property|null>(null);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [propNotes, setPropNotes] = useState<NoteEntry[]>([]);
  const [ownerNotes, setOwnerNotes] = useState<NoteEntry[]>([]);
  const [newPropNote, setNewPropNote] = useState('');
  const [newOwnerNote, setNewOwnerNote] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [propertyImages, setPropertyImages] = useState<string[]>([]);
  const [cadastralNotes, setCadastralNotes] = useState('');
  const [contractSigned, setContractSigned] = useState(false);
  const [savingCadastral, setSavingCadastral] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string,string|number>>({});
  const [ownerForm, setOwnerForm] = useState<Record<string,string>>({});
  const [owners, setOwners] = useState<Owner[]>([]);
  const [saving, setSaving] = useState(false);
  // Audit log
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  // Matching
  const [buyerMatches, setBuyerMatches] = useState<BuyerMatch[]>([]);
  // Ads
  const [adListings, setAdListings] = useState<AdListing[]>([]);
  // Drag
  const [dragIdx, setDragIdx] = useState<number|null>(null);
  // Reminder
  const [reminderText, setReminderText] = useState('');

  const load = () => {
    fetch(`/api/properties/${id}`).then(r=>r.json()).then(d=>{
      if (d.property) {
        setProperty(d.property);
        setNextActionDate(d.property.next_action_date || '');
        setPropertyImages(JSON.parse(d.property.images || '[]'));
        setCadastralNotes(d.property.cadastral_notes || '');
        setContractSigned(!!d.property.contract_signed);
        setReminderText(d.property.reminder_text || '');
        fetch(`/api/notes?entity_type=property&entity_id=${d.property.id}`).then(r=>r.json()).then(n=>setPropNotes(n.notes||[]));
        fetch(`/api/notes?entity_type=owner&entity_id=${d.property.owner_id}`).then(r=>r.json()).then(n=>setOwnerNotes(n.notes||[]));
        fetch(`/api/properties/${id}/audit`).then(r=>r.json()).then(a=>setAuditLog(a.logs||[]));
        fetch(`/api/properties/${id}/matches`).then(r=>r.json()).then(m=>setBuyerMatches(m.matches||[]));
        fetch(`/api/properties/${id}/ads`).then(r=>r.json()).then(a=>setAdListings(a.ads||[]));
      }
    });
    fetch('/api/owners').then(r=>r.json()).then(d=>setOwners(d.owners||[]));
  };

  useEffect(load, [id]);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const enterEdit = () => {
    if (!property) return;
    setEditForm({title:property.title,description:property.description||'',location:property.location,price:property.price,type:property.type,area:property.area||0,rooms:property.rooms||0,status:property.status,owner_id:property.owner_id,floor:property.floor||'',condition:property.condition||'',parking:property.parking||'',terrace:property.terrace||'',heating:property.heating||'',street:property.street||'',building_number:property.building_number||'',apartment_number:property.apartment_number||''});
    setOwnerForm({first_name:property.owner_first_name||'',last_name:property.owner_last_name||'',phone:property.owner_phone||'',email:property.owner_email||'',notes:property.owner_notes||''});
    setEditMode(true);
  };
  const cancelEdit = () => setEditMode(false);
  const saveEdit = async () => {
    setSaving(true);
    // Save property
    const res = await fetch(`/api/properties/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...editForm, price:Number(editForm.price), area:Number(editForm.area)||null, rooms:Number(editForm.rooms)||null, images:propertyImages, published:property!.published, cadastral_notes:cadastralNotes, contract_signed:contractSigned?1:0, reminder_text:reminderText})
    });
    // Save owner changes too
    await fetch(`/api/owners/${property!.owner_id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(ownerForm)
    });
    if (res.ok) { showToast('Sve promene sačuvane ✓'); setEditMode(false); load(); }
    else { const d = await res.json(); showToast(d.error||'Greška','error'); }
    setSaving(false);
  };

  const addPropNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropNote.trim()) return;
    const res = await fetch('/api/notes', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ entity_type: 'property', entity_id: property!.id, content: newPropNote })
    });
    if (res.ok) { showToast('Beleška dodana ✓'); setNewPropNote(''); load(); }
  };

  const addOwnerNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerNote.trim()) return;
    const res = await fetch('/api/notes', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ entity_type: 'owner', entity_id: property!.owner_id, content: newOwnerNote })
    });
    if (res.ok) { showToast('Beleška o vlasniku dodana ✓'); setNewOwnerNote(''); load(); }
  };

  const saveNextActionDate = async (date: string) => {
    setNextActionDate(date);
    await fetch(`/api/properties/${id}/notes`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ next_action_date: date })
    });
    showToast('Datum sledeće akcije sačuvan ✓');
  };

  const saveReminder = async () => {
    await fetch(`/api/properties/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...property, reminder_text:reminderText, images:propertyImages, contract_signed:contractSigned?1:0})
    });
    showToast('Podsetnik sačuvan ✓');
  };

  const togglePublish = async () => {
    const res = await fetch(`/api/properties/${id}/publish`, {method:'POST'});
    const d = await res.json();
    if (res.ok) {
      showToast(d.message);
      setProperty(prev => prev ? {...prev, published: prev.published ? 0 : 1} : prev);
    } else {
      showToast(d.error || 'Greška', 'error');
    }
  };

  const toggleContract = async () => {
    const res = await fetch(`/api/properties/${id}/contract`, {method:'POST'});
    if (res.ok) {
      const d = await res.json();
      showToast(d.message);
      setContractSigned(!contractSigned);
      setProperty(prev => prev ? {...prev, contract_signed: prev.contract_signed ? 0 : 1} : prev);
    }
  };

  const saveCadastralNotes = async () => {
    setSavingCadastral(true);
    const res = await fetch(`/api/properties/${id}/cadastral`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ cadastral_notes: cadastralNotes })
    });
    if (res.ok) showToast('Katastar beleška sačuvana ✓');
    setSavingCadastral(false);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('images', f));
    try {
      const res = await fetch(`/api/properties/${id}/images`, { method: 'POST', body: formData });
      const d = await res.json();
      if (res.ok) { showToast(d.message); setPropertyImages(d.images); }
      else showToast(d.error || 'Greška', 'error');
    } catch { showToast('Greška pri uploadu', 'error'); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteImage = async (imgPath: string) => {
    if (!confirm('Obrisati ovu sliku?')) return;
    const res = await fetch(`/api/properties/${id}/images`, {
      method: 'DELETE', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ imagePath: imgPath })
    });
    const d = await res.json();
    if (res.ok) { showToast('Slika obrisana'); setPropertyImages(d.images); }
  };

  const setMainImage = async (idx: number) => {
    const imgs = [...propertyImages];
    const [main] = imgs.splice(idx, 1);
    imgs.unshift(main);
    setPropertyImages(imgs);
    await fetch(`/api/properties/${id}/images/reorder`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:imgs})});
    showToast('Glavna slika postavljena ✓');
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const imgs = [...propertyImages];
    const [moved] = imgs.splice(dragIdx, 1);
    imgs.splice(dropIdx, 0, moved);
    setPropertyImages(imgs);
    setDragIdx(null);
    await fetch(`/api/properties/${id}/images/reorder`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:imgs})});
    showToast('Redosled slika sačuvan ✓');
  };

  const generateAdCopy = () => {
    if (!property) return '';
    const p = property;
    const lines = [`${p.title}`, '', `📍 ${p.location}`, `💰 ${p.price >= 1000 ? `€${p.price.toLocaleString('sr-RS')}` : `€${p.price}/mesec`}`];
    if (p.area) lines.push(`📐 ${p.area} m²`);
    if (p.rooms) lines.push(`🛏 ${p.rooms} soba`);
    if (p.floor) lines.push(`🏢 Sprat: ${p.floor}`);
    if (p.heating) lines.push(`🔥 Grejanje: ${p.heating}`);
    if (p.parking) lines.push(`🅿️ Parking: ${p.parking}`);
    if (p.terrace) lines.push(`🌿 Terasa: ${p.terrace}`);
    if (p.condition) lines.push(`🔧 Stanje: ${p.condition}`);
    if (p.description) lines.push('', p.description);
    lines.push('', '📞 APEX Real Estate', '🌐 apexrealestate.rs');
    return lines.join('\n');
  };

  const copyAdText = () => {
    navigator.clipboard.writeText(generateAdCopy());
    showToast('Tekst oglasa kopiran u clipboard ✓');
  };

  const updateAdStatus = async (platform: string, status: string) => {
    await fetch(`/api/properties/${id}/ads`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform,status})});
    load();
    showToast(`${platform} status ažuriran`);
  };

  const handleDelete = async () => {
    if (!confirm('Obrisati nekretninu?')) return;
    await fetch(`/api/properties/${id}`, {method:'DELETE'});
    router.push('/dashboard/properties');
  };

  if (!property) return <div style={{textAlign:'center',padding:60,color:'var(--gray-300)'}}>Učitavanje...</div>;

  const formatPrice = (p:number) => p >= 1000 ? `€${p.toLocaleString('sr-RS')}` : `€${p}/mesec`;
  const today = new Date().toISOString().split('T')[0];
  const getDateBadge = (d:string) => {
    if (!d) return '';
    if (d < today) return 'badge-overdue';
    const diff = (new Date(d).getTime()-new Date(today).getTime())/86400000;
    return diff<=3?'badge-soon':'badge-future';
  };

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <Link href="/dashboard/properties" className="back-link">← Nazad na listu</Link>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:'1.5rem'}}>
            <span style={{color:'var(--gold)',fontFamily:'monospace',fontWeight:700,fontSize:'1rem',marginRight:10,background:'rgba(212,175,55,0.1)',padding:'2px 8px',borderRadius:6}}>{property.code}</span>
            {property.title}
          </h2>
          <p style={{color:'var(--gray-300)',margin:'4px 0 0'}}>{property.location}</p>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {editMode ? (<>
            <button className="btn-gold btn-sm" onClick={saveEdit} disabled={saving} style={{padding:'8px 16px'}}>{saving?'Čuvam...':'💾 Sačuvaj Sve'}</button>
            <button className="btn-outline btn-sm" onClick={cancelEdit} style={{padding:'8px 16px'}}>✕ Otkaži</button>
          </>) : (
            <button className="btn-outline btn-sm" onClick={enterEdit} style={{padding:'8px 16px'}}>✏️ Izmeni</button>
          )}
          <a href={`/api/properties/${id}/pdf`} target="_blank" className="btn-outline btn-sm" style={{padding:'8px 16px',display:'inline-flex',alignItems:'center',gap:6}}>📄 PDF</a>
          <button onClick={toggleContract}
            style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.82rem',transition:'all 0.3s',
              background: contractSigned ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.12)', color: contractSigned ? '#66bb6a' : '#ffb74d'}}>
            {contractSigned ? '📝 Ugovor Potpisan' : '⚠️ Bez Ugovora'}
          </button>
          <button className={`publish-toggle ${property.published?'published':'unpublished'}`} onClick={togglePublish}
            style={{padding:'8px 16px'}}>{property.published ? '✓ Objavljeno na Sajtu' : 'Objavi na Sajt'}</button>
          <button className="btn-danger btn-sm" onClick={handleDelete}>🗑 Obriši</button>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left column */}
        <div>
          {/* Image Gallery & Upload */}
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">📷 Slike Nekretnine ({propertyImages.length})</div>
            {propertyImages.length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:10,marginBottom:16}}>
                {propertyImages.map((img,i) => (
                  <div key={i} draggable onDragStart={()=>handleDragStart(i)} onDragOver={handleDragOver} onDrop={()=>handleDrop(i)}
                    style={{position:'relative',borderRadius:8,overflow:'hidden',aspectRatio:'4/3',background:'#1a1a1a',
                      border: i===0?'2px solid var(--gold)':'2px solid transparent',cursor:'grab',opacity:dragIdx===i?0.5:1}}>
                    <img src={img} alt={`Slika ${i+1}`} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    {i===0 && <div style={{position:'absolute',top:4,left:4,background:'var(--gold)',color:'#000',borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:700}}>⭐ Glavna</div>}
                    <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',justifyContent:'space-between',padding:3,background:'rgba(0,0,0,0.6)'}}>
                      {i!==0 && <button onClick={()=>setMainImage(i)} style={{background:'none',border:'none',color:'var(--gold)',cursor:'pointer',fontSize:11,fontWeight:600}} title="Postavi kao glavnu">⭐</button>}
                      {i===0 && <span/>}
                      <button onClick={()=>deleteImage(img)} style={{background:'none',border:'none',color:'#ff4444',cursor:'pointer',fontSize:14}} title="Obriši">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#D4AF37'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'; handleImageUpload(e.dataTransfer.files); }}
              style={{border:'2px dashed rgba(212,175,55,0.2)',borderRadius:12,padding:'24px 16px',textAlign:'center',
                cursor:'pointer',transition:'all 0.3s',background:'rgba(212,175,55,0.03)'}}
            >
              <div style={{fontSize:28,marginBottom:8}}>{uploading ? '⏳' : '📁'}</div>
              <div style={{color:'var(--gold)',fontSize:'0.9rem',fontWeight:500}}>
                {uploading ? 'Uploadujem...' : 'Klikni ili prevuci slike ovde'}
              </div>
              <div style={{color:'var(--gray-300)',fontSize:'0.78rem',marginTop:4}}>JPG, PNG, WebP — do 10MB</div>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" style={{display:'none'}}
              onChange={e => handleImageUpload(e.target.files)} />
          </div>

          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">Detalji Nekretnine</div>
            {editMode ? (<>
              <div className="form-group" style={{marginBottom:12}}><label>Naslov</label><input className="form-input" value={editForm.title||''} onChange={e=>setEditForm({...editForm,title:e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label>Lokacija</label><select className="form-select" value={editForm.location||''} onChange={e=>setEditForm({...editForm,location:e.target.value})}><option value="">Izaberite deo grada</option>{NOVI_SAD_LOKACIJE.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                <div className="form-group"><label>Cena (€)</label><input className="form-input" type="number" value={editForm.price||''} onChange={e=>setEditForm({...editForm,price:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Ulica</label><input className="form-input" value={editForm.street||''} onChange={e=>setEditForm({...editForm,street:e.target.value})} placeholder="Npr. Bulevar Oslobođenja" /></div>
                <div className="form-group"><label>Broj zgrade/kuće</label><input className="form-input" value={editForm.building_number||''} onChange={e=>setEditForm({...editForm,building_number:e.target.value})} placeholder="Npr. 45" /></div>
                <div className="form-group"><label>Broj stana</label><input className="form-input" value={editForm.apartment_number||''} onChange={e=>setEditForm({...editForm,apartment_number:e.target.value})} placeholder="Npr. 12" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Tip</label><select className="form-select" value={editForm.type||''} onChange={e=>setEditForm({...editForm,type:e.target.value})}><option>Novogradnja</option><option>Starogradnja</option><option>Lokali</option><option>Rente</option></select></div>
                <div className="form-group"><label>Status</label><select className="form-select" value={editForm.status||''} onChange={e=>setEditForm({...editForm,status:e.target.value})}><option>Aktivna</option><option>Prodato</option><option>U pregovoru</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Površina (m²)</label><input className="form-input" type="number" value={editForm.area||''} onChange={e=>setEditForm({...editForm,area:e.target.value})} /></div>
                <div className="form-group"><label>Broj soba</label><input className="form-input" type="number" value={editForm.rooms||''} onChange={e=>setEditForm({...editForm,rooms:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Sprat</label><input className="form-input" value={editForm.floor||''} onChange={e=>setEditForm({...editForm,floor:e.target.value})} placeholder="Npr. 3/10" /></div>
                <div className="form-group"><label>Stanje</label><select className="form-select" value={editForm.condition||''} onChange={e=>setEditForm({...editForm,condition:e.target.value})}><option value="">-</option><option>Renoviran</option><option>Useljiv</option><option>Potrebna Adaptacija</option><option>U izgradnji</option><option>Lux</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Parking</label><select className="form-select" value={editForm.parking||''} onChange={e=>setEditForm({...editForm,parking:e.target.value})}><option value="">-</option><option>Garaža</option><option>Parking mesto</option><option>Ulica</option><option>Nema</option></select></div>
                <div className="form-group"><label>Terasa</label><select className="form-select" value={editForm.terrace||''} onChange={e=>setEditForm({...editForm,terrace:e.target.value})}><option value="">-</option><option>Da</option><option>2 terase</option><option>Lodža</option><option>Balkon</option><option>Nema</option></select></div>
              </div>
              <div className="form-group" style={{marginBottom:12}}><label>Grejanje</label><select className="form-select" value={editForm.heating||''} onChange={e=>setEditForm({...editForm,heating:e.target.value})}><option value="">-</option><option>Centralno</option><option>Etažno</option><option>Gas</option><option>Klima</option><option>TA peć</option></select></div>
              <div className="form-group" style={{marginBottom:12}}><label>Vlasnik</label><select className="form-select" value={editForm.owner_id||''} onChange={e=>setEditForm({...editForm,owner_id:e.target.value})}>{owners.map(o=><option key={o.id} value={o.id}>{o.first_name} {o.last_name} — {o.phone}</option>)}</select></div>
              <div className="form-group"><label>Opis</label><textarea className="form-textarea" value={editForm.description as string||''} onChange={e=>setEditForm({...editForm,description:e.target.value})} style={{minHeight:80}} /></div>
            </>) : (<>
              <div className="detail-row"><span className="detail-label">Cena</span><span className="detail-value" style={{color:'var(--gold)',fontSize:'1.1rem'}}>{formatPrice(property.price)}</span></div>
              <div className="detail-row"><span className="detail-label">Tip</span><span className="detail-value">{property.type}</span></div>
              <div className="detail-row"><span className="detail-label">Površina</span><span className="detail-value">{property.area} m²</span></div>
              <div className="detail-row"><span className="detail-label">Sobe</span><span className="detail-value">{property.rooms}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className={`badge ${property.status==='Aktivna'?'badge-active':property.status==='Prodato'?'badge-sold':'badge-negotiation'}`}>{property.status}</span></div>
              <div className="detail-row">
                <span className="detail-label">📅 Sledeći Follow-up</span>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <input type="date" className="form-input" value={nextActionDate} onChange={e=>saveNextActionDate(e.target.value)}
                    style={{padding:'6px 10px',fontSize:'0.82rem',width:'auto'}} />
                  {nextActionDate && <span className={`badge ${getDateBadge(nextActionDate)}`}>{new Date(nextActionDate).toLocaleDateString('sr-RS')}</span>}
                </div>
              </div>
              <div className="detail-row"><span className="detail-label">Dodato</span><span className="detail-value">{new Date(property.created_at).toLocaleDateString('sr-RS')}</span></div>
              {(property.street || property.building_number || property.apartment_number) && (
                <div style={{marginTop:12,padding:'10px 12px',background:'rgba(212,175,55,0.04)',borderRadius:8,border:'1px solid rgba(212,175,55,0.08)'}}>
                  <div className="detail-label" style={{marginBottom:6,color:'var(--gold)',fontSize:'0.72rem'}}>📍 Adresa</div>
                  <div style={{fontSize:'0.88rem',color:'var(--gray-200)',lineHeight:1.6}}>
                    {property.street && <span>{property.street}</span>}
                    {property.building_number && <span> {property.building_number}</span>}
                    {property.apartment_number && <span>, stan {property.apartment_number}</span>}
                  </div>
                </div>
              )}
              {property.floor && <div className="detail-row"><span className="detail-label">Sprat</span><span className="detail-value">{property.floor}</span></div>}
              {property.condition && <div className="detail-row"><span className="detail-label">Stanje</span><span className="detail-value">{property.condition}</span></div>}
              {property.parking && <div className="detail-row"><span className="detail-label">Parking</span><span className="detail-value">{property.parking}</span></div>}
              {property.terrace && <div className="detail-row"><span className="detail-label">Terasa</span><span className="detail-value">{property.terrace}</span></div>}
              {property.heating && <div className="detail-row"><span className="detail-label">Grejanje</span><span className="detail-value">{property.heating}</span></div>}
              {property.description && <div style={{marginTop:16}}><div className="detail-label" style={{marginBottom:8}}>Opis</div><p style={{fontSize:'0.88rem',lineHeight:1.6,color:'var(--gray-200)'}}>{property.description}</p></div>}
            </>)}
          </div>

          {/* Contract & Katastar Card */}
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">📋 Ugovor & Katastar</div>
            {/* Contract Status */}
            <div className="detail-row" style={{alignItems:'center'}}>
              <span className="detail-label">Ugovor o posredovanju</span>
              <button
                onClick={toggleContract}
                style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.82rem',
                  transition:'all 0.3s',
                  background: contractSigned ? 'rgba(76,175,80,0.15)' : 'rgba(255,152,0,0.12)',
                  color: contractSigned ? '#66bb6a' : '#ffb74d',
                }}
              >
                {contractSigned ? '✓ Potpisan' : '✕ Nije Potpisan'}
              </button>
            </div>
            <div style={{padding:'8px 0 4px',fontSize:'0.75rem',color:'var(--gray-300)'}}>
              {contractSigned
                ? '✅ Može se javno oglašavati'
                : '⚠️ Samo interna ponuda — ne može se javno oglašavati dok se ugovor ne potpiše'
              }
            </div>

            {/* Katastar Notes */}
            <div style={{borderTop:'1px solid rgba(212,175,55,0.08)',marginTop:16,paddingTop:16}}>
              <div className="detail-label" style={{marginBottom:8}}>🏛️ Katastar Napomene</div>
              <textarea
                className="form-textarea"
                value={cadastralNotes}
                onChange={e => setCadastralNotes(e.target.value)}
                placeholder="Upiši stanje u katastru... npr. 'Čist katastar, nema tereta' ili 'Postoji hipoteka — čeka se brisanje' ili 'Uknjižen 1/1 na vlasnika'"
                style={{minHeight:80,marginBottom:10}}
              />
              <button
                type="button"
                className="btn-gold btn-sm"
                onClick={saveCadastralNotes}
                disabled={savingCadastral}
                style={{opacity: savingCadastral ? 0.6 : 1}}
              >
                {savingCadastral ? 'Čuvanje...' : '💾 Sačuvaj Katastar'}
              </button>
            </div>
          </div>

          {/* Property Notes Timeline */}
          <div className="detail-card">
            <div className="detail-card-title">📝 Istorija Beleški — Nekretnina</div>
            <form onSubmit={addPropNote} style={{marginBottom:16,display:'flex',gap:10}}>
              <textarea className="form-textarea" value={newPropNote} onChange={e=>setNewPropNote(e.target.value)}
                placeholder="Upiši šta se desilo... npr. 'Pozvao vlasnika, cena ostaje ista' ili 'Pokazao stan kupcu Petru, sviđa mu se'"
                style={{flex:1,minHeight:70}} />
              <button type="submit" className="btn-gold btn-sm" style={{alignSelf:'flex-end',whiteSpace:'nowrap'}}>+ Dodaj</button>
            </form>
            <div className="timeline">
              {propNotes.map(n=>(
                <div key={n.id} className="timeline-item">
                  <div className="timeline-date">{new Date(n.created_at).toLocaleDateString('sr-RS', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                  <div className="timeline-text">{n.content}</div>
                </div>
              ))}
              {propNotes.length===0 && <p style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>Još nema beleški za ovu nekretninu</p>}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">Vlasnik</div>
            {editMode ? (<>
              <div className="form-row">
                <div className="form-group"><label>Ime</label><input className="form-input" value={ownerForm.first_name||''} onChange={e=>setOwnerForm({...ownerForm,first_name:e.target.value})} /></div>
                <div className="form-group"><label>Prezime</label><input className="form-input" value={ownerForm.last_name||''} onChange={e=>setOwnerForm({...ownerForm,last_name:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Telefon</label><input className="form-input" value={ownerForm.phone||''} onChange={e=>setOwnerForm({...ownerForm,phone:e.target.value})} /></div>
                <div className="form-group"><label>Email</label><input className="form-input" value={ownerForm.email||''} onChange={e=>setOwnerForm({...ownerForm,email:e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Bio / Napomene</label><textarea className="form-textarea" value={ownerForm.notes||''} onChange={e=>setOwnerForm({...ownerForm,notes:e.target.value})} style={{minHeight:60}} /></div>
            </>) : (<>
              <div className="detail-row"><span className="detail-label">Ime</span><span className="detail-value">{property.owner_first_name} {property.owner_last_name}</span></div>
              <div className="detail-row"><span className="detail-label">Telefon</span><span className="detail-value"><a href={`tel:${property.owner_phone}`} style={{color:'var(--gold)'}}>{property.owner_phone}</a></span></div>
              <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value"><a href={`mailto:${property.owner_email}`} style={{color:'var(--gold)'}}>{property.owner_email}</a></span></div>
              {property.owner_notes && <div style={{marginTop:12}}><div className="detail-label" style={{marginBottom:6}}>Bio</div><p style={{fontSize:'0.82rem',color:'var(--gray-200)',background:'rgba(212,175,55,0.05)',padding:10,borderRadius:8,lineHeight:1.5}}>{property.owner_notes}</p></div>}
            </>)}
          </div>

          {/* Owner Notes Timeline */}
          <div className="detail-card">
            <div className="detail-card-title">📋 Istorija Beleški — Vlasnik</div>
            <p style={{fontSize:'0.72rem',color:'var(--gray-300)',margin:'-8px 0 12px'}}>Vidljive na svim nekretninama ovog vlasnika</p>
            <form onSubmit={addOwnerNote} style={{marginBottom:16,display:'flex',gap:10}}>
              <textarea className="form-textarea" value={newOwnerNote} onChange={e=>setNewOwnerNote(e.target.value)}
                placeholder="Upiši komunikaciju sa vlasnikom... npr. 'Pozvao ga, kaže da neće spuštati cenu' ili 'Pomenuo da ima još jedan stan na Limanu'"
                style={{flex:1,minHeight:70}} />
              <button type="submit" className="btn-gold btn-sm" style={{alignSelf:'flex-end',whiteSpace:'nowrap'}}>+ Dodaj</button>
            </form>
            <div className="timeline">
              {ownerNotes.map(n=>(
                <div key={n.id} className="timeline-item">
                  <div className="timeline-date">{new Date(n.created_at).toLocaleDateString('sr-RS', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                  <div className="timeline-text">{n.content}</div>
                </div>
              ))}
              {ownerNotes.length===0 && <p style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>Još nema beleški za ovog vlasnika</p>}
            </div>
          </div>

          {/* Reminder Card */}
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">⏰ Podsetnik</div>
            <div style={{display:'flex',gap:10}}>
              <textarea className="form-textarea" value={reminderText} onChange={e=>setReminderText(e.target.value)}
                placeholder="Npr. Pozvati vlasnika za update cene 15.05." style={{flex:1,minHeight:50}} />
              <button className="btn-gold btn-sm" onClick={saveReminder} style={{alignSelf:'flex-end',whiteSpace:'nowrap'}}>💾 Sačuvaj</button>
            </div>
          </div>

          {/* Buyer Matching */}
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">👤 Potencijalni Kupci ({buyerMatches.length})</div>
            {buyerMatches.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {buyerMatches.map(m => (
                  <a key={m.buyer.id} href={`/dashboard/buyers/${m.buyer.id}`}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'rgba(212,175,55,0.04)',borderRadius:8,border:'1px solid rgba(212,175,55,0.1)',color:'#fff',textDecoration:'none',transition:'background 0.2s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(212,175,55,0.1)')} onMouseLeave={e=>(e.currentTarget.style.background='rgba(212,175,55,0.04)')}>
                    <div>
                      <div style={{fontWeight:500,fontSize:'0.9rem'}}>{m.buyer.first_name} {m.buyer.last_name}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--gray-300)',marginTop:2}}>{m.reasons.join(' · ')}</div>
                    </div>
                    <div style={{background:'var(--gold)',color:'#000',borderRadius:20,padding:'2px 10px',fontWeight:700,fontSize:'0.78rem'}}>{m.score} poena</div>
                  </a>
                ))}
              </div>
            ) : <p style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>Nema kupaca koji odgovaraju ovoj nekretnini</p>}
          </div>

          {/* Ads / Oglašavanje */}
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">📢 Oglašavanje</div>
            <button className="btn-outline btn-sm" onClick={copyAdText} style={{marginBottom:16}}>📋 Kopiraj tekst oglasa</button>
            {['4zida','Halooglasi','Nekretnine.rs'].map(platform => {
              const ad = adListings.find(a => a.platform === platform);
              const st = ad?.status || 'draft';
              return (
                <div key={platform} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <span style={{fontSize:'0.88rem',fontWeight:500}}>{platform}</span>
                  <select className="filter-select" value={st} onChange={e=>updateAdStatus(platform,e.target.value)}
                    style={{padding:'4px 24px 4px 8px',fontSize:'0.78rem',borderRadius:6}}>
                    <option value="draft">⬜ Draft</option>
                    <option value="published">✅ Objavljeno</option>
                    <option value="needs_update">🔄 Treba Update</option>
                    <option value="removed">❌ Uklonjeno</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Audit Log - Full Width */}
      <div className="detail-card" style={{marginTop:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setShowAudit(!showAudit)}>
          <div className="detail-card-title" style={{margin:0}}>📋 Istorija Promena ({auditLog.length})</div>
          <span style={{color:'var(--gold)',fontSize:'0.85rem'}}>{showAudit?'▲ Sakrij':'▼ Prikaži'}</span>
        </div>
        {showAudit && (
          <div style={{marginTop:16}}>
            {auditLog.length > 0 ? (
              <div className="timeline">
                {auditLog.map(a => (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-date">{new Date(a.changed_at).toLocaleDateString('sr-RS',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})} — {a.user_name}</div>
                    <div className="timeline-text">
                      <strong>{a.field_name}</strong>: <span style={{color:'#ff6b6b',textDecoration:'line-through'}}>{a.old_value}</span> → <span style={{color:'#4caf50'}}>{a.new_value}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>Još nema zabeleženih promena</p>}
          </div>
        )}
      </div>
    </>
  );
}
