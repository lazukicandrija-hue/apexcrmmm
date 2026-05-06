'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string;
  active: number;
  last_used_at: string | null;
  created_at: string;
  created_by_name: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('Mark — Telegram Bot');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      setToast({ msg: 'Greška pri učitavanju ključeva', type: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, permissions: newKeyPermissions }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedKey(data.key);
        setToast({ msg: 'API ključ kreiran!', type: 'success' });
        fetchKeys();
      } else {
        setToast({ msg: data.error, type: 'error' });
      }
    } catch {
      setToast({ msg: 'Greška pri kreiranju', type: 'error' });
    }
  };

  const handleToggle = async (id: string, currentActive: number) => {
    await fetch(`/api/keys/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: currentActive ? 0 : 1 }),
    });
    setToast({ msg: currentActive ? 'Ključ deaktiviran' : 'Ključ aktiviran', type: 'success' });
    fetchKeys();
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigurno želiš da obrišeš ovaj API ključ? Bot više neće moći da pristupa CRM-u.')) return;
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    setToast({ msg: 'Ključ deaktiviran', type: 'success' });
    fetchKeys();
    setTimeout(() => setToast(null), 3000);
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Učitavanje...</div>;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000, padding: '12px 20px', borderRadius: 10,
          background: toast.type === 'error' ? 'rgba(255,60,60,0.15)' : 'rgba(76,175,80,0.15)',
          color: toast.type === 'error' ? '#ff6b6b' : '#4caf50',
          border: `1px solid ${toast.type === 'error' ? 'rgba(255,60,60,0.3)' : 'rgba(76,175,80,0.3)'}`,
          backdropFilter: 'blur(10px)', fontSize: '0.9rem',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>🤖 API Ključevi</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--gray-300)', fontSize: '0.85rem' }}>
            Upravljaj pristupom za botove i eksterne integracije
          </p>
        </div>
        <button className="btn-gold" onClick={() => { setShowCreate(true); setCreatedKey(null); }}>
          + Novi Ključ
        </button>
      </div>

      {/* Info box */}
      <div style={{
        background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 12,
        padding: 20, marginBottom: 24,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 8 }}>ℹ️ Kako funkcioniše?</div>
        <div style={{ color: 'var(--gray-300)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          API ključ omogućava tvom botu (npr. Marku na Telegramu) da pristupa CRM-u bez korisničkog imena i lozinke.<br />
          Bot šalje ključ u svakom zahtevu: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>Authorization: Bearer apex_...</code><br />
          Kad bot kreira nekretninu sa <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>published: true</code>, automatski se pojavljuje na sajtu.
        </div>
      </div>

      {/* Created Key Modal */}
      {createdKey && (
        <div className="modal-overlay" onClick={() => setCreatedKey(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">🔑 Tvoj novi API ključ</div>
              <button className="modal-close" onClick={() => setCreatedKey(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ff8a8a', fontSize: '0.85rem',
              }}>
                ⚠️ SAČUVAJ OVAJ KLJUČ! Neće biti ponovo prikazan.
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 14px',
                fontFamily: 'monospace', fontSize: '0.8rem', color: '#fff', wordBreak: 'break-all',
                border: '1px solid rgba(212,175,55,0.2)', position: 'relative',
              }}>
                {createdKey}
                <button onClick={copyKey} style={{
                  position: 'absolute', top: 8, right: 8, background: 'var(--gold)', color: '#000',
                  border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                }}>
                  {copied ? '✓ Kopirano!' : '📋 Kopiraj'}
                </button>
              </div>
              <div style={{ marginTop: 16, color: 'var(--gray-300)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                <strong style={{ color: '#fff' }}>Pošalji ovaj ključ Marku</strong> na Telegramu i reci mu:<br />
                <em>&quot;Ovo je tvoj API ključ za Apex CRM. Koristi ga kao Bearer token za sve zahteve.&quot;</em>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-gold" onClick={() => setCreatedKey(null)}>Razumem, sačuvao sam</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && !createdKey && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🤖 Novi API Ključ</div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Naziv (za koga je ključ) *</label>
                <input className="form-input" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="npr. Mark — Telegram Bot" />
              </div>
              <div className="form-group">
                <label>Ovlašćenja</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newKeyPermissions.includes('read')}
                      onChange={e => {
                        if (e.target.checked) setNewKeyPermissions([...newKeyPermissions, 'read']);
                        else setNewKeyPermissions(newKeyPermissions.filter(p => p !== 'read'));
                      }} />
                    📖 Čitanje
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newKeyPermissions.includes('write')}
                      onChange={e => {
                        if (e.target.checked) setNewKeyPermissions([...newKeyPermissions, 'write']);
                        else setNewKeyPermissions(newKeyPermissions.filter(p => p !== 'write'));
                      }} />
                    ✏️ Pisanje
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowCreate(false)}>Otkaži</button>
              <button className="btn-gold" onClick={handleCreate} disabled={!newKeyName.trim()}>Kreiraj Ključ</button>
            </div>
          </div>
        </div>
      )}

      {/* Keys Table */}
      {keys.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.02)',
          borderRadius: 16, border: '1px dashed rgba(212,175,55,0.2)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>Nema API ključeva</div>
          <div style={{ color: 'var(--gray-300)', fontSize: '0.85rem', marginBottom: 20 }}>
            Kreiraj prvi ključ za Marka da može da pristupa CRM-u
          </div>
          <button className="btn-gold" onClick={() => setShowCreate(true)}>+ Kreiraj API Ključ</button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Naziv</th>
                <th>Ključ</th>
                <th>Ovlašćenja</th>
                <th>Status</th>
                <th>Poslednje korišćenje</th>
                <th>Kreiran</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{ opacity: k.active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td>
                    <code style={{
                      background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 4,
                      fontSize: '0.8rem', color: 'var(--gold)',
                    }}>
                      {k.key_prefix}...
                    </code>
                  </td>
                  <td>
                    {JSON.parse(k.permissions).map((p: string) => (
                      <span key={p} style={{
                        display: 'inline-block', background: p === 'write' ? 'rgba(255,152,0,0.15)' : 'rgba(76,175,80,0.15)',
                        color: p === 'write' ? '#ffb74d' : '#81c784', padding: '2px 8px', borderRadius: 4,
                        fontSize: '0.75rem', marginRight: 4,
                      }}>
                        {p === 'read' ? '📖' : '✏️'} {p}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                      background: k.active ? 'rgba(76,175,80,0.15)' : 'rgba(255,60,60,0.15)',
                      color: k.active ? '#4caf50' : '#ff6b6b',
                    }}>
                      {k.active ? '● Aktivan' : '○ Neaktivan'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--gray-300)', fontSize: '0.85rem' }}>
                    {k.last_used_at ? formatDate(k.last_used_at) : <span style={{ color: '#666' }}>Nikada</span>}
                  </td>
                  <td style={{ color: 'var(--gray-300)', fontSize: '0.85rem' }}>{formatDate(k.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleToggle(k.id, k.active)}
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          color: '#ccc', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem',
                        }}
                      >
                        {k.active ? '⏸ Pauziraj' : '▶ Aktiviraj'}
                      </button>
                      <button
                        onClick={() => handleDelete(k.id)}
                        style={{
                          background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.2)',
                          color: '#ff6b6b', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem',
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* API Reference */}
      <div style={{
        marginTop: 32, background: 'rgba(255,255,255,0.02)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: 24,
      }}>
        <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: '1rem' }}>📡 API Referenca za Marka</h3>
        <div style={{ display: 'grid', gap: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {[
            { method: 'GET', path: '/api/bot/status', desc: 'Status i statistike' },
            { method: 'GET', path: '/api/bot/properties', desc: 'Lista nekretnina' },
            { method: 'POST', path: '/api/bot/properties', desc: 'Kreiraj nekretninu' },
            { method: 'GET', path: '/api/bot/properties/:id', desc: 'Detalji nekretnine' },
            { method: 'PUT', path: '/api/bot/properties/:id', desc: 'Ažuriraj nekretninu' },
            { method: 'GET', path: '/api/bot/owners', desc: 'Lista vlasnika' },
            { method: 'POST', path: '/api/bot/owners', desc: 'Kreiraj vlasnika' },
          ].map(e => (
            <div key={e.path + e.method} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{
                display: 'inline-block', width: 50, textAlign: 'center', padding: '2px 0', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700,
                background: e.method === 'GET' ? 'rgba(76,175,80,0.2)' : e.method === 'POST' ? 'rgba(33,150,243,0.2)' : 'rgba(255,152,0,0.2)',
                color: e.method === 'GET' ? '#81c784' : e.method === 'POST' ? '#64b5f6' : '#ffb74d',
              }}>{e.method}</span>
              <span style={{ color: 'var(--gold)', flex: 1 }}>{e.path}</span>
              <span style={{ color: 'var(--gray-300)', fontFamily: 'inherit' }}>{e.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, color: 'var(--gray-300)', fontSize: '0.8rem' }}>
          Base URL: <code style={{ color: 'var(--gold)' }}>https://crm.apexrealestate.rs</code>
        </div>
      </div>
    </div>
  );
}
