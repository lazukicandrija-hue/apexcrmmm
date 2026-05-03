'use client';
import { useEffect, useState } from 'react';

interface User { id:string; username:string; full_name:string; role:string; created_at:string; }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);
  const [form, setForm] = useState({username:'',password:'',full_name:'',role:'agent'});

  const load = () => { fetch('/api/users').then(r=>r.json()).then(d=>setUsers(d.users||[])); };
  useEffect(load, []);

  const showToast = (msg:string, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form)
    });
    const d = await res.json();
    if (res.ok) { showToast('Korisnik kreiran!'); setShowModal(false); load(); setForm({username:'',password:'',full_name:'',role:'agent'}); }
    else showToast(d.error||'Greška','error');
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Obrisati korisnika?')) return;
    const res = await fetch(`/api/users/${id}`, {method:'DELETE'});
    const d = await res.json();
    if (res.ok) { showToast('Korisnik obrisan'); load(); }
    else showToast(d.error||'Greška','error');
  };

  return (
    <>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="table-card">
        <div className="table-header">
          <div className="table-title">Korisnici ({users.length})</div>
          <button className="btn-gold btn-sm" onClick={()=>setShowModal(true)}>+ Novi Korisnik</button>
        </div>
        <div className="table-overflow">
          <table className="data-table">
            <thead><tr><th>Ime</th><th>Username</th><th>Uloga</th><th>Kreiran</th><th>Akcije</th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:500}}>{u.full_name}</td>
                  <td style={{color:'var(--gray-300)'}}>{u.username}</td>
                  <td><span className={`badge ${u.role==='admin'?'badge-active':'badge-new'}`}>{u.role}</span></td>
                  <td style={{color:'var(--gray-300)',fontSize:'0.85rem'}}>{new Date(u.created_at).toLocaleDateString('sr-RS')}</td>
                  <td><button className="btn-danger btn-sm" onClick={()=>handleDelete(u.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Novi Korisnik</div>
              <button className="modal-close" onClick={()=>setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Puno Ime *</label><input className="form-input" required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} /></div>
                <div className="form-group"><label>Username *</label><input className="form-input" required value={form.username} onChange={e=>setForm({...form,username:e.target.value})} /></div>
                <div className="form-group"><label>Lozinka *</label><input className="form-input" type="password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
                <div className="form-group">
                  <label>Uloga</label>
                  <select className="form-select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                    <option value="agent">Agent</option><option value="admin">Admin</option>
                  </select>
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
