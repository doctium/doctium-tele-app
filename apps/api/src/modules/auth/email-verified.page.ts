/**
 * Public HTML page shown when a patient clicks the verification link in
 * their email (success or invalid/expired). Brand: Calm Clinical Luxury.
 */
export function renderEmailVerifiedPage(ok: boolean): string {
  const icon = ok
    ? `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const title = ok ? "Email verified successfully" : "Link invalid or expired";
  const body = ok
    ? "Your email address is now verified. You can return to the Doctium app — you're all set."
    : "This verification link is no longer valid. Open the Doctium app and request a new verification email.";
  const badgeBg = ok
    ? "linear-gradient(135deg,#2E7CC2,#205F9E)"
    : "linear-gradient(135deg,#F0675C,#C9352A)";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Doctium</title>
  <style>
    body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#F4F7FB;min-height:100vh;display:grid;place-items:center;
      background-image:radial-gradient(700px 380px at 100% -10%,rgba(139,187,233,.18),transparent 60%),radial-gradient(600px 340px at -10% 110%,rgba(139,187,233,.14),transparent 55%)}
    .card{background:#fff;border:1px solid #E6ECF3;border-radius:26px;box-shadow:0 20px 50px rgba(11,27,48,.10);padding:44px 38px;max-width:420px;margin:24px;text-align:center}
    .badge{width:92px;height:92px;border-radius:50%;background:${badgeBg};display:grid;place-items:center;margin:0 auto 22px;box-shadow:0 12px 26px rgba(16,44,76,.28);animation:pop .55s cubic-bezier(.2,1.4,.4,1) both}
    h1{color:#133157;font-size:23px;margin:0 0 10px;letter-spacing:-.4px}
    p{color:#5A6B82;font-size:15px;line-height:1.6;margin:0}
    .brand{margin-top:26px;color:#93A1B5;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase}
    @keyframes pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <div class="brand">Doctium</div>
  </div>
</body>
</html>`;
}
