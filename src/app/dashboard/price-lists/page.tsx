'use client';
import { useState, useEffect, useCallback } from 'react';

interface Investor {
  id: string; name: string; contact_person: string; phone: string; email: string; notes: string;
  unit_count: number; available_count: number; sold_count: number;
}
interface Unit {
  id: string; investor_id: string; unit_name: string; floor: string; area: number;
  price_per_m2: number; total_price: number; availability: string; notes: string;
}

const AVAILABILITY_CYCLE = ['Dostupan', 'Rezervisan', 'Prodat'];
const AVAILABILITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Dostupan': { bg: 'rgba(76,175,80,0.12)', color: '#66bb6a', border: 'rgba(76,175,80,0.3)' },
  'Rezervisan': { bg: 'rgba(255,152,0,0.12)', color: '#ffb74d', border: 'rgba(255,152,0,0.3)' },
  'Prodat': { bg: 'rgba(244,67,54,0.12)', color: '#ef5350', border: 'rgba(244,67,54,0.3)' },
};

export default function PriceListsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [loading, setLoading] = useState(true);
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState<string | null>(null);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [investorForm, setInvestorForm] = useState({ name: '', contact_person: '', phone: '', email: '', notes: '' });
  const [unitForm, setUnitForm] = useState({ unit_name: '', floor: '', area: '', price_per_m2: '', total_price: '', availability: 'Dostupan', notes: '' });
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchInvestors = useCallback(async () => {
    try {
      const res = await fetch('/api/price-lists');
      const d = await res.json();
      setInvestors(d.investors || []);
    } catch { showToast('Greška pri učitavanju', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  const fetchUnits = async (investorId: string) => {
    try {
      const res = await fetch(`/api/price-lists/${investorId}/units`);
      const d = await res.json();
      setUnits(prev => ({ ...prev, [investorId]: d.units || [] }));
    } catch { showToast('Greška pri učitavanju stanova', 'error'); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!units[id]) fetchUnits(id);
  };

  const handleAddInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingInvestor ? 'PUT' : 'POST';
      const url = editingInvestor ? `/api/price-lists/${editingInvestor.id}` : '/api/price-lists';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(investorForm) });
      if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
      showToast(editingInvestor ? 'Investitor ažuriran' : 'Investitor dodat');
      setShowInvestorModal(false);
      setEditingInvestor(null);
      setInvestorForm({ name: '', contact_person: '', phone: '', email: '', notes: '' });
      fetchInvestors();
    } catch { showToast('Greška', 'error'); }
  };

  const handleEditInvestor = (inv: Investor) => {
    setEditingInvestor(inv);
    setInvestorForm({ name: inv.name, contact_person: inv.contact_person, phone: inv.phone, email: inv.email, notes: inv.notes });
    setShowInvestorModal(true);
  };

  const handleDeleteInvestor = async (id: string) => {
    if (!confirm('Obriši investitora i sve stanove iz cenovnika?')) return;
    await fetch(`/api/price-lists/${id}`, { method: 'DELETE' });
    showToast('Investitor obrisan');
    if (expandedId === id) setExpandedId(null);
    fetchInvestors();
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showUnitModal) return;
    try {
      const area = parseFloat(unitForm.area) || 0;
      const pricePerM2 = parseFloat(unitForm.price_per_m2) || 0;
      const totalPrice = parseFloat(unitForm.total_price) || (area * pricePerM2);

      if (editingUnit) {
        // Edit existing unit
        const res = await fetch(`/api/price-lists/units/${editingUnit.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...unitForm, area, price_per_m2: pricePerM2, total_price: totalPrice })
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
        showToast('Stan ažuriran');
      } else {
        // Add new unit
        const res = await fetch(`/api/price-lists/${showUnitModal}/units`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...unitForm, area, price_per_m2: pricePerM2, total_price: totalPrice })
        });
        if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
        showToast('Stan dodat u cenovnik');
      }
      setShowUnitModal(null);
      setEditingUnit(null);
      setUnitForm({ unit_name: '', floor: '', area: '', price_per_m2: '', total_price: '', availability: 'Dostupan', notes: '' });
      fetchUnits(editingUnit ? editingUnit.investor_id : showUnitModal);
      fetchInvestors();
    } catch { showToast('Greška', 'error'); }
  };

  const handleEditUnit = (u: Unit) => {
    setEditingUnit(u);
    setUnitForm({
      unit_name: u.unit_name,
      floor: u.floor || '',
      area: u.area ? String(u.area) : '',
      price_per_m2: u.price_per_m2 ? String(u.price_per_m2) : '',
      total_price: u.total_price ? String(u.total_price) : '',
      availability: u.availability || 'Dostupan',
      notes: u.notes || ''
    });
    setShowUnitModal(u.investor_id);
  };

  const cycleAvailability = async (unit: Unit) => {
    const currentIdx = AVAILABILITY_CYCLE.indexOf(unit.availability);
    const next = AVAILABILITY_CYCLE[(currentIdx + 1) % AVAILABILITY_CYCLE.length];
    try {
      await fetch(`/api/price-lists/units/${unit.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: next })
      });
      setUnits(prev => ({
        ...prev,
        [unit.investor_id]: (prev[unit.investor_id] || []).map(u => u.id === unit.id ? { ...u, availability: next } : u)
      }));
      fetchInvestors();
    } catch { showToast('Greška pri ažuriranju', 'error'); }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!confirm(`Obriši ${unit.unit_name} iz cenovnika?`)) return;
    await fetch(`/api/price-lists/units/${unit.id}`, { method: 'DELETE' });
    showToast('Stan obrisan');
    fetchUnits(unit.investor_id);
    fetchInvestors();
  };

  const formatPrice = (p: number) => {
    if (!p) return '—';
    return p.toLocaleString('de-DE') + ' €';
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-300)' }}>Učitavanje...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10,
          background: toast.type === 'error' ? 'rgba(244,67,54,0.95)' : 'rgba(76,175,80,0.95)',
          color: '#fff', fontWeight: 600, fontSize: '0.85rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'var(--gold)', margin: 0 }}>
            Cenovnici
          </h1>
          <p style={{ color: 'var(--gray-300)', fontSize: '0.85rem', marginTop: 4 }}>
            {investors.length} investitor{investors.length !== 1 ? 'a' : ''} · Brza referenca za pozive
          </p>
        </div>
        <button className="btn-gold btn-sm" onClick={() => { setEditingInvestor(null); setInvestorForm({ name: '', contact_person: '', phone: '', email: '', notes: '' }); setShowInvestorModal(true); }}>
          + Dodaj Investitora
        </button>
      </div>

      {/* Investors accordion */}
      {investors.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-300)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
          <p style={{ fontSize: '1rem' }}>Nema investitora u cenovnicima</p>
          <p style={{ fontSize: '0.85rem' }}>Kliknite &quot;+ Dodaj Investitora&quot; da počnete</p>
        </div>
      )}

      {investors.map((inv) => {
        const isOpen = expandedId === inv.id;
        const invUnits = units[inv.id] || [];
        return (
          <div key={inv.id} style={{
            marginBottom: 8, borderRadius: 12,
            border: `1px solid ${isOpen ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.06)'}`,
            background: isOpen ? 'rgba(212,175,55,0.03)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.3s ease', overflow: 'hidden'
          }}>
            {/* Investor header */}
            <div
              onClick={() => toggleExpand(inv.id)}
              style={{
                display: 'flex', alignItems: 'center', padding: '14px 20px', cursor: 'pointer',
                gap: 16, transition: 'background 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--gold)' }}
                xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Cinzel, serif', color: '#fff' }}>{inv.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-300)', marginTop: 2 }}>
                  {inv.contact_person && <span>👤 {inv.contact_person}</span>}
                  {inv.phone && <span style={{ marginLeft: inv.contact_person ? 12 : 0 }}>📞 {inv.phone}</span>}
                  {inv.email && <span style={{ marginLeft: 12 }}>✉️ {inv.email}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: 6,
                  background: 'rgba(76,175,80,0.1)', color: '#66bb6a', fontWeight: 600 }}>
                  {inv.available_count} dostupno
                </span>
                {inv.sold_count > 0 && (
                  <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: 6,
                    background: 'rgba(244,67,54,0.1)', color: '#ef5350', fontWeight: 600 }}>
                    {inv.sold_count} prodato
                  </span>
                )}
                <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: 6,
                  background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', fontWeight: 600 }}>
                  {inv.unit_count} stanova
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => handleEditInvestor(inv)} title="Izmeni"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}>
                  ✏️
                </button>
                <button onClick={() => handleDeleteInvestor(inv.id)} title="Obriši"
                  style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}>
                  🗑
                </button>
              </div>
            </div>

            {/* Expanded units table */}
            {isOpen && (
              <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--gray-300)', fontWeight: 600 }}>
                    Cenovnik — {inv.name}
                  </span>
                  <button className="btn-gold btn-sm" style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                    onClick={() => { setEditingUnit(null); setUnitForm({ unit_name: '', floor: '', area: '', price_per_m2: '', total_price: '', availability: 'Dostupan', notes: '' }); setShowUnitModal(inv.id); }}>
                    + Dodaj Stan
                  </button>
                </div>

                {invUnits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray-300)', fontSize: '0.85rem' }}>
                    Nema stanova. Kliknite &quot;+ Dodaj Stan&quot; da dodate.
                  </div>
                ) : (
                  <div className="table-overflow">
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Stan</th>
                          <th>Sprat</th>
                          <th>M²</th>
                          <th>Cena/m² (PDV)</th>
                          <th>Ukupno</th>
                          <th>Dostupnost</th>
                          <th>Napomena</th>
                          <th style={{ width: 80 }}>Akcije</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invUnits.map(u => {
                          const avail = AVAILABILITY_COLORS[u.availability] || AVAILABILITY_COLORS['Dostupan'];
                          return (
                            <tr key={u.id} style={{
                              opacity: u.availability === 'Prodat' ? 0.5 : 1,
                              transition: 'opacity 0.2s'
                            }}>
                              <td style={{ fontWeight: 600 }}>{u.unit_name}</td>
                              <td style={{ color: 'var(--gray-300)' }}>{u.floor || '—'}</td>
                              <td>{u.area ? `${u.area} m²` : '—'}</td>
                              <td style={{ color: 'var(--gold)', fontWeight: 500 }}>{formatPrice(u.price_per_m2)}</td>
                              <td style={{ fontWeight: 600 }}>{formatPrice(u.total_price)}</td>
                              <td>
                                <button onClick={() => cycleAvailability(u)} title="Klikni za promenu"
                                  style={{
                                    background: avail.bg, color: avail.color, border: `1px solid ${avail.border}`,
                                    borderRadius: 6, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.2s', minWidth: 90
                                  }}>
                                  {u.availability}
                                </button>
                              </td>
                              <td style={{ color: 'var(--gray-300)', fontSize: '0.8rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.notes || '—'}
                              </td>
                              <td style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleEditUnit(u)} title="Izmeni"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.2s' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.15)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
                                  ✏️
                                </button>
                                <button onClick={() => handleDeleteUnit(u)} title="Obriši"
                                  style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.2s' }}
                                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}>
                                  🗑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add/Edit Investor Modal */}
      {showInvestorModal && (
        <div className="modal-overlay" onClick={() => { setShowInvestorModal(false); setEditingInvestor(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">{editingInvestor ? '✏️ Izmeni Investitora' : '🏢 Novi Investitor'}</div>
              <button className="modal-close" onClick={() => { setShowInvestorModal(false); setEditingInvestor(null); }}>×</button>
            </div>
            <form onSubmit={handleAddInvestor}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Naziv Investitora *</label>
                  <input className="form-input" required value={investorForm.name} onChange={e => setInvestorForm({ ...investorForm, name: e.target.value })} placeholder="npr. Graviton, Modena..." />
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Kontakt Osoba</label>
                    <input className="form-input" value={investorForm.contact_person} onChange={e => setInvestorForm({ ...investorForm, contact_person: e.target.value })} placeholder="Ime i prezime" />
                  </div>
                  <div className="form-group">
                    <label>Telefon</label>
                    <input className="form-input" value={investorForm.phone} onChange={e => setInvestorForm({ ...investorForm, phone: e.target.value })} placeholder="+381..." />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-input" type="email" value={investorForm.email} onChange={e => setInvestorForm({ ...investorForm, email: e.target.value })} placeholder="email@investitor.rs" />
                </div>
                <div className="form-group">
                  <label>Napomene</label>
                  <textarea className="form-input" rows={2} value={investorForm.notes} onChange={e => setInvestorForm({ ...investorForm, notes: e.target.value })} placeholder="Dodatne napomene..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => { setShowInvestorModal(false); setEditingInvestor(null); }}>Otkaži</button>
                <button type="submit" className="btn-gold">{editingInvestor ? 'Sačuvaj' : 'Dodaj'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showUnitModal && (
        <div className="modal-overlay" onClick={() => { setShowUnitModal(null); setEditingUnit(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <div className="modal-title">{editingUnit ? '✏️ Izmeni Stan' : '🏠 Dodaj Stan u Cenovnik'}</div>
              <button className="modal-close" onClick={() => { setShowUnitModal(null); setEditingUnit(null); }}>×</button>
            </div>
            <form onSubmit={handleAddUnit}>
              <div className="modal-body">
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Naziv Stana *</label>
                    <input className="form-input" required value={unitForm.unit_name} onChange={e => setUnitForm({ ...unitForm, unit_name: e.target.value })} placeholder="Stan 1, G2..." />
                  </div>
                  <div className="form-group">
                    <label>Sprat</label>
                    <input className="form-input" value={unitForm.floor} onChange={e => setUnitForm({ ...unitForm, floor: e.target.value })} placeholder="Prizemlje, I sprat..." />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>M²</label>
                    <input className="form-input" type="number" step="0.01" value={unitForm.area} onChange={e => {
                      const area = e.target.value;
                      const total = (parseFloat(area) || 0) * (parseFloat(unitForm.price_per_m2) || 0);
                      setUnitForm({ ...unitForm, area, total_price: total ? total.toFixed(0) : '' });
                    }} placeholder="45.5" />
                  </div>
                  <div className="form-group">
                    <label>Cena/m² (PDV)</label>
                    <input className="form-input" type="number" step="0.01" value={unitForm.price_per_m2} onChange={e => {
                      const price = e.target.value;
                      const total = (parseFloat(unitForm.area) || 0) * (parseFloat(price) || 0);
                      setUnitForm({ ...unitForm, price_per_m2: price, total_price: total ? total.toFixed(0) : '' });
                    }} placeholder="3000" />
                  </div>
                  <div className="form-group">
                    <label>Ukupno (€)</label>
                    <input className="form-input" type="number" step="0.01" value={unitForm.total_price} onChange={e => setUnitForm({ ...unitForm, total_price: e.target.value })} placeholder="Auto" />
                  </div>
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Dostupnost</label>
                    <select className="form-select" value={unitForm.availability} onChange={e => setUnitForm({ ...unitForm, availability: e.target.value })}>
                      <option>Dostupan</option>
                      <option>Rezervisan</option>
                      <option>Prodat</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Napomena</label>
                    <input className="form-input" value={unitForm.notes} onChange={e => setUnitForm({ ...unitForm, notes: e.target.value })} placeholder="Opciono..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => { setShowUnitModal(null); setEditingUnit(null); }}>Otkaži</button>
                <button type="submit" className="btn-gold">{editingUnit ? 'Sačuvaj Izmene' : 'Dodaj Stan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
