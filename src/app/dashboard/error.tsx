'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-reload on deployment mismatch
    if (
      error.message?.includes('Server Action') ||
      error.message?.includes('older or newer deployment') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('chunk')
    ) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <h2 style={{ color: 'var(--gold)', marginBottom: 16 }}>Stranica nije mogla da se učita</h2>
      <p style={{ color: 'var(--gray-300)', marginBottom: 24 }}>Ovo se dešava kada se sistem ažurira.</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-gold"
        style={{ padding: '10px 24px' }}
      >
        🔄 Osveži stranicu
      </button>
    </div>
  );
}
