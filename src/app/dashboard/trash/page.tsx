'use client';
import { useEffect, useState } from 'react';

interface TrashRecord {
  id: string; entity: string; entity_id: string; label: string;
  deleted_by_name: string; deleted_at: string; restored_at: string | null; restored_by_name: string | null;
}

const ENTITY_LABELS: Record<string, string> = {
  property: 'Nekretnina', buyer: 'Kupac', owner: 'Vlasnik', project: 'Projekat', user: 'Korisnik',
  price_list_investor: 'Investitor', price_list_unit: 'Stan u cenovniku',
};

// deleted_at is stored as UTC "YYYY-MM-DD HH:MM:SS"
const fmt = (d: string) => new Date(d.replace(' ', 'T') + 'Z').toLocaleString('sr-RS');

export default function TrashPage() {
  const [records, setRecords] = useState<TrashRecord[]>([]);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [busy, setBusy] = useState<string|null>(null);

  const load = () => { fetch('/api/trash').then(r=>r.json()).then(d=>setRecords(d.records||[])); };
  useEffect(load, []);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 4000); };

  const restore = async (r: TrashRecord) => {
    if (!confirm(`Vratiti „${r.label}“ u CRM?`)) return;
    setBusy(r.id);
    const res = await fetch(`/api/trash/${r.id}/restore`, { method: 'POST' });
    const d = await res.json();
    setBusy(null);
    if (res.ok) { showToast('Vraćeno u CRM ✓'); load(); }
    else showToast(d.error || 'Greška', 'error');
  };

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      <div className="table-card">
        <div className="table-header">
          <div className="table-title">🗑 Korpa — obrisani zapisi ({records.filter(r=>!r.restored_at).length})</div>
        </div>
        <p style={{color:'var(--gray-300)',fontSize:'0.85rem',padding:'0 1.25rem 0.75rem'}}>
          Sve što se obriše iz CRM-a čuva se ovde i može da se vrati jednim klikom.
        </p>
        <div className="table-overflow">
          <table className="data-table">
            <thead><tr><th>Šta</th><th>Naziv</th><th>Obrisao</th><th>Kada</th><th></th></tr></thead>
            <tbody>
              {records.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:'center',color:'var(--gray-300)',padding:'2rem'}}>Ništa nije obrisano.</td></tr>
              )}
              {records.map(r=>(
                <tr key={r.id} style={r.restored_at ? {opacity:0.5} : undefined}>
                  <td><span className="badge badge-new">{ENTITY_LABELS[r.entity] || r.entity}</span></td>
                  <td style={{fontWeight:500}}>{r.label}</td>
                  <td style={{color:'var(--gray-300)'}}>{r.deleted_by_name}</td>
                  <td style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>{fmt(r.deleted_at)}</td>
                  <td>
                    {r.restored_at
                      ? <span style={{fontSize:'0.8rem',color:'var(--gray-300)'}}>Vraćeno ({r.restored_by_name})</span>
                      : <button className="btn-gold btn-sm" disabled={busy===r.id} onClick={()=>restore(r)}>↩ Vrati</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
