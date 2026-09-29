import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { env } from './env.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    })
  : null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Domain of the From address; Message-ID must match it (a mismatch with the sending domain is a spam signal). */
const FROM_DOMAIN = /@([^>\s]+)>?\s*$/.exec(env.SMTP_FROM)?.[1] ?? env.SMTP_HOST ?? 'localhost';

/** Plain-text alternative built from the HTML. HTML-only mail scores worse with spam filters. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|h2|tr|div|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>\s*<td[^>]*>/gi, ': ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export interface ApptEmailData {
  name: string; to: string; service: string; dateLabel: string; timeLabel: string;
  amountLabel: string; paymentLabel: string; status?: string;
  clinic: { name: string; phone: string; address: string; email: string };
}
export interface EmailTemplate { subject: string; html: string; replyTo?: string }

function layout(title: string, bodyHtml: string, clinicName: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0;background:#F7F8FA;font-family:Arial,Helvetica,sans-serif;color:#17202A">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:#071426;padding:20px 28px;border-bottom:3px solid #D9A72E">
<div style="color:#F4D477;font-size:20px;font-weight:bold;letter-spacing:1px">${esc(clinicName).toUpperCase()}</div></td></tr>
<tr><td style="padding:28px"><h2 style="margin:0 0 16px;color:#071426;font-size:20px">${esc(title)}</h2>${bodyHtml}</td></tr>
<tr><td style="background:#071426;color:#F4D477;padding:16px 28px;font-size:12px;letter-spacing:1px">MOVE BETTER • FEEL BETTER • LIVE BETTER</td></tr>
</table></td></tr></table></body></html>`;
}
const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#667;width:130px">${k}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`;
const details = (d: ApptEmailData, withStatus: boolean) => `<table cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px">
${row('Service', d.service)}${row('Date', d.dateLabel)}${row('Time', d.timeLabel)}${row('Amount', d.amountLabel)}${row('Payment', d.paymentLabel)}${withStatus && d.status ? row('Status', d.status) : ''}</table>`;
const clinicBlock = (d: ApptEmailData) => `<p style="font-size:13px;color:#556;margin-top:20px">${esc(d.clinic.name)}${d.clinic.address ? `<br>${esc(d.clinic.address)}` : ''}${d.clinic.phone ? `<br>Phone: ${esc(d.clinic.phone)}` : ''}</p>`;
/** Customer-facing reason only (HTML-escaped). Never pass internal admin notes here. */
const reasonBlock = (reason?: string) => reason
  ? `<p style="margin:16px 0;padding:12px 14px;background:#FFF8E6;border-left:3px solid #D9A72E;font-size:14px"><strong>Reason:</strong><br>${esc(reason).replace(/\r?\n/g, '<br>')}</p>`
  : '';
const replyTo = (d: ApptEmailData) => d.clinic.email || undefined;

export const templates = {
  requestReceived: (d: ApptEmailData): EmailTemplate => ({
    subject: 'Appointment Request Received – NS Physio Clinic', replyTo: replyTo(d),
    html: layout('Appointment Request Received', `<p>Hi ${esc(d.name)},</p><p>Your appointment request has been received successfully.</p>${details(d, true)}
<p>Your appointment is currently pending confirmation. We will notify you once your appointment is confirmed.</p>${clinicBlock(d)}`, d.clinic.name),
  }),
  confirmed: (d: ApptEmailData): EmailTemplate => ({
    subject: `Appointment Confirmed: ${d.dateLabel}, ${d.timeLabel} – NS Physio Clinic`, replyTo: replyTo(d),
    html: layout('Appointment Confirmed', `<p>Hi ${esc(d.name)},</p>
<p>Your ${esc(d.service)} appointment at ${esc(d.clinic.name)} is confirmed for ${esc(d.dateLabel)} at ${esc(d.timeLabel)}.</p>${details(d, false)}
<p>Please arrive a few minutes early. If you need to change or cancel your appointment, reply to this email${d.clinic.phone ? ` or call us on ${esc(d.clinic.phone)}` : ''}.</p>
<p>We look forward to seeing you.</p>${clinicBlock(d)}`, d.clinic.name),
  }),
  paymentRejected: (d: ApptEmailData, reason?: string): EmailTemplate => ({
    subject: 'Payment Verification Required – NS Physio Clinic', replyTo: replyTo(d),
    html: layout('Payment Verification Required', `<p>Hi ${esc(d.name)},</p><p>The submitted payment screenshot could not be verified.</p>${reasonBlock(reason)}
<p>Please login to your account and upload a valid payment screenshot for your ${esc(d.service)} appointment on ${esc(d.dateLabel)} at ${esc(d.timeLabel)}.</p>${clinicBlock(d)}`, d.clinic.name),
  }),
  cancelled: (d: ApptEmailData): EmailTemplate => ({
    subject: 'Appointment Cancelled – NS Physio Clinic', replyTo: replyTo(d),
    html: layout('Appointment Cancelled', `<p>Hi ${esc(d.name)},</p><p>Your appointment has been cancelled.</p>${details(d, false)}<p>You are welcome to book a new appointment at any time.</p>${clinicBlock(d)}`, d.clinic.name),
  }),
};

const ATTEMPTS = 3;
const ATTEMPT_DEADLINE_MS = 45_000; // hard cap per attempt on top of the transport timeouts
const TRANSIENT_CODES = new Set(['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 'EDNS', 'EAI_AGAIN']);

/** Retry only network-level failures and SMTP 4xx (temporary). Auth errors, 5xx rejections and bad addresses are permanent. */
function isTransient(e: unknown): boolean {
  const err = e as { code?: string; responseCode?: number };
  if (typeof err?.responseCode === 'number') return err.responseCode >= 400 && err.responseCode < 500;
  return !!err?.code && TRANSIENT_CODES.has(err.code);
}
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('SMTP operation timed out'), { code: 'ETIMEDOUT' })), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Fire-and-forget: bounded retries for transient failures only; failures are logged (no credentials) and never fail the request. */
export async function sendEmail(to: string, tpl: EmailTemplate): Promise<boolean> {
  if (!transporter) { console.warn('[email] SMTP not configured; skipped:', tpl.subject); return false; }
  if (/@example\.com>?\s*$/i.test(env.SMTP_FROM)) console.warn('[email] SMTP_FROM still uses example.com: set a real, domain-authenticated sender or mail will go to spam.');
  // Same Message-ID on every attempt so a retry after an ambiguous timeout can be de-duplicated by the receiving server.
  const messageId = `<${randomUUID()}@${FROM_DOMAIN}>`;
  const text = htmlToText(tpl.html);
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      await withDeadline(transporter.sendMail({
        from: env.SMTP_FROM, to, subject: tpl.subject, html: tpl.html, text, messageId,
        ...(tpl.replyTo ? { replyTo: tpl.replyTo } : {}),
      }), ATTEMPT_DEADLINE_MS);
      return true;
    } catch (e) {
      const err = e as { code?: string; responseCode?: number; message?: string };
      const transient = isTransient(e);
      console.error(`[email] attempt ${i}/${ATTEMPTS} failed (${transient ? 'transient' : 'permanent'}):`, tpl.subject, err.code ?? '', err.responseCode ?? '', err.message ?? '');
      if (!transient || i === ATTEMPTS) return false;
      await new Promise((r) => setTimeout(r, i * 2000 + Math.floor(Math.random() * 500)));
    }
  }
  return false;
}