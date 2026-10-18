/// <reference types="node" />
import { JOB_NOTICE_SELECT, sendJobNotice, serviceClient } from './_lib/jobEmails';

// Office staff send an appointment confirmation or reminder to the job's customer.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { jobId, kind } = req.body || {};
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jobId || (kind !== 'confirmation' && kind !== 'reminder')) {
    return res.status(400).json({ success: false, message: 'jobId and kind (confirmation|reminder) are required.' });
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not signed in.' });

  try {
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

    const result = await sendJobNotice(supabase, job as any, kind);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('[job-notify]', err);
    return res.status(400).json({ success: false, message: err?.message || 'Failed to send.' });
  }
}
