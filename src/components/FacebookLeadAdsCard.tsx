import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const FacebookLeadAdsCard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [status, setStatus] = useState<'connected' | 'not_connected'>('not_connected');
  const [connectedUser, setConnectedUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
              <span>Connect Facebook</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
