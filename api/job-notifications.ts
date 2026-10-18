/// <reference types="node" />
// Customer appointment emails. One function (Vercel Hobby allows 12) serving two callers:
//   POST  — office staff send a confirmation/reminder for one job (signed-in user token).
//   GET   — the daily Vercel cron (see vercel.json) emails reminders for tomorrow's jobs.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type NoticeKind = 'confirmation' | 'reminder';

const clean = (v: string | undefined) => (v || '').replace(/[\n\r\s"']+/g, '');

function serviceClient(): SupabaseClient {
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

interface JobForNotice {
  id: string;
  job_number: number;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  customers: { full_name?: string; email?: string | null; service_address?: string | null } | null;
}

const JOB_NOTICE_SELECT =
  'id, job_number, scheduled_date, start_time, end_time, customers (full_name, email, service_address)';

/** Sends the confirmation or reminder email and records when it was sent. */
async function sendJobNotice(supabase: SupabaseClient, job: JobForNotice, kind: NoticeKind) {
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

async function handleNotify(req: any, res: any) {
  const { jobId, kind } = req.body || {};
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jobId || (kind !== 'confirmation' && kind !== 'reminder')) {
    return res.status(400).json({ success: false, message: 'jobId and kind (confirmation|reminder) are required.' });
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not signed in.' });

  const supabase = serviceClient();
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  const { data: profile } = userId
    ? await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    : { data: null };
  if (profile?.role !== 'office_staff') {
    return res.status(403).json({ success: false, message: 'Only office staff can notify customers.' });
  }

  const { data: job, error } = await supabase.from('jobs').select(JOB_NOTICE_SELECT).eq('id', jobId).maybeSingle();
  if (error || !job) return res.status(404).json({ success: false, message: 'Job not found.' });

  const result = await sendJobNotice(supabase, job as any, kind as NoticeKind);
  return res.status(200).json({ success: true, ...result });
}

async function handleCron(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false });
  }

  // Tomorrow's date in Toronto; jobs store plain dates as midnight UTC.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const dayAfter = new Date(new Date(`${tomorrow}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const supabase = serviceClient();
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(JOB_NOTICE_SELECT)
    .gte('scheduled_date', `${tomorrow}T00:00:00Z`)
    .lt('scheduled_date', `${dayAfter}T00:00:00Z`)
    .eq('status', 'Scheduled')
    .is('reminder_sent_at', null);
  if (error) throw error;

  const results = [];
  for (const job of jobs || []) {
    try {
      const r = await sendJobNotice(supabase, job as any, 'reminder');
      results.push({ job: job.job_number, sent: r.to });
    } catch (err: any) {
      results.push({ job: job.job_number, skipped: err?.message });
    }
  }
  console.log('[job-reminders]', tomorrow, JSON.stringify(results));
  return res.status(200).json({ success: true, date: tomorrow, results });
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') return await handleNotify(req, res);
    if (req.method === 'GET') return await handleCron(req, res);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[job-notifications]', err);
    return res.status(400).json({ success: false, message: err?.message || 'Failed to send.' });
  }
}
