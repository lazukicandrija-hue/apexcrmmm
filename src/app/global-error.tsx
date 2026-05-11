'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Auto-reload on deployment mismatch errors
  if (
    typeof window !== 'undefined' &&
    (error.message?.includes('Server Action') ||
     error.message?.includes('older or newer deployment') ||
     error.message?.includes('Failed to fetch'))
  ) {
    // Force full page reload to get fresh assets
    window.location.reload();
    return null;
  }

  return (
    <html>
      <body style={{ background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#D4AF37', marginBottom: 16 }}>Došlo je do greške</h2>
          <p style={{ color: '#999', marginBottom: 24 }}>Sistem se ažurira, molimo sačekajte.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Osveži stranicu
          </button>
        </div>
      </body>
    </html>
  );
}
