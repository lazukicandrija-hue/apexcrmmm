'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Buyer {
  id:string; first_name:string; last_name:string; phone:string; email:string;
  desired_type:string; location:string; budget:number; notes:string;
  next_action_date:string; status:string; created_at:string;
}
interface NoteEntry { id:string; content:string; created_at:string; }
interface PropertyMatch { property:{id:string;title:string;location:string;price:number;type:string;area:number;rooms:number;}; score:number; reasons:string[]; }

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

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <Link href="/dashboard/buyers" className="back-link">← Nazad na listu</Link>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:'1.5rem'}}>{buyer.first_name} {buyer.last_name}</h2>
          <p style={{color:'var(--gray-300)',margin:'4px 0 0'}}>{buyer.desired_type ? `Traži: ${buyer.desired_type}` : 'Kupac'}</p>
        </div>
        <button className="btn-danger btn-sm" onClick={handleDelete}>🗑 Obriši</button>
      </div>

      <div className="detail-grid">
        {/* Left column - Info */}
        <div>
          <div className="detail-card" style={{marginBottom:20}}>
            <div className="detail-card-title">Informacije o Kupcu</div>
            <div className="detail-row"><span className="detail-label">Telefon</span><span className="detail-value"><a href={`tel:${buyer.phone}`} style={{color:'var(--gold)'}}>{buyer.phone}</a></span></div>
            <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value"><a href={`mailto:${buyer.email}`} style={{color:'var(--gold)'}}>{buyer.email}</a></span></div>
            <div className="detail-row"><span className="detail-label">Traži</span><span className="detail-value">{buyer.desired_type||'-'}</span></div>
            <div className="detail-row"><span className="detail-label">Lokacija</span><span className="detail-value">{buyer.location||'-'}</span></div>
            <div className="detail-row"><span className="detail-label">Budžet</span><span className="detail-value" style={{color:'var(--gold)'}}>€{buyer.budget?.toLocaleString('sr-RS')||'-'}</span></div>
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
            {buyer.notes && <div style={{marginTop:12}}><div className="detail-label" style={{marginBottom:6}}>Inicijalne napomene</div><p style={{fontSize:'0.82rem',color:'var(--gray-200)',background:'rgba(212,175,55,0.05)',padding:10,borderRadius:8,lineHeight:1.5}}>{buyer.notes}</p></div>}
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
