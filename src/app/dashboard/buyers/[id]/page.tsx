'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Buyer {
  id:string; first_name:string; last_name:string; phone:string; email:string;
  desired_type:string; location:string; budget:number; notes:string;
  next_action_date:string; status:string; created_at:string;
  financing:string; desired_rooms:string; preferred_locations:string;
}
interface NoteEntry { id:string; content:string; created_at:string; }
interface PropertyMatch { property:{id:string;title:string;location:string;price:number;type:string;area:number;rooms:number;}; score:number; reasons:string[]; }

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

function parseRooms(val: string): string[] {
  if (!val) return [];
  try { const arr = JSON.parse(val); return Array.isArray(arr) ? arr : [val]; } catch { return val ? [val] : []; }
}
function roomShort(room: string): string {
  return ROOM_OPTIONS.find(r => r.value === room)?.label || room;
}

export default function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [buyer, setBuyer] = useState<Buyer|null>(null);
  const [buyerNotes, setBuyerNotes] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState('');
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [nextActionDate, setNextActionDate] = useState('');
  const [status, setStatus] = useState('');
  const [propertyMatches, setPropertyMatches] = useState<PropertyMatch[]>([]);
  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string,string|number>>({});
  const [editRooms, setEditRooms] = useState<string[]>([]);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`/api/buyers/${id}`).then(r=>r.json()).then(d=>{
      if (d.buyer) {
        setBuyer(d.buyer);
        setNextActionDate(d.buyer.next_action_date || '');
        setStatus(d.buyer.status || 'Aktivan');
        // Load notes history
        fetch(`/api/notes?entity_type=buyer&entity_id=${d.buyer.id}`).then(r=>r.json()).then(n=>setBuyerNotes(n.notes||[]));
        fetch(`/api/buyers/${id}/matches`).then(r=>r.json()).then(m=>setPropertyMatches(m.matches||[]));
      }
    });
  };

  useEffect(load, [id]);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const enterEdit = () => {
    if (!buyer) return;
    setEditForm({
      full_name: `${buyer.first_name} ${buyer.last_name}`.trim(),
      phone: buyer.phone||'', email: buyer.email||'',
      desired_type: buyer.desired_type||'',
      location: buyer.location||'',
      budget: buyer.budget||0, notes: buyer.notes||'',
      financing: buyer.financing||'',
    });
    setEditRooms(parseRooms(buyer.desired_rooms));
    try { setEditLocations(JSON.parse(buyer.preferred_locations||'[]')); } catch { setEditLocations([]); }
    setEditMode(true);
  };
  const cancelEdit = () => setEditMode(false);
  const saveEdit = async () => {
    setSaving(true);
    const nameParts = String(editForm.full_name||'').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const res = await fetch(`/api/buyers/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        first_name: firstName, last_name: lastName,
        phone: editForm.phone, email: editForm.email,
        desired_type: editForm.desired_type,
        desired_rooms: JSON.stringify(editRooms),
        financing: editForm.financing,
        budget: Number(editForm.budget)||null,
        location: editForm.location,
        notes: editForm.notes,
        next_action_date: nextActionDate||null,
        status,
        preferred_locations: JSON.stringify(editLocations),
      })
    });
    if (res.ok) { showToast('Kupac ažuriran ✓'); setEditMode(false); load(); }
    else { const d = await res.json(); showToast(d.error||'Greška','error'); }
    setSaving(false);
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const res = await fetch('/api/notes', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ entity_type: 'buyer', entity_id: buyer!.id, content: newNote })
    });
    if (res.ok) { showToast('Beleška dodana ✓'); setNewNote(''); load(); }
  };

  const saveNextActionDate = async (date: string) => {
    setNextActionDate(date);
    await fetch(`/api/buyers/${id}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ next_action_date: date })
    });
    showToast('Datum follow-up sačuvan ✓');
  };

  const saveStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await fetch(`/api/buyers/${id}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Status promenjen: ${newStatus}`);
  };

  const handleDelete = async () => {
    if (!confirm('Obrisati kupca?')) return;
    await fetch(`/api/buyers/${id}`, {method:'DELETE'});
    router.push('/dashboard/buyers');
  };

  if (!buyer) return <div style={{textAlign:'center',padding:60,color:'var(--gray-300)'}}>Učitavanje...</div>;

  const today = new Date().toISOString().split('T')[0];
  const getDateBadge = (d:string) => {
    if (!d) return '';
    if (d < today) return 'badge-overdue';
    const diff = (new Date(d).getTime()-new Date(today).getTime())/86400000;
    return diff<=2?'badge-soon':'badge-future';
  };

  const getStatusBadge = (s:string) => {
    if (s === 'Aktivan') return 'badge-active';
    if (s === 'Pauzirana Potraga') return 'badge-negotiation';
    if (s === 'Kupio Stan') return 'badge-sold';
    return 'badge-new';
  };

  const buyerRooms = parseRooms(buyer.desired_rooms);
  let buyerLocs: string[] = [];
  try { buyerLocs = JSON.parse(buyer.preferred_locations||'[]'); } catch { /* ignore */ }

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <Link href="/dashboard/buyers" className="back-link">← Nazad na listu</Link>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:'1.5rem'}}>{buyer.first_name} {buyer.last_name}</h2>
          <p style={{color:'var(--gray-300)',margin:'4px 0 0'}}>{buyer.desired_type ? `Traži: ${buyer.desired_type}` : 'Kupac'}</p>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {editMode ? (<>
            <button className="btn-gold btn-sm" onClick={saveEdit} disabled={saving} style={{padding:'8px 16px'}}>{saving?'Čuvam...':'💾 Sačuvaj Sve'}</button>
            <button className="btn-outline btn-sm" onClick={cancelEdit} style={{padding:'8px 16px'}}>✕ Otkaži</button>
          </>) : (
            <button className="btn-outline btn-sm" onClick={enterEdit} style={{padding:'8px 16px'}}>✏️ Izmeni</button>
          )}
          <button className="btn-danger btn-sm" onClick={handleDelete}>🗑 Obriši</button>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left column - Info */}
        <div>
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">Informacije o Kupcu</div>
            {editMode ? (<>
                <div className="form-group"><label>Ime i Prezime</label><input className="form-input" value={editForm.full_name||''} onChange={e=>setEditForm({...editForm,full_name:e.target.value})} placeholder="Npr. Marko Marković" /></div>
              <div className="form-row">
                <div className="form-group"><label>Telefon</label><input className="form-input" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})} /></div>
                <div className="form-group"><label>Email</label><input className="form-input" value={editForm.email||''} onChange={e=>setEditForm({...editForm,email:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Tip Nekretnine</label><select className="form-select" value={editForm.desired_type||''} onChange={e=>setEditForm({...editForm,desired_type:e.target.value})}><option value="">-</option><option>Stan</option><option>Kuća</option><option>Plac</option><option>Lokal</option></select></div>
                <div className="form-group"><label>Način Finansiranja</label><select className="form-select" value={editForm.financing||''} onChange={e=>setEditForm({...editForm,financing:e.target.value})}><option value="">-</option><option>Keš</option><option>Kredit</option><option>Kombinovano</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Budžet (€)</label><input className="form-input" type="number" value={editForm.budget||''} onChange={e=>setEditForm({...editForm,budget:e.target.value})} /></div>
              </div>
              {/* Multi-select sobe */}
              <div className="form-group">
                <label>Željene Sobe</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
                  {ROOM_OPTIONS.map(r => {
                    const sel = editRooms.includes(r.value);
                    return (
                      <label key={r.value} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.82rem',padding:'5px 14px',borderRadius:20,cursor:'pointer',userSelect:'none',
                        background:sel?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.04)',
                        border:`1px solid ${sel?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.08)'}`,
                        color:sel?'var(--gold)':'var(--gray-300)',transition:'all 0.15s',fontWeight:sel?600:400}}>
                        <input type="checkbox" checked={sel} onChange={e=>{
                          setEditRooms(e.target.checked ? [...editRooms, r.value] : editRooms.filter(x=>x!==r.value));
                        }} style={{display:'none'}} />
                        {sel?'✓ ':''}{r.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label>Željene Lokacije</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6,maxHeight:140,overflowY:'auto',padding:8,background:'rgba(255,255,255,0.03)',borderRadius:8,border:'1px solid rgba(212,175,55,0.1)'}}>
                  {NOVI_SAD_LOKACIJE.map(loc=>{
                    const sel = editLocations.includes(loc);
                    return (
                      <label key={loc} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.78rem',padding:'4px 10px',borderRadius:16,cursor:'pointer',userSelect:'none',
                        background:sel?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.04)',
                        border:`1px solid ${sel?'rgba(212,175,55,0.4)':'rgba(255,255,255,0.08)'}`,
                        color:sel?'var(--gold)':'var(--gray-300)',transition:'all 0.15s'}}>
                        <input type="checkbox" checked={sel} onChange={e=>{
                          setEditLocations(e.target.checked ? [...editLocations, loc] : editLocations.filter(l=>l!==loc));
                        }} style={{display:'none'}} />
                        {sel?'✓ ':''}{loc}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="form-group"><label>Napomena</label><input className="form-input" value={editForm.location||''} onChange={e=>setEditForm({...editForm,location:e.target.value})} placeholder="Nešto specifično..." /></div>
              <div className="form-group"><label>Detaljne Napomene</label><textarea className="form-textarea" value={editForm.notes as string||''} onChange={e=>setEditForm({...editForm,notes:e.target.value})} style={{minHeight:80}} /></div>
            </>) : (<>
              <div className="detail-row"><span className="detail-label">Telefon</span><span className="detail-value"><a href={`tel:${buyer.phone}`} style={{color:'var(--gold)'}}>{buyer.phone}</a></span></div>
              <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value"><a href={`mailto:${buyer.email}`} style={{color:'var(--gold)'}}>{buyer.email}</a></span></div>
              <div className="detail-row"><span className="detail-label">Tip</span><span className="detail-value">{buyer.desired_type||'-'}</span></div>
              <div className="detail-row"><span className="detail-label">Željene Sobe</span><span className="detail-value" style={{color:'var(--gold)',fontWeight:500}}>{buyerRooms.length > 0 ? buyerRooms.map(r => roomShort(r)).join(', ') : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Finansiranje</span><span className="detail-value"><span style={{padding:'3px 10px',borderRadius:6,fontSize:'0.82rem',background:buyer.financing==='Keš'?'rgba(76,175,80,0.12)':buyer.financing==='Kredit'?'rgba(33,150,243,0.12)':buyer.financing==='Kombinovano'?'rgba(255,152,0,0.12)':'transparent',color:buyer.financing==='Keš'?'#66bb6a':buyer.financing==='Kredit'?'#64b5f6':buyer.financing==='Kombinovano'?'#ffb74d':'var(--gray-300)'}}>{buyer.financing||'-'}</span></span></div>
              <div className="detail-row"><span className="detail-label">Budžet</span><span className="detail-value" style={{color:'var(--gold)'}}>€{buyer.budget?.toLocaleString('sr-RS')||'-'}</span></div>
              {buyerLocs.length > 0 && (
                <div style={{marginTop:10}}>
                  <div className="detail-label" style={{marginBottom:6}}>Željene Lokacije</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {buyerLocs.map((l:string)=>(<span key={l} style={{fontSize:'0.75rem',padding:'3px 10px',borderRadius:16,background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.2)',color:'var(--gold)'}}>{l}</span>))}
                  </div>
                </div>
              )}
            </>)}
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <select className="filter-select" value={status} onChange={e=>saveStatus(e.target.value)}
                style={{padding:'5px 28px 5px 10px',fontSize:'0.82rem',borderRadius:20}}>
                <option>Aktivan</option>
                <option>Pauzirana Potraga</option>
                <option>Kupio Stan</option>
              </select>
            </div>
            <div className="detail-row">
              <span className="detail-label">📅 Sledeći Follow-up</span>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="date" className="form-input" value={nextActionDate} onChange={e=>saveNextActionDate(e.target.value)}
                  style={{padding:'6px 10px',fontSize:'0.82rem',width:'auto'}} />
                {nextActionDate && <span className={`badge ${getDateBadge(nextActionDate)}`}>{new Date(nextActionDate).toLocaleDateString('sr-RS')}</span>}
              </div>
            </div>
            <div className="detail-row"><span className="detail-label">Dodat</span><span className="detail-value">{new Date(buyer.created_at).toLocaleDateString('sr-RS')}</span></div>
            {!editMode && buyer.location && <div style={{marginTop:12}}><div className="detail-label" style={{marginBottom:6}}>Napomena</div><p style={{fontSize:'0.82rem',color:'var(--gray-200)',background:'rgba(212,175,55,0.05)',padding:10,borderRadius:8,lineHeight:1.5}}>{buyer.location}</p></div>}
            {!editMode && buyer.notes && <div style={{marginTop:12}}><div className="detail-label" style={{marginBottom:6}}>Detaljne Napomene</div><p style={{fontSize:'0.82rem',color:'var(--gray-200)',background:'rgba(212,175,55,0.05)',padding:10,borderRadius:8,lineHeight:1.5}}>{buyer.notes}</p></div>}
          </div>
        </div>

        {/* Right column - Notes Timeline */}
        <div>
          <div className="detail-card">
            <div className="detail-card-title">📝 Istorija Komunikacije</div>
            <p style={{fontSize:'0.72rem',color:'var(--gray-300)',margin:'-8px 0 12px'}}>Posle svakog poziva/razgovora upiši šta se desilo</p>
            <form onSubmit={addNote} style={{marginBottom:16,display:'flex',gap:10}}>
              <textarea className="form-textarea" value={newNote} onChange={e=>setNewNote(e.target.value)}
                placeholder="Upiši šta ste pričali... npr. 'Pozvao ga, sviđa mu se stan na Limanu, zakazano gledanje za petak' ili 'Kaže da čeka kredit, javlja se za 2 nedelje'"
                style={{flex:1,minHeight:80}} />
              <button type="submit" className="btn-gold btn-sm" style={{alignSelf:'flex-end',whiteSpace:'nowrap'}}>+ Dodaj</button>
            </form>
            <div className="timeline">
              {buyerNotes.map(n=>(
                <div key={n.id} className="timeline-item">
                  <div className="timeline-date">{new Date(n.created_at).toLocaleDateString('sr-RS', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                  <div className="timeline-text">{n.content}</div>
                </div>
              ))}
              {buyerNotes.length===0 && <p style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>Još nema beleški — dodaj prvu posle prvog razgovora</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Property Matching */}
      <div className="detail-card" style={{marginTop:24}}>
        <div className="detail-card-title">🏠 Odgovarajuće Nekretnine ({propertyMatches.length})</div>
        {propertyMatches.length > 0 ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {propertyMatches.map(m => (
              <a key={m.property.id} href={`/dashboard/properties/${m.property.id}`}
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'rgba(212,175,55,0.04)',borderRadius:8,border:'1px solid rgba(212,175,55,0.1)',color:'#fff',textDecoration:'none',transition:'background 0.2s'}}
                onMouseEnter={e=>(e.currentTarget.style.background='rgba(212,175,55,0.1)')} onMouseLeave={e=>(e.currentTarget.style.background='rgba(212,175,55,0.04)')}>
                <div>
                  <div style={{fontWeight:500,fontSize:'0.9rem'}}>{m.property.title}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--gray-300)',marginTop:2}}>{m.property.location} — €{m.property.price?.toLocaleString('sr-RS')} {m.property.area ? `— ${m.property.area}m²` : ''}</div>
                  <div style={{fontSize:'0.72rem',color:'var(--gold)',marginTop:2}}>{m.reasons.join(' · ')}</div>
                </div>
                <div style={{background:'var(--gold)',color:'#000',borderRadius:20,padding:'2px 10px',fontWeight:700,fontSize:'0.78rem'}}>{m.score} poena</div>
              </a>
            ))}
          </div>
        ) : <p style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>Nema nekretnina koje odgovaraju kriterijumima ovog kupca</p>}
      </div>
    </>
  );
}
