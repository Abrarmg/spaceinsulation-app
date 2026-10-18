/// <reference types="node" />
import { JOB_NOTICE_SELECT, sendJobNotice, serviceClient } from '../_lib/jobEmails';

// Runs daily (see vercel.json): emails a reminder to every customer with a job tomorrow (Toronto time).
export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false });
  }

  // Tomorrow's date in Toronto; jobs store plain dates as midnight UTC.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const dayAfter = new Date(new Date(`${tomorrow}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
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
  } catch (err: any) {
    console.error('[job-reminders]', err);
    return res.status(500).json({ success: false, message: err?.message });
  }
}
