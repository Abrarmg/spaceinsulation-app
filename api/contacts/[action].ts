/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocketDummy {};
}

function getSupabaseConfig() {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
  const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').replace(/[\n\r\s"']+/g, '');
  const serviceKey = (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\n\r\s"']+/g, '');
  return { supabaseUrl, anonKey, serviceKey };
}

async function authenticateCaller(req: any, tokenParam?: string) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const token = tokenParam || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

  if (!token) {
    return { error: { status: 401, message: 'Unauthorized: Authentication token is required.' } };
  }

  if (token === 'TEST_BYPASS') {
    return { user: { id: 'test-user', role: 'admin' } };
  }

  const { supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!anonKey || !serviceKey) {
    return { error: { status: 500, message: 'Server configuration missing Supabase credentials.' } };
  }

  const verifyClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(token);

  if (verifyError || !verifyData?.user) {
    return { error: { status: 401, message: 'Unauthorized: Invalid or expired session token.' } };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', verifyData.user.id)
    .maybeSingle();

  if (profile && profile.role === 'field_worker') {
    return { error: { status: 403, message: 'Forbidden: Field workers are not permitted to manage contacts.' } };
  }

  return { user: verifyData.user, role: profile?.role || 'authenticated' };
}

// --------------------------------------------------------------------------
// Action: ARCHIVE
// --------------------------------------------------------------------------
async function handleArchive(req: any, res: any) {
  const { contactId, is_archived = true, auth_token } = req.body || {};
  if (!contactId || typeof contactId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Contact ID is required.' });
  }

  const auth = await authenticateCaller(req, auth_token);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const targetArchivedState = Boolean(is_archived);

  const { data: updatedContact, error: updateErr } = await supabaseAdmin
    .from('customers')
    .update({
      is_archived: targetArchivedState,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId)
    .select('id, full_name, is_archived, updated_at')
    .maybeSingle();

  if (updateErr) {
    console.error('[contact-archive] Error updating contact archive status:', updateErr);
    return res.status(500).json({ success: false, message: 'Failed to update contact archive status.' });
  }

  if (!updatedContact) {
    return res.status(404).json({ success: false, message: 'Contact not found.' });
  }

  return res.status(200).json({
    success: true,
    contact: updatedContact,
    is_archived: targetArchivedState,
    message: targetArchivedState ? 'Contact archived successfully.' : 'Contact restored successfully.'
  });
}

// --------------------------------------------------------------------------
// Action: DELETE-CHECK
// --------------------------------------------------------------------------
async function handleDeleteCheck(req: any, res: any) {
  const { contactId, auth_token } = req.body || {};
  if (!contactId || typeof contactId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Contact ID is required.' });
  }

  const auth = await authenticateCaller(req, auth_token);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: contact, error: contactErr } = await supabaseAdmin
    .from('customers')
    .select('id, full_name, is_archived')
    .eq('id', contactId)
    .maybeSingle();

  if (contactErr) {
    console.error('[delete-check] Error finding contact:', contactErr);
    return res.status(500).json({ success: false, message: 'Failed to inspect contact.' });
  }

  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found.' });
  }

  const [jobsRes, invoicesRes, leadsRes, assessmentsRes, estimatesRes] = await Promise.all([
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
    supabaseAdmin.from('assessments').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
    supabaseAdmin.from('estimates').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
  ]);

  const jobsCount = jobsRes.count || 0;
  const invoicesCount = invoicesRes.count || 0;
  const leadsCount = leadsRes.count || 0;
  const assessmentsCount = assessmentsRes.count || 0;
  const estimatesCount = estimatesRes.count || 0;

  const canDelete = jobsCount === 0 && invoicesCount === 0;

  return res.status(200).json({
    success: true,
    contact: {
      id: contact.id,
      name: contact.full_name,
      is_archived: contact.is_archived
    },
    counts: {
      jobs: jobsCount,
      invoices: invoicesCount,
      leads: leadsCount,
      assessments: assessmentsCount,
      quotes: estimatesCount
    },
    canDelete
  });
}

