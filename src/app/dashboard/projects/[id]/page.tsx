'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  name: string;
  location: string;
  description: string;
  website_description: string;
  developer: string;
  total_units: number;
  images: string;
  published: number;
  completion_date: string;
  created_at: string;
}

interface Unit {
  id: string;
  code: string;
  title: string;
  area: number;
  rooms: number;
  floor: string;
  price: number;
  status: string;
  published: number;
  images: string;
  owner_first_name: string;
  owner_last_name: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', location: '', description: '', website_description: '', developer: '', completion_date: '', total_units: 0,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ title: '', floor: '', area: '', rooms: '', price: '' });
  const [creatingUnit, setCreatingUnit] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setProject(data.project);
      setUnits(data.units || []);
      setProjectImages(JSON.parse(data.project.images || '[]'));
    } catch {
      showToast('Projekat nije pronađen', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const enterEdit = () => {
    if (!project) return;
    setEditForm({
      name: project.name || '',
      location: project.location || '',
      description: project.description || '',
      website_description: project.website_description || '',
      developer: project.developer || '',
      completion_date: project.completion_date || '',
      total_units: project.total_units || 0,
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      showToast('Projekat ažuriran ✓');
      setEditMode(false);
      load();
    } catch {
      showToast('Greška pri čuvanju', 'error');
    }
  };

  const togglePublish = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      load();
    } catch (e) {
      showToast((e as Error).message || 'Greška', 'error');
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('images', f));
      const res = await fetch(`/api/projects/${id}/images`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjectImages(data.images);
      showToast(data.message);
    } catch {
      showToast('Greška pri uploadu', 'error');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imagePath: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjectImages(data.images);
      showToast('Slika obrisana');
    } catch {
      showToast('Greška pri brisanju slike', 'error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleImageUpload(e.dataTransfer.files);
  };

  const handleDelete = async () => {
    if (!confirm('Obrisati projekat? Stanovi neće biti obrisani, samo odvojeni od projekta.')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      router.push('/dashboard/properties?category=Novogradnja');
    } catch {
      showToast('Greška pri brisanju', 'error');
    }
  };

  const createUnit = async () => {
    if (!unitForm.title.trim()) { showToast('Unesite naziv stana', 'error'); return; }
    setCreatingUnit(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${project?.name} - ${unitForm.title}`,
          location: project?.location || '',
          type: 'Novogradnja',
          floor: unitForm.floor || null,
          area: unitForm.area ? Number(unitForm.area) : null,
          rooms: unitForm.rooms ? Number(unitForm.rooms) : null,
          price: unitForm.price ? Number(unitForm.price) : null,
          status: 'Aktivna',
          project_id: id,
          owner_id: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Stan "${unitForm.title}" kreiran (${data.code}) ✓`);
      setShowUnitModal(false);
      setUnitForm({ title: '', floor: '', area: '', rooms: '', price: '' });
      // Open the newly created unit detail page
      router.push(`/dashboard/properties/${data.id}`);
    } catch {
      showToast('Greška pri kreiranju stana', 'error');
    } finally {
      setCreatingUnit(false);
    }
  };

  if (loading) return <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="loading-spinner" /></div>;
  if (!project) return <div className="page-content"><p>Projekat nije pronađen.</p></div>;

  const activeCount = units.filter(u => u.status === 'Aktivna').length;
  const soldCount = units.filter(u => u.status === 'Prodato').length;
  const negotiationCount = units.filter(u => u.status === 'U pregovoru').length;

  return (
    <div className="page-content">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button className="back-link" onClick={() => router.push('/dashboard/properties?category=Novogradnja')} style={{ marginBottom: '0.5rem', display: 'block' }}>
            ← Nazad na Novogradnju
          </button>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'var(--gold)' }}>
            {project.name}
          </h1>
          <span style={{ color: '#999', fontSize: '0.85rem' }}>📍 {project.location}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!editMode && <button className="btn-outline btn-sm" onClick={enterEdit}>✏️ Izmeni</button>}
          <button
            className={project.published ? 'btn-danger btn-sm' : 'btn-gold btn-sm'}
            onClick={togglePublish}
          >
            {project.published ? '🔴 Ukloni sa sajta' : '🌐 Objavi na sajt'}
          </button>
          <button className="btn-outline btn-sm" onClick={handleDelete} style={{ borderColor: '#ff4444', color: '#ff4444' }}>🗑️ Obriši</button>
        </div>
      </div>

      {/* Status badge */}
      {project.published ? (
        <div style={{ background: 'rgba(76, 175, 80, 0.15)', border: '1px solid rgba(76, 175, 80, 0.4)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#4CAF50', fontSize: '0.9rem' }}>
          ✅ Projekat je objavljen na sajtu — apexrealestate.rs
        </div>
      ) : (
        <div style={{ background: 'rgba(255, 170, 0, 0.1)', border: '1px solid rgba(255, 170, 0, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#ffaa00', fontSize: '0.9rem' }}>
          📝 Projekat je u pripremi — nije objavljen na sajtu
        </div>
      )}

      <div className="detail-grid">
        {/* Left Column */}
        <div>
          {/* Images */}
          <div className="detail-card">
            <h3 className="detail-card-title">🏗️ Slike Projekta (Renderi Zgrade)</h3>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(212, 175, 55, 0.3)', borderRadius: '8px', padding: '2rem',
                textAlign: 'center', cursor: 'pointer', marginBottom: '1rem',
                background: 'rgba(212, 175, 55, 0.03)', transition: 'all 0.2s',
              }}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={e => handleImageUpload(e.target.files)} />
              {uploading ? '⏳ Upload u toku...' : '📁 Klikni ili prevuci slike ovde'}
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>JPG, PNG, WebP — do 10MB</div>
            </div>
            {projectImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                {projectImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '4/3', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={img} alt={`Render ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteImage(img); }}
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '0.7rem' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Website description */}
          <div className="detail-card">
            <h3 className="detail-card-title">🌐 Opis Projekta za Sajt</h3>
            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>Ovaj opis će se prikazivati na javnom sajtu apexrealestate.rs</p>
            {editMode ? (
              <textarea
                className="form-textarea"
                value={editForm.website_description}
                onChange={e => setEditForm({ ...editForm, website_description: e.target.value })}
                rows={6}
                placeholder="Upišite detaljan opis projekta za sajt..."
              />
            ) : (
              <p style={{ color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {project.website_description || <span style={{ color: '#666', fontStyle: 'italic' }}>Nema opisa za sajt — klikni Izmeni da dodaš</span>}
              </p>
            )}
          </div>

          {/* Project details */}
          <div className="detail-card">
            <h3 className="detail-card-title">📋 Detalji Projekta</h3>
            {editMode ? (
              <div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block' }}>Naziv projekta</label>
                    <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block' }}>Lokacija</label>
                    <input className="form-input" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block' }}>Investitor (interno)</label>
                    <input className="form-input" value={editForm.developer} onChange={e => setEditForm({ ...editForm, developer: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block' }}>Datum završetka</label>
                    <input className="form-input" value={editForm.completion_date} onChange={e => setEditForm({ ...editForm, completion_date: e.target.value })} placeholder="npr. Mart 2027" />
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block' }}>Ukupno stanova</label>
                  <input className="form-input" type="number" value={editForm.total_units} onChange={e => setEditForm({ ...editForm, total_units: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.25rem', display: 'block' }}>Interni opis (neće biti na sajtu)</label>
                  <textarea className="form-textarea" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn-gold" onClick={saveEdit}>💾 Sačuvaj</button>
                  <button className="btn-outline" onClick={() => setEditMode(false)}>Otkaži</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="detail-row"><span className="detail-label">Naziv</span><span className="detail-value">{project.name}</span></div>
                <div className="detail-row"><span className="detail-label">Lokacija</span><span className="detail-value">{project.location}</span></div>
                <div className="detail-row"><span className="detail-label">Investitor</span><span className="detail-value">{project.developer || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Datum završetka</span><span className="detail-value">{project.completion_date || '—'}</span></div>
                <div className="detail-row"><span className="detail-label">Ukupno stanova</span><span className="detail-value">{project.total_units || units.length}</span></div>
                {project.description && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>Interni opis:</span>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '0.25rem' }}>{project.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Units table */}
        <div>
          <div className="detail-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="detail-card-title" style={{ marginBottom: 0 }}>🏠 Stanovi u projektu ({units.length})</h3>
              <button className="btn-gold btn-sm" onClick={() => setShowUnitModal(true)}>+ Dodaj Stan</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(76,175,80,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#4CAF50' }}>🟢 Slobodno: {activeCount}</span>
              </div>
              <div style={{ background: 'rgba(255,170,0,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#ffaa00' }}>🟡 U pregovoru: {negotiationCount}</span>
              </div>
              <div style={{ background: 'rgba(66,133,244,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#4285F4' }}>🔵 Prodato: {soldCount}</span>
              </div>
            </div>

            {/* Units table */}
            <div className="table-overflow">
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Šifra</th>
                    <th>Naziv</th>
                    <th>Sprat</th>
                    <th>m²</th>
                    <th>Sobe</th>
                    <th>Cena</th>
                    <th>Status</th>
                    <th>Skica</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(unit => (
                    <tr
                      key={unit.id}
                      onClick={() => router.push(`/dashboard/properties/${unit.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><span style={{ color: 'var(--gold)', fontWeight: 600 }}>{unit.code}</span></td>
                      <td>{unit.title?.replace(`${project.name} - `, '')}</td>
                      <td>{unit.floor || '—'}</td>
                      <td>{unit.area}m²</td>
                      <td>{unit.rooms}</td>
                      <td>{unit.price ? `€${unit.price.toLocaleString()}` : '—'}</td>
                      <td>
                        <span className={`badge ${unit.status === 'Aktivna' ? 'badge-active' : unit.status === 'Prodato' ? 'badge-sold' : 'badge-negotiation'}`}>
                          {unit.status}
                        </span>
                      </td>
                      <td className="ng-cell-skica">
                        {(() => {
                          const imgs: string[] = JSON.parse(unit.images || '[]');
                          return imgs.length > 0 ? (
                            <a href={imgs[0]} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="ng-btn-plan">
                              <img src={imgs[0]} alt="Skica" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(212,175,55,0.3)' }} />
                              Skica
                            </a>
                          ) : (
                            <span style={{ color: '#666', fontSize: '0.75rem' }}>—</span>
                          );
                        })()}
                      </td>
                      <td>
                        <button className="btn-gold btn-sm" onClick={() => router.push(`/dashboard/properties/${unit.id}`)} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>Otvori →</button>
                      </td>
                    </tr>
                  ))}
                  {units.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                        Nema stanova u ovom projektu. Klikni &quot;+ Dodaj Stan&quot; iznad.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Unit Modal */}
      {showUnitModal && (
        <div className="modal-overlay" onClick={() => setShowUnitModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🏠 Dodaj Stan u {project.name}</div>
              <button className="modal-close" onClick={() => setShowUnitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Naziv stana *</label>
                <input className="form-input" placeholder="npr. S01 (Jednosoban, 43m²)" value={unitForm.title} onChange={e => setUnitForm({...unitForm, title: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sprat</label>
                  <select className="form-select" value={unitForm.floor} onChange={e => setUnitForm({...unitForm, floor: e.target.value})}>
                    <option value="">—</option>
                    <option>Prizemlje</option>
                    <option>1. sprat</option>
                    <option>2. sprat</option>
                    <option>3. sprat</option>
                    <option>4. sprat</option>
                    <option>5. sprat</option>
                    <option>Potkrovlje</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Površina (m²)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="npr. 43.02" value={unitForm.area} onChange={e => setUnitForm({...unitForm, area: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Broj soba</label>
                  <select className="form-select" value={unitForm.rooms} onChange={e => setUnitForm({...unitForm, rooms: e.target.value})}>
                    <option value="">—</option>
                    <option value="1">1 (Garsonjera)</option>
                    <option value="1.5">1.5 (Jednoiposoban)</option>
                    <option value="2">2 (Dvosoban)</option>
                    <option value="2.5">2.5 (Dvoiposoban)</option>
                    <option value="3">3 (Trosoban)</option>
                    <option value="3.5">3.5 (Troiposoban)</option>
                    <option value="4">4 (Četvorosoban)</option>
                    <option value="5">5+</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Cena (€)</label>
                  <input className="form-input" type="number" placeholder="npr. 85000" value={unitForm.price} onChange={e => setUnitForm({...unitForm, price: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowUnitModal(false)}>Otkaži</button>
              <button className="btn-gold" onClick={createUnit} disabled={creatingUnit}>{creatingUnit ? '⏳ Kreiranje...' : '+ Kreiraj Stan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
