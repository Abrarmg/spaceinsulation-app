/// <reference types="node" />
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
  const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = rawKey ? rawKey.replace(/[\n\r\s"']+/g, '') : null;

  return { supabaseUrl, serviceKey };
}

function getQueryParams(req: any): Record<string, string> {
  const query: Record<string, string> = {};
  if (req?.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') {
        query[k] = v;
      } else if (Array.isArray(v) && typeof v[0] === 'string') {
        query[k] = v[0];
      }
    }
  }
  if (req?.url && typeof req.url === 'string' && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      searchParams.forEach((val, key) => {
        if (!query[key]) {
          query[key] = val;
        }
      });
    } catch {
      // ignore
    }
  }
  return query;
}

async function getRawBody(req: any): Promise<string> {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;

  // Stream reading if bodyParser is false
  if (typeof req[Symbol.asyncIterator] === 'function') {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      if (chunks.length > 0) {
        return Buffer.concat(chunks).toString('utf8');
      }
    } catch {
      // stream might already be consumed
    }
  }

  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }

  return '';
}

function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2) return false;
  const algorithm = parts[0].toLowerCase().trim();
  const signatureHex = parts[1].toLowerCase().trim();

  if (algorithm !== 'sha256') return false;

  try {
    const calculatedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody, 'utf8')
      .digest('hex')
      .toLowerCase();

    const sigBuf = Buffer.from(signatureHex, 'hex');
    const calcBuf = Buffer.from(calculatedHash, 'hex');

    if (sigBuf.length !== calcBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, calcBuf);
  } catch {
    return false;
  }
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  return cleaned.includes('@') ? cleaned : null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  // If North American number has leading country code 1 and 11 digits, strip the 1
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length >= 10 ? digits.slice(-10) : (digits || null);
}

function parseLeadFieldData(fieldData: any[]): {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
} {
  let fullName: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let streetAddress: string | null = null;
  let city: string | null = null;
  let zipCode: string | null = null;

  if (Array.isArray(fieldData)) {
    for (const item of fieldData) {
      const fieldName = String(item?.name || '')
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');
      const rawVal = Array.isArray(item?.values) && item.values.length > 0 ? String(item.values[0] || '').trim() : '';
      if (!rawVal) continue;

      if (fieldName === 'full_name' || fieldName === 'name') {
        fullName = rawVal;
      } else if (fieldName === 'first_name') {
        firstName = rawVal;
      } else if (fieldName === 'last_name') {
        lastName = rawVal;
      } else if (fieldName === 'email') {
        email = rawVal;
      } else if (fieldName === 'phone_number' || fieldName === 'phone') {
        phone = rawVal;
      } else if (fieldName === 'street_address' || fieldName === 'address') {
        streetAddress = rawVal;
      } else if (fieldName === 'city') {
        city = rawVal;
      } else if (fieldName === 'zip_code' || fieldName === 'postal_code') {
        zipCode = rawVal;
      }
    }
  }

  const name = fullName || [firstName, lastName].filter(Boolean).join(' ') || null;
  const address = [streetAddress, city, zipCode].filter(Boolean).join(', ') || null;
  return { name, email, phone, address };
}

