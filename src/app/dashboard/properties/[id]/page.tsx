'use client';
import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Property {
  id:string; title:string; description:string; notes:string; location:string; price:number; type:string;
  area:number; rooms:number; status:string; published:number; images:string; next_action_date:string;
  owner_first_name:string; owner_last_name:string; owner_phone:string; owner_email:string; owner_notes:string;
  owner_id:string; created_at:string; updated_at:string;
}
interface NoteEntry { id:string; content:string; created_at:string; }

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetch(`/api/properties/${id}`).then(r=>r.json()).then(d=>{
      if (d.property) {
        setProperty(d.property);
        setNextActionDate(d.property.next_action_date || '');
        setPropertyImages(JSON.parse(d.property.images || '[]'));
        // Load property notes
        fetch(`/api/notes?entity_type=property&entity_id=${d.property.id}`).then(r=>r.json()).then(n=>setPropNotes(n.notes||[]));
        // Load owner notes
        fetch(`/api/notes?entity_type=owner&entity_id=${d.property.owner_id}`).then(r=>r.json()).then(n=>setOwnerNotes(n.notes||[]));
      }
    });
  };

  useEffect(load, [id]);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

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

  const togglePublish = async () => {
    const res = await fetch(`/api/properties/${id}/publish`, {method:'POST'});
    if (res.ok) {
      const d = await res.json();
      showToast(d.message);
      setProperty(prev => prev ? {...prev, published: prev.published ? 0 : 1} : prev);
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('images', f));
    try {
      const res = await fetch(`/api/properties/${id}/images`, { method: 'POST', body: formData });
      const d = await res.json();
      if (res.ok) {
        showToast(d.message);
        setPropertyImages(d.images);
      } else showToast(d.error || 'Greška', 'error');
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
          <h2 style={{margin:0,fontSize:'1.5rem'}}>{property.title}</h2>
          <p style={{color:'var(--gray-300)',margin:'4px 0 0'}}>{property.location}</p>
        </div>
        <div style={{display:'flex',gap:10}}>
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
                  <div key={i} style={{position:'relative',borderRadius:8,overflow:'hidden',aspectRatio:'4/3',background:'#1a1a1a'}}>
                    <img src={img} alt={`Slika ${i+1}`} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    <button onClick={() => deleteImage(img)}
                      style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.7)',border:'none',color:'#ff4444',cursor:'pointer',
                        borderRadius:'50%',width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}
                      title="Obriši sliku">✕</button>
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
            {property.description && <div style={{marginTop:16}}><div className="detail-label" style={{marginBottom:8}}>Opis</div><p style={{fontSize:'0.88rem',lineHeight:1.6,color:'var(--gray-200)'}}>{property.description}</p></div>}
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
            <div className="detail-row"><span className="detail-label">Ime</span><span className="detail-value">{property.owner_first_name} {property.owner_last_name}</span></div>
            <div className="detail-row"><span className="detail-label">Telefon</span><span className="detail-value"><a href={`tel:${property.owner_phone}`} style={{color:'var(--gold)'}}>{property.owner_phone}</a></span></div>
            <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value"><a href={`mailto:${property.owner_email}`} style={{color:'var(--gold)'}}>{property.owner_email}</a></span></div>
            {property.owner_notes && <div style={{marginTop:12}}><div className="detail-label" style={{marginBottom:6}}>Bio</div><p style={{fontSize:'0.82rem',color:'var(--gray-200)',background:'rgba(212,175,55,0.05)',padding:10,borderRadius:8,lineHeight:1.5}}>{property.owner_notes}</p></div>}
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
        </div>
      </div>
    </>
  );
}
