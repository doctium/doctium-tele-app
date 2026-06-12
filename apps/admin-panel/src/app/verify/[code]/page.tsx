import { CheckCircle2, XCircle, ShieldQuestion } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface VerifyData {
  valid: boolean;
  reason: 'ok' | 'tampered' | 'not_found';
  prescription?: {
    code: string;
    doctorName: string;
    doctorDesignation?: string | null;
    patientName: string;
    issuedAt: string;
    status: string;
    medicationCount: number;
  };
}

async function fetchVerify(code: string): Promise<VerifyData | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  try {
    const res = await fetch(`${base}/prescriptions/verify/${encodeURIComponent(code)}/json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as VerifyData) ?? null;
  } catch {
    return null;
  }
}

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await fetchVerify(code);

  const ok = result?.valid === true;
  const rx = result?.prescription;

  // State → presentation
  let Icon = ShieldQuestion;
  let badge = 'bg-gray-400 shadow-none';
  let title = 'Could not verify';
  let subtitle = 'We couldn’t reach the verification service. Please try again in a moment.';

  if (result) {
    if (ok) {
      Icon = CheckCircle2;
      badge = 'bg-teal-500 shadow-cta';
      title = 'Authentic prescription';
      subtitle = 'This prescription was issued by Doctium and its digital signature is valid.';
    } else if (result.reason === 'not_found') {
      Icon = XCircle;
      badge = 'bg-alert-500';
      title = 'Not found';
      subtitle = 'No prescription matches this code.';
    } else {
      Icon = XCircle;
      badge = 'bg-alert-500';
      title = 'Verification failed';
      subtitle = 'The contents do not match the original signature — this document may have been altered.';
    }
  }

  const issued = rx ? new Date(rx.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const rows: [string, string][] = rx
    ? [
        ['Prescribing doctor', `Dr. ${rx.doctorName}`],
        ...(rx.doctorDesignation ? ([['Specialty', rx.doctorDesignation]] as [string, string][]) : []),
        ['Patient', rx.patientName],
        ['Issued', issued],
        ['Medications', String(rx.medicationCount)],
        ['Status', rx.status],
      ]
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-hairline bg-surface shadow-floating animate-scale-in">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-hero px-7 py-9 text-center text-white">
          <div className="pointer-events-none absolute inset-0 hero-sheen" />
          <div className="pointer-events-none absolute -top-12 right-8 h-40 w-40 rounded-full bg-teal-bright/20 blur-3xl" />
          <div className={`relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-white ${badge}`}>
            <Icon size={34} strokeWidth={2.2} />
          </div>
          <h1 className="relative text-heading-md font-extrabold tracking-tight">{title}</h1>
          <p className="relative mx-auto mt-2 max-w-xs text-body-md text-skyblue-100/80">{subtitle}</p>
        </div>

        {/* Details */}
        {rows.length > 0 && (
          <div className="divide-y divide-hairline px-7">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3.5 text-body-md">
                <span className="text-gray-500">{label}</span>
                <span className="font-bold text-ink text-right">{value}</span>
              </div>
            ))}
            {rx && (
              <div className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-gray-500 text-body-md">Reference</span>
                <span className="font-mono text-caption text-gray-400">{rx.code}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="bg-surfaceAlt py-4 text-center text-caption text-gray-400">
          Verified by <span className="font-extrabold text-ink">Doctium</span> · Ed25519 digital signature
        </div>
      </div>
    </main>
  );
}