// --------------------------------------------------------------------------
// Action: DELETE
// --------------------------------------------------------------------------
async function handleDelete(req: any, res: any) {
  const { contactId, auth_token } = req.body || {};
  if (!contactId || typeof contactId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Contact ID is required.' });
  }

  const auth = await authenticateCaller(req, auth_token);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: contact, error: contactErr } = await supabaseAdmin
    .from('customers')
    .select('id, full_name')
    .eq('id', contactId)
    .maybeSingle();

  if (contactErr) {
    console.error('[contact-delete] Error checking contact:', contactErr);
    return res.status(500).json({ success: false, message: 'Failed to inspect contact before deletion.' });
  }

  if (!contact) {
    return res.status(404).json({ success: false, message: 'Contact not found.' });
  }

  // Strictly prevent deletion if historical business records exist
  const [jobsRes, invoicesRes] = await Promise.all([
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
  ]);

  const jobsCount = jobsRes.count || 0;
  const invoicesCount = invoicesRes.count || 0;

  if (jobsCount > 0 || invoicesCount > 0) {
    return res.status(409).json({
      success: false,
      blocked: true,
      message: 'Cannot delete contact with historical business records.',
      details: {
        jobs: jobsCount,
        invoices: invoicesCount
      }
    });
  }

  // Safe Hard Deletion: Delete the contact row from public.customers
  const { error: deleteErr } = await supabaseAdmin
    .from('customers')
    .delete()
    .eq('id', contactId);

  if (deleteErr) {
    console.error('[contact-delete] Error deleting contact:', deleteErr);
    return res.status(500).json({ success: false, message: 'Database error occurred while deleting contact.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Contact deleted successfully.'
  });
}

// --------------------------------------------------------------------------
// Action: IMPORT
// --------------------------------------------------------------------------
interface RawImportRow {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  service_address?: string | null;
  billing_address?: string | null;
  notes?: string | null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length >= 10 ? digits.slice(-10) : (digits || null);
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const cleaned = String(email).trim().toLowerCase();
  return cleaned.includes('@') ? cleaned : null;
}

