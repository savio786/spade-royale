// Sends the few emails the game needs (password reset). Pick ONE service and set its key in the server's environment:
//  · Resend  (resend.com)  → RESEND_API_KEY      · Brevo (brevo.com) → BREVO_API_KEY
//  · MAIL_FROM = who the email is from, e.g.  Spade Haven <noreply@yourdomain.com>  (must be an address/domain verified with that service)
// Without a key nothing is sent. MAIL_DEBUG=1 prints the email in the server log instead (for testing on your own computer).
const FROM = () => (process.env.MAIL_FROM || '').trim();
const parseFrom = (s: string) => { const m = s.match(/^(.*?)\s*<([^>]+)>$/); return m ? { name: m[1].replace(/^["']|["']$/g, '').trim() || 'Spade Haven', email: m[2].trim() } : { name: 'Spade Haven', email: s.trim() }; };

export const mailConfigured = () => !!((process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) && FROM()) || process.env.MAIL_DEBUG === '1';

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  try {
    const resend = (process.env.RESEND_API_KEY || '').trim(), brevo = (process.env.BREVO_API_KEY || '').trim();
    if (resend && FROM()) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: FROM(), to: [to], subject, text, html }) });
      if (!r.ok) console.error('mail: Resend refused', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return r.ok;
    }
    if (brevo && FROM()) {
      const f = parseFrom(FROM());
      const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': brevo, 'content-type': 'application/json' }, body: JSON.stringify({ sender: f, to: [{ email: to }], subject, textContent: text, htmlContent: html }) });
      if (!r.ok) console.error('mail: Brevo refused', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return r.ok;
    }
    if (process.env.MAIL_DEBUG === '1') { console.log(`MAIL to ${to}: ${subject}\n${text}`); return true; }
  } catch (e) { console.error('mail failed', e); }
  return false;
}
