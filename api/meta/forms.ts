/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
  const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

  const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const anonKey = rawAnonKey ? rawAnonKey.replace(/[\n\r\s"']+/g, '') : null;

  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = rawServiceKey ? rawServiceKey.replace(/[\n\r\s"']+/g, '') : null;

  return { supabaseUrl, anonKey, serviceKey };
}

async function verifyAuth(req: any) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return {
      error: {
        status: 401,
        message: 'Authentication required. Please provide a valid session token via Authorization: Bearer header.',
      },
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      error: {
        status: 401,
        message: 'Authentication token is empty.',
      },
    };
  }

  const { supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!anonKey || !serviceKey) {
    return {
      error: {
        status: 500,
        message: 'Server configuration error.',
      },
    };
  }

  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      error: {
        status: 401,
        message: 'Invalid or expired authentication session.',
      },
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (
    profileError ||
    !callerProfile ||
    (callerProfile.role !== 'office_staff' && callerProfile.role !== 'admin')
  ) {
    return {
      error: {
        status: 403,
        message: 'Forbidden. You do not have permission to configure Lead Forms.',
      },
    };
  }

  return {
    userId: userData.user.id,
    profileId: callerProfile.id,
    supabaseAdmin,
  };
}

// --------------------------------------------------------------------------
// GET /api/meta/forms - Retrieve Forms
// --------------------------------------------------------------------------
async function handleGetForms(req: any, res: any) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { profileId, supabaseAdmin } = auth;

  // 1. Find that user's connected Meta integration
  const { data: integration, error: integError } = await supabaseAdmin
    .from('meta_integrations')
    .select('id, user_id, status')
    .eq('user_id', profileId)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integError || !integration) {
    return res.status(404).json({
      success: false,
      message: 'No connected Meta integration found for this user.',
    });
  }

  // 2. Find the Page where is_selected = true
  const { data: selectedPage, error: pageError } = await supabaseAdmin
    .from('meta_pages')
    .select('id, integration_id, facebook_page_id, page_name, page_access_token, is_selected')
    .eq('integration_id', integration.id)
    .eq('is_selected', true)
    .maybeSingle();

  if (pageError || !selectedPage || !selectedPage.page_access_token) {
    return res.status(404).json({
      success: false,
      message: 'No selected Facebook Page found. Please select a page first.',
    });
  }

  // 3. Call Meta Graph API to retrieve Lead Ads forms for that Page
  try {
    const formsUrl = new URL(`https://graph.facebook.com/v21.0/${selectedPage.facebook_page_id}/leadgen_forms`);
    formsUrl.searchParams.set('fields', 'id,name,status');

    const metaResponse = await fetch(formsUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${selectedPage.page_access_token}`,
        'Accept': 'application/json',
      },
    });

    const metaData: any = await metaResponse.json();

    if (!metaResponse.ok || !metaData || !Array.isArray(metaData.data)) {
      console.error('[meta-forms] Meta Graph API returned error:', {
        status: metaResponse.status,
        error: metaData?.error?.message,
      });

      const { data: existingForms } = await supabaseAdmin
        .from('meta_lead_forms')
        .select('facebook_form_id, form_name, form_status, is_selected')
        .eq('page_id', selectedPage.id);

      if (existingForms && existingForms.length > 0) {
        return res.status(200).json({
          success: true,
          forms: existingForms,
        });
      }

      return res.status(502).json({
        success: false,
        message: metaData?.error?.message || 'Failed to retrieve Lead Forms from Meta.',
        forms: [],
      });
    }

    const rawForms: any[] = metaData.data;

    // Fetch existing selection status to preserve user choice
    const { data: existingForms } = await supabaseAdmin
      .from('meta_lead_forms')
      .select('facebook_form_id, is_selected')
      .eq('page_id', selectedPage.id);

    const selectionMap = new Map<string, boolean>();
    if (existingForms) {
      for (const ef of existingForms) {
        selectionMap.set(ef.facebook_form_id, ef.is_selected ?? false);
      }
    }

    // 4. Upsert forms returned by Meta into meta_lead_forms
    if (rawForms.length > 0) {
      const upsertRows = rawForms.map((form: any) => {
        const formId = String(form.id);
        return {
          page_id: selectedPage.id,
          facebook_form_id: formId,
          form_name: String(form.name || 'Untitled Form'),
          form_status: String(form.status || 'ACTIVE'),
          is_selected: selectionMap.get(formId) ?? false,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: upsertErr } = await supabaseAdmin
        .from('meta_lead_forms')
        .upsert(upsertRows, { onConflict: 'facebook_form_id' });

      if (upsertErr) {
        console.error('[meta-forms] Failed to upsert meta_lead_forms:', upsertErr.message);
      }
    }

    // 5. Query and return only safe metadata (no tokens)
    const { data: dbForms } = await supabaseAdmin
      .from('meta_lead_forms')
      .select('facebook_form_id, form_name, form_status, is_selected')
      .eq('page_id', selectedPage.id);

    const safeForms = (dbForms && dbForms.length > 0)
      ? dbForms
      : rawForms.map((form: any) => {
          const formId = String(form.id);
          return {
            facebook_form_id: formId,
            form_name: String(form.name || 'Untitled Form'),
            form_status: String(form.status || 'ACTIVE'),
            is_selected: selectionMap.get(formId) ?? false,
          };
        });

    return res.status(200).json({
      success: true,
      forms: safeForms,
    });
  } catch (err: any) {
    console.error('[meta-forms] Unexpected error retrieving Lead Forms:', err?.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error while retrieving Lead Forms.',
      forms: [],
    });
  }
}

// --------------------------------------------------------------------------
// POST /api/meta/forms - Select Forms
// --------------------------------------------------------------------------
async function handleSelectForms(req: any, res: any) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { profileId, supabaseAdmin } = auth;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  const rawFormIds = body?.form_ids;
  if (!Array.isArray(rawFormIds)) {
    return res.status(400).json({
      success: false,
      message: 'form_ids must be an array of Facebook form IDs.',
    });
  }

  const formIds: string[] = rawFormIds.map(String).map((id) => id.trim()).filter(Boolean);

  // 1. Find user's connected Meta integration
  const { data: integration, error: integError } = await supabaseAdmin
    .from('meta_integrations')
    .select('id, user_id, status')
    .eq('user_id', profileId)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integError || !integration) {
    return res.status(404).json({
      success: false,
      message: 'No connected Meta integration found for this user.',
    });
  }

  // 2. Find Page where is_selected = true
  const { data: selectedPage, error: pageError } = await supabaseAdmin
    .from('meta_pages')
    .select('id, integration_id, facebook_page_id, page_name, is_selected')
    .eq('integration_id', integration.id)
    .eq('is_selected', true)
    .maybeSingle();

  if (pageError || !selectedPage) {
    return res.status(404).json({
      success: false,
      message: 'No selected Facebook Page found. Please select a page first.',
    });
  }

  // 3. Verify all selected forms belong to user's selected Facebook Page
  if (formIds.length > 0) {
    const { data: matchedForms, error: matchError } = await supabaseAdmin
      .from('meta_lead_forms')
      .select('id, facebook_form_id, form_name')
      .eq('page_id', selectedPage.id)
      .in('facebook_form_id', formIds);

    if (matchError || !matchedForms || matchedForms.length !== formIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected forms do not belong to the selected Facebook Page.',
      });
    }
  }

  // 4. Atomically update selections
  const now = new Date().toISOString();

  const { error: deselectErr } = await supabaseAdmin
    .from('meta_lead_forms')
    .update({ is_selected: false, updated_at: now })
    .eq('page_id', selectedPage.id);

  if (deselectErr) {
    console.error('[meta-forms-select] Failed to reset previous form selections:', deselectErr.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Lead Form selections.',
    });
  }

  if (formIds.length > 0) {
    const { error: selectErr } = await supabaseAdmin
      .from('meta_lead_forms')
      .update({ is_selected: true, updated_at: now })
      .eq('page_id', selectedPage.id)
      .in('facebook_form_id', formIds);

    if (selectErr) {
      console.error('[meta-forms-select] Failed to update form selections:', selectErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to update Lead Form selections.',
      });
    }
  }

  // 5. Query and return updated forms list and selected forms
  const { data: updatedForms } = await supabaseAdmin
    .from('meta_lead_forms')
    .select('facebook_form_id, form_name, form_status, is_selected')
    .eq('page_id', selectedPage.id);

  const safeForms = updatedForms || [];
  const selectedForms = safeForms.filter((f) => f.is_selected);

  return res.status(200).json({
    success: true,
    message: `Updated Lead Forms selection (${selectedForms.length} selected).`,
    forms: safeForms,
    selected_forms: selectedForms,
  });
}

// --------------------------------------------------------------------------
// MAIN ENTRYPOINT: /api/meta/forms
// --------------------------------------------------------------------------
export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return await handleGetForms(req, res);
  }

  if (req.method === 'POST') {
    return await handleSelectForms(req, res);
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
