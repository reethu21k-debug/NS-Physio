import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button, Spinner } from './ui';

const BASE = import.meta.env.VITE_API_URL ?? '';

/** Loads the payment screenshot through the admin-only API (Bearer token) and shows it, or the exact reason it failed. */
export function ProofImage({ appointmentId }: { appointmentId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let dead = false;
    let objectUrl: string | null = null;
    (async () => {
      setLoading(true); setErr(null); setSrc(null);
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetch(`${BASE}/api/admin/appointments/${appointmentId}/proof`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(j?.message ?? `Could not load the screenshot (HTTP ${res.status}).`);
        }
        objectUrl = URL.createObjectURL(await res.blob());
        if (dead) URL.revokeObjectURL(objectUrl); else setSrc(objectUrl);
      } catch (e) { if (!dead) setErr(e instanceof Error ? e.message : 'Could not load the screenshot.'); }
      finally { if (!dead) setLoading(false); }
    })();
    return () => { dead = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [appointmentId, tries]);

  if (loading) return <Spinner />;
  if (err || !src) return (
    <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
      <p>{err ?? 'Screenshot unavailable.'}</p>
      <Button variant="outline" className="mt-3" onClick={() => setTries((n) => n + 1)}>Retry</Button>
    </div>
  );
  return (
    <div>
      <a href={src} target="_blank" rel="noopener noreferrer" aria-label="Open full-size payment screenshot"><img src={src} alt="Customer payment screenshot" className="max-h-[520px] w-full rounded-lg border bg-gray-50 object-contain" /></a>
      <a href={src} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-navy underline">Open full size</a>
    </div>
  );
}