export default async function handler(req: any, res: any) {
  // 1. GET: Handle Meta Webhook Verification
  if (req.method === 'GET') {
    const query = getQueryParams(req);
    const mode = query['hub.mode'];
    const verifyToken = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.VITE_META_WEBHOOK_VERIFY_TOKEN ||
      ''
    ).trim();

    if (!expectedToken) {
      console.error('[meta-webhook] META_WEBHOOK_VERIFY_TOKEN is not configured on server.');
      return res.status(500).json({
        success: false,
        message: 'Webhook verify token not configured on server.',
      });
    }

    if (mode === 'subscribe' && verifyToken && verifyToken === expectedToken) {
      console.log('[meta-webhook] Webhook verified successfully by Meta.');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(challenge);
    }

    console.warn('[meta-webhook] Webhook verification failed. Invalid token or mode.');
    return res.status(403).json({
      success: false,
      message: 'Verification failed. Invalid verify token or mode.',
    });
  }

  // 2. POST: Process Meta Webhook Events
  if (req.method === 'POST') {
    const rawBody = await getRawBody(req);

    // Signature verification using X-Hub-Signature-256 and META_APP_SECRET
    const signatureHeader = req.headers?.['x-hub-signature-256'] || req.headers?.['X-Hub-Signature-256'];
    const appSecret = (
      process.env.META_APP_SECRET ||
      process.env.VITE_META_APP_SECRET ||
      ''
    ).trim();

    if (!appSecret) {
      console.error('[meta-webhook] META_APP_SECRET is not configured on server.');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: missing app secret.',
      });
    }

    if (!signatureHeader || typeof signatureHeader !== 'string') {
      console.warn('[meta-webhook] Missing X-Hub-Signature-256 header.');
      return res.status(403).json({
        success: false,
        message: 'Missing signature header.',
      });
    }

    const isSignatureValid = verifyMetaSignature(rawBody, signatureHeader, appSecret);
    if (!isSignatureValid) {
      console.warn('[meta-webhook] Invalid webhook signature rejected.');
      return res.status(403).json({
        success: false,
        message: 'Invalid webhook signature.',
      });
    }

    // Parse JSON payload
    let body: any = null;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr: any) {
      console.error('[meta-webhook] Failed to parse webhook JSON body:', parseErr?.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON payload.',
      });
    }

    // Safely log basic non-sensitive event metadata
    const objectType = body?.object || 'unknown';
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    const entryIds = entries.map((e: any) => e?.id).filter(Boolean);

    console.log('[meta-webhook] Received validated Meta webhook event:', {
      object: objectType,
      entry_count: entries.length,
      entry_ids: entryIds,
      timestamp: new Date().toISOString(),
    });

    // Process Page leadgen events
    if (objectType === 'page' && entries.length > 0) {
      const { supabaseUrl, serviceKey } = getSupabaseConfig();
      if (serviceKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        for (const entry of entries) {
          const pageIdFromEntry = entry?.id ? String(entry.id) : null;
          const changes = Array.isArray(entry?.changes) ? entry.changes : [];

          for (const change of changes) {
            if (change?.field !== 'leadgen') continue;

            const val = change?.value;
            const leadgenId = val?.leadgen_id ? String(val.leadgen_id) : null;
            const formId = val?.form_id ? String(val.form_id) : null;
            const pageId = val?.page_id ? String(val.page_id) : pageIdFromEntry;

            if (!leadgenId || !pageId || !formId) {
              console.warn('[meta-webhook] Skipping leadgen event: missing leadgen_id, page_id, or form_id.');
              continue;
            }

            try {
              // 1. Confirm Page belongs to our connected integration
              const { data: pageRecord, error: pageErr } = await supabaseAdmin
                .from('meta_pages')
                .select('id, integration_id, facebook_page_id, page_access_token')
                .eq('facebook_page_id', pageId)
                .maybeSingle();

              if (pageErr || !pageRecord || !pageRecord.page_access_token) {
                console.warn('[meta-webhook] Page not found or missing access token. Skipping page:', pageId);
                continue;
              }

              const { data: integration, error: integErr } = await supabaseAdmin
                .from('meta_integrations')
                .select('id, status')
                .eq('id', pageRecord.integration_id)
                .eq('status', 'connected')
                .maybeSingle();

              if (integErr || !integration) {
                console.warn('[meta-webhook] Page does not belong to active connected integration. Skipping page:', pageId);
                continue;
              }

              // 2. Confirm form exists in meta_lead_forms and is_selected = true
              const { data: formRecord, error: formErr } = await supabaseAdmin
                .from('meta_lead_forms')
                .select('id, facebook_form_id, is_selected')
                .eq('facebook_form_id', formId)
                .maybeSingle();

              if (formErr || !formRecord || !formRecord.is_selected) {
                console.log('[meta-webhook] Form is not selected for lead processing. Skipping leadgen_id:', leadgenId);
                continue;
              }

              // 3. Retrieve lead from Meta Graph API using saved Page Access Token
              const leadUrl = new URL(`https://graph.facebook.com/v21.0/${leadgenId}`);
              leadUrl.searchParams.set('fields', 'id,created_time,field_data,form_id');

              const leadResponse = await fetch(leadUrl.toString(), {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${pageRecord.page_access_token}`,
                  'Accept': 'application/json',
                },
              });

              const leadData: any = await leadResponse.json();

              if (!leadResponse.ok || !leadData || leadData.error) {
                console.error('[meta-webhook] Meta Graph API returned error fetching lead:', {
                  status: leadResponse.status,
                  error_code: leadData?.error?.code,
                  error_message: leadData?.error?.message,
                });
                continue;
              }

              // 4. Parse common Facebook fields safely
              const { name, email, phone, address } = parseLeadFieldData(leadData.field_data);

              // 5. Match or create canonical Contact record in public.customers
              let contactId: string | null = null;

              // Check if this lead was already processed in a previous retry
              const { data: existingLead } = await supabaseAdmin
                .from('leads')
                .select('id, customer_id, facebook_lead_id')
                .eq('facebook_lead_id', leadgenId)
                .maybeSingle();

              if (existingLead && existingLead.customer_id) {
                contactId = existingLead.customer_id;
                console.log('[meta-webhook] Lead retry detected; reusing existing linked contact:', {
                  leadgen_id: leadgenId,
                  contact_id: contactId,
                });
              } else {
                // Normalize incoming values for matching
                const normEmail = normalizeEmail(email);
                const normPhone = normalizePhone(phone);

                let phoneMatch: any = null;
                let emailMatch: any = null;

                // Search by normalized phone first (Priority 1)
                if (normPhone) {
                  const last4 = normPhone.slice(-4);
                  const { data: candidates } = await supabaseAdmin
                    .from('customers')
                    .select('id, full_name, email, phone, service_address, contact_type, source')
                    .ilike('phone', `%${last4}%`);

                  if (candidates && candidates.length > 0) {
                    phoneMatch = candidates.find((c: any) => normalizePhone(c.phone) === normPhone) || null;
                  }
                }

                // Search by normalized email second (Priority 2)
                if (normEmail) {
                  const { data: matchedByEmail } = await supabaseAdmin
                    .from('customers')
                    .select('id, full_name, email, phone, service_address, contact_type, source')
                    .ilike('email', normEmail)
                    .limit(1)
                    .maybeSingle();

                  if (matchedByEmail) {
                    emailMatch = matchedByEmail;
                  }
                }

                let matchedContact: any = null;
                if (phoneMatch && emailMatch) {
                  if (phoneMatch.id === emailMatch.id) {
                    matchedContact = phoneMatch;
                  } else {
                    // Conflict: phone and email matched distinct contact records
                    console.warn('[meta-webhook] Non-sensitive conflict: incoming phone and email matched distinct contacts. Prioritizing phone match.', {
                      phone_match_id: phoneMatch.id,
                      email_match_id: emailMatch.id,
                    });
                    matchedContact = phoneMatch;
                  }
                } else if (phoneMatch) {
                  matchedContact = phoneMatch;
                } else if (emailMatch) {
                  matchedContact = emailMatch;
                }

                if (matchedContact) {
                  contactId = matchedContact.id;
                  console.log('[meta-webhook] Matched existing contact record:', {
                    contact_id: contactId,
                    contact_type: matchedContact.contact_type,
                  });

                  // Backfill missing fields only (never overwrite existing non-empty values)
                  const backfillUpdates: Record<string, any> = {};
                  if (!matchedContact.full_name?.trim() && name?.trim()) {
                    backfillUpdates.full_name = name.trim();
                  }
                  if (!matchedContact.email?.trim() && email?.trim()) {
                    backfillUpdates.email = email.trim();
                  }
                  if (!matchedContact.phone?.trim() && phone?.trim()) {
                    backfillUpdates.phone = phone.trim();
                  }
                  if (!matchedContact.service_address?.trim() && address?.trim()) {
                    backfillUpdates.service_address = address.trim();
                  }

                  if (Object.keys(backfillUpdates).length > 0) {
                    backfillUpdates.updated_at = new Date().toISOString();
                    await supabaseAdmin
                      .from('customers')
                      .update(backfillUpdates)
                      .eq('id', contactId);
                  }
                } else {
                  // Create new Contact in public.customers
                  const { data: newContact, error: createContactErr } = await supabaseAdmin
                    .from('customers')
                    .insert([
                      {
                        full_name: (name && name.trim()) || 'Facebook Lead',
                        email: (email && email.trim()) || null,
                        phone: (phone && phone.trim()) || null,
                        service_address: (address && address.trim()) || null,
                        source: 'facebook',
                        contact_type: 'prospect',
                        created_from: 'meta_lead_ads',
                        is_archived: false,
                        updated_at: new Date().toISOString(),
                      },
                    ])
                    .select('id')
                    .single();

                  if (createContactErr || !newContact) {
                    console.error('[meta-webhook] Failed to create new contact for lead:', createContactErr?.message);
                  } else {
                    contactId = newContact.id;
                    console.log('[meta-webhook] Created new contact record:', {
                      contact_id: contactId,
                      source: 'facebook',
                      contact_type: 'prospect',
                    });
                  }
                }
              }

              // 6. Upsert using facebook_lead_id for idempotency / duplicate prevention
              const leadPayload: Record<string, any> = {
                facebook_lead_id: leadgenId,
                facebook_page_id: pageId,
                facebook_form_id: formId,
                customer_id: contactId,
                name: name,
                email: email,
                phone: phone,
                source: 'facebook',
                updated_at: new Date().toISOString(),
              };

              if (!existingLead) {
                leadPayload.status = 'new';
                leadPayload.pipeline_stage = 'new_request';
                leadPayload.received_at = new Date().toISOString();
              }

              const { error: upsertErr } = await supabaseAdmin
                .from('leads')
                .upsert(leadPayload, { onConflict: 'facebook_lead_id' });

              if (upsertErr) {
                console.error('[meta-webhook] Database upsert failed for lead:', upsertErr.message);
              } else {
                console.log('[meta-webhook] Successfully saved and linked lead:', {
                  lead_id: leadgenId,
                  customer_id: contactId,
                  page_id: pageId,
                  form_id: formId,
                });
              }
            } catch (eventProcessErr: any) {
              console.error('[meta-webhook] Unexpected error processing lead event:', eventProcessErr?.message);
            }
          }
        }
      } else {
        console.error('[meta-webhook] Database configuration missing for processing leadgen events.');
      }
    }

    // Return HTTP 200 quickly to Meta
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed',
  });
}
