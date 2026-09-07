import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FacebookPage {
  facebook_page_id: string;
  page_name: string;
  picture?: string | null;
  is_selected?: boolean;
}

interface FacebookLeadForm {
  facebook_form_id: string;
  form_name: string;
  form_status: string;
}

export const FacebookLeadAdsCard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [status, setStatus] = useState<'connected' | 'not_connected'>('not_connected');
  const [connectedUser, setConnectedUser] = useState<string | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectingPageId, setSelectingPageId] = useState<string | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [forms, setForms] = useState<FacebookLeadForm[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPages = async () => {
    try {
      setLoadingPages(true);
      setPagesError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/meta/pages', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.pages && Array.isArray(data.pages)) {
          setPages(data.pages);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setPagesError(errData?.message || 'Failed to retrieve Facebook Pages.');
      }
    } catch (err: any) {
      setPagesError(err?.message || 'Failed to load Facebook Pages.');
    } finally {
      setLoadingPages(false);
    }
  };

  const fetchForms = async () => {
    try {
      setLoadingForms(true);
      setFormsError(null);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) return;

      const response = await fetch('/api/meta/forms', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.forms) {
        setForms(data.forms);
      } else {
        setFormsError(data?.message || 'Failed to retrieve Lead Forms.');
      }
    } catch (err: any) {
      setFormsError(err?.message || 'Error loading Lead Forms.');
    } finally {
      setLoadingForms(false);
    }
  };

  const handleSelectPage = async (pageId: string) => {
    try {
      setSelectingPageId(pageId);
      setPagesError(null);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        setPagesError('Your session has expired. Please log in again.');
        return;
      }

      const response = await fetch('/api/meta/pages/select', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ facebook_page_id: pageId }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setPagesError('Your session has expired or you are unauthorized. Please log in again.');
        return;
      }

      if (!response.ok) {
        setPagesError(data.message || 'Failed to select Facebook Page.');
        return;
      }

      // Update UI immediately to show Selected ✓
      setPages(prevPages =>
        prevPages.map(p => ({
          ...p,
          is_selected: p.facebook_page_id === pageId,
        }))
      );

      // Fetch lead forms for the newly selected page
      fetchForms();
    } catch (err: any) {
      console.error('[FacebookLeadAdsCard] Select page error:', err);
      setPagesError(err.message || 'Failed to select Facebook Page.');
    } finally {
      setSelectingPageId(null);
    }
  };

  // Check existing connection status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setCheckingStatus(true);
        const { data, error: fetchErr } = await supabase
          .from('meta_integrations')
          .select('status, facebook_user_name')
          .eq('status', 'connected')
          .maybeSingle();

        if (!fetchErr && data) {
          setStatus('connected');
          setConnectedUser(data.facebook_user_name || null);
        } else {
          setStatus('not_connected');
        }
      } catch {
        setStatus('not_connected');
      } finally {
        setCheckingStatus(false);
      }
    };

    fetchStatus();
  }, []);

  // Fetch pages whenever status changes to connected
  useEffect(() => {
    if (status === 'connected') {
      fetchPages();
    } else {
      setPages([]);
    }
  }, [status]);

  // Fetch forms whenever the selected page is available
  const selectedPage = pages.find(p => p.is_selected);
  useEffect(() => {
    if (status === 'connected' && selectedPage) {
      fetchForms();
    } else {
      setForms([]);
    }
  }, [status, selectedPage]);

  // Check URL query parameters for OAuth callback result
  useEffect(() => {
    const metaAuth = searchParams.get('meta_auth');
    if (metaAuth === 'success') {
      setSuccessMessage('Facebook Lead Ads connected successfully!');
      setStatus('connected');
      // Clean query parameter from URL without reload
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('meta_auth');
      setSearchParams(newParams, { replace: true });
    } else if (metaAuth === 'error') {
      const errorDetail = searchParams.get('error') || 'Unknown error occurred';
      setError(`Failed to connect Facebook Lead Ads: ${errorDetail}`);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('meta_auth');
      newParams.delete('error');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleConnectFacebook = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // 1. Get current Supabase session access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      // 2. Call GET /api/meta/connect with token strictly in Authorization: Bearer <token>
      const response = await fetch('/api/meta/connect?return_to=/settings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });

      // 3. Handle 401 session expired
      if (response.status === 401) {
        setError('Your session has expired or you are unauthorized. Please log in again.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to initiate Facebook connection. Please try again.');
        return;
      }

      // 4. Extract returned Facebook OAuth URL
      const data = await response.json();
      if (!data?.url) {
        setError('Server did not return a valid OAuth redirect URL.');
        return;
      }

      // 5. Navigate to returned OAuth URL
      window.location.href = data.url;
    } catch (err: any) {
      console.error('[FacebookLeadAdsCard] OAuth start error:', err);
      setError(err.message || 'An unexpected error occurred connecting to Facebook.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
      {/* Header and Details */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {/* Facebook Icon Badge */}
          <div className="w-11 h-11 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2] shrink-0">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h3 className="text-base md:text-lg font-black text-brand-navy tracking-tight">
              Facebook Lead Ads
            </h3>
            <p className="text-xs md:text-sm font-medium text-gray-500">
              Automatically receive Facebook and Instagram leads.
            </p>
          </div>
        </div>

        {/* Status Display */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-[#F7F8FA] border border-[#E6E8EC] px-3.5 py-1.5 rounded-xl">
          <span className="text-xs font-bold text-gray-500">Status:</span>
          {checkingStatus ? (
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking...
            </span>
          ) : status === 'connected' ? (
            <span className="text-xs font-bold text-[#22C55E] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              Connected {connectedUser ? `(${connectedUser})` : ''}
            </span>
          ) : (
            <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Success Alert Banner */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-green-50 text-green-800 text-xs md:text-sm font-semibold border border-green-100">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 text-red-700 text-xs md:text-sm font-semibold border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connected Facebook Pages Section */}
      {status === 'connected' && (
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Connected Facebook Pages
            </h4>
            {loadingPages && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading pages...
              </span>
            )}
          </div>

          {pagesError && (
            <div className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
              {pagesError}
            </div>
          )}

          {!loadingPages && pages.length === 0 && !pagesError && (
            <p className="text-xs text-gray-400 italic">
              No Facebook Pages found for this account.
            </p>
          )}

          {pages.length > 0 && (
            <div className="space-y-3">
              {pages.map((page) => (
                <div
                  key={page.facebook_page_id}
                  className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                    page.is_selected
                      ? 'border-[#22C55E]/40 bg-[#F0FDF4]'
                      : 'border-gray-200 bg-[#F7F8FA] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {page.picture ? (
                      <img
                        src={page.picture}
                        alt={page.page_name}
                        className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2] font-black text-sm shrink-0">
                        {page.page_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#171A1F] truncate">
                        {page.page_name}
                      </p>
                      <p className="text-[11px] text-gray-400 font-mono">
                        ID: {page.facebook_page_id}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {page.is_selected ? (
                      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#22C55E]/15 text-[#15803D] text-xs font-bold border border-[#22C55E]/20">
                        <span>Selected ✓</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectPage(page.facebook_page_id)}
                        disabled={selectingPageId === page.facebook_page_id}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {selectingPageId === page.facebook_page_id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Selecting...</span>
                          </>
                        ) : (
                          <span>Select Page</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Forms Section */}
      {status === 'connected' && pages.some((p) => p.is_selected) && (
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Lead Forms
            </h4>
            {loadingForms && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading forms...
              </span>
            )}
          </div>

          {formsError && (
            <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-1">
              <p className="font-bold">Notice from Meta Graph API:</p>
              <p>{formsError}</p>
            </div>
          )}

          {!loadingForms && forms.length === 0 && !formsError && (
            <p className="text-xs text-gray-400 italic">
              No lead forms found for the selected Facebook Page.
            </p>
          )}

          {forms.length > 0 && (
            <div className="space-y-2.5">
              {forms.map((form) => (
                <div
                  key={form.facebook_form_id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 bg-[#F7F8FA]"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-[#171A1F] truncate">
                      {form.form_name}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      ID: {form.facebook_form_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100/70 text-green-800 text-xs font-bold border border-green-200 shrink-0">
                    <span>Status: {form.form_status || 'Active'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
        <p className="text-[11px] font-medium text-gray-400">
          Connect your Facebook Business account to synchronize leads in real-time.
        </p>

        <button
          onClick={handleConnectFacebook}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-black text-xs md:text-sm transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>{status === 'connected' ? 'Reconnect Facebook' : 'Connect Facebook'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
