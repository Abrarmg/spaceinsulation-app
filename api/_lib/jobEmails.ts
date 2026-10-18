/// <reference types="node" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type NoticeKind = 'confirmation' | 'reminder';

const clean = (v: string | undefined) => (v || '').replace(/[\n\r\s"']+/g, '');

export function serviceClient(): SupabaseClient {
  const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error('Server configuration missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  return createClient(url, key, { auth: { persistSession: false } });
}

const COMPANY = {
  name: 'Space Insulation Inc.',
  phone: '647-704-9021',
  email: 'space@spaceinsulations.com',
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

const formatTime = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export interface JobForNotice {
  id: string;
  job_number: number;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customers: { full_name?: string; email?: string | null; service_address?: string | null } | null;
}

export const JOB_NOTICE_SELECT =
  'id, job_number, scheduled_date, start_time, end_time, customers (full_name, email, service_address)';

/** Sends the confirmation or reminder email and records when it was sent. */
export async function sendJobNotice(supabase: SupabaseClient, job: JobForNotice, kind: NoticeKind) {
  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const to = customer?.email?.trim();
  if (!to) throw new Error('This customer has no email address.');
  if (!job.scheduled_date) throw new Error('This job has no scheduled date.');

  const resendKey = clean(process.env.RESEND_API_KEY);
  if (!resendKey) throw new Error('Server configuration missing (RESEND_API_KEY).');
  const sender = process.env.RESEND_SENDER_EMAIL || 'invoices@app.spaceinsulation.ca';

  const firstName = (customer?.full_name || '').split(' ')[0] || 'there';
  const date = formatDate(job.scheduled_date.slice(0, 10));
  const start = formatTime(job.start_time);
  const end = formatTime(job.end_time);
  const when = start ? `${date}, ${end ? `between ${start} and ${end}` : `starting at ${start}`}` : `${date} (we'll call to confirm the arrival time)`;
  const address = customer?.service_address || 'your home';

  const subject =
    kind === 'confirmation'
      ? `Your insulation appointment is confirmed – ${date}`
      : `Reminder: your insulation appointment is tomorrow`;
  const intro =
    kind === 'confirmation'
      ? 'Your appointment with Space Insulation is confirmed.'
      : 'This is a friendly reminder that our crew is scheduled to visit tomorrow.';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#151A2D;max-width:560px;margin:0 auto;padding:24px">
    <div style="border-bottom:3px solid #76C442;padding-bottom:12px;margin-bottom:20px">
      <strong style="font-size:18px;letter-spacing:1px">SPACE <span style="color:#76C442">INSULATION</span></strong>
    </div>
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>${intro}</p>
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="color:#64748B;padding:4px 16px 4px 0">When</td><td><strong>${escapeHtml(when)}</strong></td></tr>
      <tr><td style="color:#64748B;padding:4px 16px 4px 0">Where</td><td><strong>${escapeHtml(address)}</strong></td></tr>
      <tr><td style="color:#64748B;padding:4px 16px 4px 0">Job #</td><td>${job.job_number}</td></tr>
    </table>
    <p style="margin-bottom:6px"><strong>Before we arrive:</strong></p>
    <ul style="margin-top:0;color:#334155;font-size:14px">
      <li>Please clear a path to the attic access (closet or hallway hatch).</li>
      <li>Make sure we can park close to the house for our equipment.</li>
      <li>Secure pets away from the work area.</li>
    </ul>
    <p>Need to reschedule? Call us at <strong>${COMPANY.phone}</strong> or reply to this email.</p>
    <p style="color:#64748B;font-size:12px;margin-top:28px">${COMPANY.name} · ${COMPANY.phone} · ${COMPANY.email}</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Space Insulation <${sender}>`, to: [to], reply_to: COMPANY.email, subject, html }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);

  const column = kind === 'confirmation' ? 'confirmation_sent_at' : 'reminder_sent_at';
  const sentAt = new Date().toISOString();
  const { error } = await supabase.from('jobs').update({ [column]: sentAt }).eq('id', job.id);
  if (error) console.error(`[job-notice] sent but failed to record ${column}:`, error);
  return { to, sentAt };
}