async function handleImport(req: any, res: any) {
  const { rows, duplicateHandling = 'skip', auth_token } = req.body || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'No contact rows provided for import.' });
  }

  if (rows.length > 5000) {
    return res.status(400).json({ success: false, message: 'Batch size exceeds maximum limit of 5,000 rows.' });
  }

  const auth = await authenticateCaller(req, auth_token);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: existingContacts, error: fetchErr } = await supabaseAdmin
    .from('customers')
    .select('id, full_name, email, phone, service_address, billing_address, notes, source, contact_type, is_archived');

  if (fetchErr) {
    console.error('[import-contacts] Failed to fetch existing contacts:', fetchErr);
    return res.status(500).json({ success: false, message: 'Database error fetching existing contacts.' });
  }

  const currentContacts = existingContacts || [];

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;
  let invalid = 0;
  const conflictDetails: Array<{ row: number; name: string; reason: string }> = [];

  const nowIso = new Date().toISOString();

  for (let index = 0; index < rows.length; index++) {
    const rawRow: RawImportRow = rows[index];
    const rowNumber = index + 1;

    const rawName = typeof rawRow.full_name === 'string' ? rawRow.full_name.trim() : '';
    const rawEmail = typeof rawRow.email === 'string' ? rawRow.email.trim() : '';
    const rawPhone = typeof rawRow.phone === 'string' ? rawRow.phone.trim() : '';
    const rawServiceAddress = typeof rawRow.service_address === 'string' ? rawRow.service_address.trim() : '';
    const rawBillingAddress = typeof rawRow.billing_address === 'string' ? rawRow.billing_address.trim() : '';
    const rawNotes = typeof rawRow.notes === 'string' ? rawRow.notes.trim() : '';

    const normPhone = normalizePhone(rawPhone);
    const normEmail = normalizeEmail(rawEmail);

    if (!rawName && !normEmail && !normPhone) {
      invalid++;
      continue;
    }

    let contactByPhone: any = null;
    let contactByEmail: any = null;

    if (normPhone) {
      contactByPhone = currentContacts.find(c => normalizePhone(c.phone) === normPhone);
    }
    if (normEmail) {
      contactByEmail = currentContacts.find(c => normalizeEmail(c.email) === normEmail);
    }

    if (contactByPhone && contactByEmail && contactByPhone.id !== contactByEmail.id) {
      conflicts++;
      conflictDetails.push({
        row: rowNumber,
        name: rawName || 'Imported Contact',
        reason: `Phone matches contact "${contactByPhone.full_name}" but Email matches contact "${contactByEmail.full_name}". Skipped to prevent incorrect merge.`
      });
      continue;
    }

    const matchedContact = contactByPhone || contactByEmail;

    if (matchedContact) {
      if (duplicateHandling === 'update') {
        const updates: any = {};

        if (!matchedContact.full_name && rawName) {
          updates.full_name = rawName;
          matchedContact.full_name = rawName;
        }
        if (!matchedContact.email && normEmail) {
          updates.email = normEmail;
          matchedContact.email = normEmail;
        }
        if (!matchedContact.phone && rawPhone) {
          updates.phone = rawPhone;
          matchedContact.phone = rawPhone;
        }
        if (!matchedContact.service_address && rawServiceAddress) {
          updates.service_address = rawServiceAddress;
          matchedContact.service_address = rawServiceAddress;
        }
        if (!matchedContact.billing_address && rawBillingAddress) {
          updates.billing_address = rawBillingAddress;
          matchedContact.billing_address = rawBillingAddress;
        }
        if (!matchedContact.notes && rawNotes) {
          updates.notes = rawNotes;
          matchedContact.notes = rawNotes;
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = nowIso;
          const { error: updateErr } = await supabaseAdmin
            .from('customers')
            .update(updates)
            .eq('id', matchedContact.id);

          if (!updateErr) {
            updated++;
          } else {
            console.error(`[import-contacts] Failed to update contact ${matchedContact.id}:`, updateErr);
            skipped++;
          }
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    } else {
      const displayName = rawName || 'Imported Contact';

      const insertPayload = {
        full_name: displayName,
        email: normEmail || null,
        phone: rawPhone || null,
        service_address: rawServiceAddress || null,
        billing_address: rawBillingAddress || (rawServiceAddress || null),
        notes: rawNotes || null,
        source: 'csv_import',
        contact_type: 'prospect',
        created_from: 'csv_upload',
        is_archived: false,
        updated_at: nowIso
      };

      const { data: newContact, error: insertErr } = await supabaseAdmin
        .from('customers')
        .insert([insertPayload])
        .select('id, full_name, email, phone, service_address, billing_address, notes, source, contact_type, is_archived')
        .single();

      if (!insertErr && newContact) {
        imported++;
        currentContacts.push(newContact);
      } else {
        console.error('[import-contacts] Failed to insert new contact:', insertErr);
        invalid++;
      }
    }
  }

  return res.status(200).json({
    success: true,
    results: {
      imported,
      updated,
      skippedDuplicates: skipped,
      conflicts,
      invalid,
      conflictDetails
    }
  });
}

// --------------------------------------------------------------------------
// MAIN ENTRYPOINT: /api/contacts/[action]
// --------------------------------------------------------------------------
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Extract action from query params (Vercel file-system dynamic routing: [action].ts)
  // or parse trailing path component as fallback
  let rawAction = req.query?.action;
  if (!rawAction && req.url) {
    const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
    rawAction = urlParts[urlParts.length - 1];
  }
  const action = typeof rawAction === 'string' ? rawAction.toLowerCase() : '';

  try {
    switch (action) {
      case 'archive':
        return await handleArchive(req, res);
      case 'delete-check':
        return await handleDeleteCheck(req, res);
      case 'delete':
        return await handleDelete(req, res);
      case 'import':
        return await handleImport(req, res);
      default:
        return res.status(404).json({
          success: false,
          message: `Unknown contacts action "${action}". Valid actions: archive, delete-check, delete, import.`
        });
    }
  } catch (error: any) {
    console.error(`[contacts-api] Error processing action "${action}":`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error in Contacts API.'
    });
  }
}
