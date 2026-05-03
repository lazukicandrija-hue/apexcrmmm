'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Greška pri prijavi');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Greška na serveru');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">APEX</div>
        <div className="login-subtitle">Real Estate CRM</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Korisničko Ime</label>
            <input id="username" type="text" className="form-input" placeholder="admin"
              value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="password">Lozinka</label>
            <input id="password" type="password" className="form-input" placeholder="••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-gold full-width" disabled={loading}>
            {loading ? 'Prijavljivanje...' : 'Prijavite Se'}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: '0.75rem', color: '#666' }}>
          Demo: admin / apex2026
        </p>
      </div>
    </div>
  );
}
