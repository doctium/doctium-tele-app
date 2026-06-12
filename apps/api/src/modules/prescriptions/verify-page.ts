interface VerifyResult {
  valid: boolean;
  reason: 'ok' | 'tampered' | 'not_found';
  prescription?: {
    code: string;
    doctorName: string;
    doctorDesignation?: string | null;
    patientName: string;
    issuedAt: Date | string;
    status: string;
    medicationCount: number;
  };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Branded public verification page rendered when a prescription QR is scanned. */
export function renderVerifyPage(result: VerifyResult): string {
  const ok = result.valid;
  const rx = result.prescription;
  const accent = ok ? '#2CB7A7' : '#D92D20';
  const icon = ok ? '&#10003;' : '&#10007;';
  const title = ok ? 'Authentic prescription' : result.reason === 'not_found' ? 'Not found' : 'Verification failed';
  const subtitle = ok
    ? 'This prescription was issued by Doctium and its digital signature is valid.'
    : result.reason === 'not_found'
      ? 'No prescription matches this code.'
      : 'The contents do not match the original signature — this document may have been altered.';

  const issued = rx ? new Date(rx.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const detailRows = rx
    ? `
      <div class="row"><span>Prescribing doctor</span><b>Dr. ${esc(rx.doctorName)}</b></div>
      ${rx.doctorDesignation ? `<div class="row"><span>Specialty</span><b>${esc(rx.doctorDesignation)}</b></div>` : ''}
      <div class="row"><span>Patient</span><b>${esc(rx.patientName)}</b></div>
      <div class="row"><span>Issued</span><b>${esc(issued)}</b></div>
      <div class="row"><span>Medications</span><b>${esc(rx.medicationCount)}</b></div>
      <div class="row"><span>Status</span><b>${esc(rx.status)}</b></div>
      <div class="row"><span>Reference</span><b class="mono">${esc(rx.code)}</b></div>`
    : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Doctium · Prescription verification</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: radial-gradient(1200px 600px at 100% -10%, rgba(44,183,167,.10), transparent 60%),
                     radial-gradient(900px 500px at -10% 0%, rgba(139,187,233,.16), transparent 55%), #F4F7FB;
         min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; color: #1F2D3D; }
  .card { width: 100%; max-width: 420px; background: #fff; border-radius: 26px;
          box-shadow: 0 30px 60px -24px rgba(19,49,87,.24); overflow: hidden; border: 1px solid #EEF2F7; }
  .head { background: linear-gradient(135deg,#0B1B30,#143A63 55%,#13705F); padding: 30px 26px; color: #fff; text-align: center; }
  .badge { width: 64px; height: 64px; border-radius: 50%; background: ${accent}; display: inline-flex;
           align-items: center; justify-content: center; font-size: 32px; color: #fff; margin-bottom: 14px;
           box-shadow: 0 8px 20px -6px ${accent}; }
  .head h1 { font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
  .head p { margin-top: 8px; font-size: 13px; color: #ABC4DE; line-height: 1.5; }
  .body { padding: 8px 26px 26px; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid #EEF2F7; font-size: 14px; }
  .row:last-child { border-bottom: 0; }
  .row span { color: #6B7B90; }
  .row b { font-weight: 700; text-align: right; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #6B7B90; }
  .foot { text-align: center; padding: 18px; font-size: 11px; color: #9AA8B8; background: #F7FAFC; }
  .brand { font-weight: 800; color: #133157; }
</style></head>
<body>
  <div class="card">
    <div class="head">
      <div class="badge">${icon}</div>
      <h1>${esc(title)}</h1>
      <p>${esc(subtitle)}</p>
    </div>
    ${detailRows ? `<div class="body">${detailRows}</div>` : ''}
    <div class="foot">Verified by <span class="brand">Doctium</span> · Ed25519 digital signature</div>
  </div>
</body></html>`;
}
