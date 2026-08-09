import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, Navigation, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export const TimeClockWidget: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [activeEntry, setActiveEntry] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeoLoading, setIsGeoLoading] = useState(false);

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // Shift timer states
  const [shiftDuration, setShiftDuration] = useState<string>('00:00:00');

  // Load session, profile, and active time entries
  const loadTimeState = useCallback(async (currUser: any) => {
    if (!currUser) {
      setProfile(null);
      setActiveEntry(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch profile details (for consent_given_at checks)
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currUser.id)
        .maybeSingle();

      if (profErr) throw profErr;
      setProfile(profData);

      // 2. Fetch active time entry (clock_out is null)
      const { data: entryData, error: entryErr } = await supabase
        .from('time_entries')
        .select('*')
        .eq('worker_id', currUser.id)
        .is('clock_out', null)
        .maybeSingle();

      if (entryErr) throw entryErr;
      setActiveEntry(entryData);

    } catch (err) {
      console.error('Failed to load time clock state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      loadTimeState(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      loadTimeState(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [loadTimeState]);

  // Handle active shift ticking timer duration calculation
  useEffect(() => {
    if (!activeEntry) return;

    const interval = setInterval(() => {
      const start = new Date(activeEntry.clock_in).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;

      if (diffMs <= 0) {
        setShiftDuration('00:00:00');
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      const pad = (n: number) => n.toString().padStart(2, '0');
      setShiftDuration(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEntry]);

  // Geolocation wrapper resolving lat/lng coordinates (resolves null if GPS is disabled or rejected)
  const getCoordinates = (): Promise<{ lat: number | null; lng: number | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        resolve({ lat: null, lng: null });
        return;
      }

      setIsGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsGeoLoading(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setIsGeoLoading(false);
          console.warn(`Geolocation lookup failed (Code ${err.code}): ${err.message}`);
          resolve({ lat: null, lng: null }); // Fallback graceful log entry
        },
        { timeout: 8000 }
      );
    });
  };

  // Submit worker geolocation consent
  const handleAcceptConsent = async () => {
    if (!user) return;
    setConsentError(null);

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ consent_given_at: now })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev: any) => ({ ...prev, consent_given_at: now }));
      setShowConsentModal(false);
      
      // Auto trigger clock in flow after consent accepted
      await executeClockIn();
    } catch (err: any) {
      console.error('Failed to submit location consent:', err);
      setConsentError('Consent submission failed: ' + err.message);
    }
  };

  // Pre-check consent criteria
  const handleClockInClick = () => {
    if (!profile?.consent_given_at) {
      setShowConsentModal(true);
    } else {
      executeClockIn();
    }
  };

  // Execute Supabase Clock-In
  const executeClockIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const coords = await getCoordinates();
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          worker_id: user.id,
          clock_in: new Date().toISOString(),
          clock_in_lat: coords.lat,
          clock_in_lng: coords.lng
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      setActiveEntry(data);
    } catch (err: any) {
      console.error('Clock-in failed:', err);
      alert('Clock-in failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute Supabase Clock-Out
  const handleClockOut = async () => {
    if (!user || !activeEntry) return;
    setLoading(true);
    try {
      const coords = await getCoordinates();
      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: coords.lat,
          clock_out_lng: coords.lng
        })
        .eq('id', activeEntry.id);

      if (error) throw error;
      setActiveEntry(null);
      setShiftDuration('00:00:00');
    } catch (err: any) {
      console.error('Clock-out failed:', err);
      alert('Clock-out failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) return null;
  if (profile?.role === 'office_staff') return null;

  return (
    <div className="flex items-center gap-3">
      
      {/* Shift status logs */}
      {activeEntry ? (
        <div className="flex items-center gap-3 bg-brand-charcoal text-white rounded-full px-4 py-1.5 border border-brand-dark shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-brand-green rounded-full animate-ping" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green leading-none">
              On Shift
            </span>
          </div>
          <span className="text-xs font-mono font-bold border-l border-brand-dark pl-2.5 text-white">
            {shiftDuration}
          </span>
          
          <button
            onClick={handleClockOut}
            disabled={isGeoLoading}
            className="text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1 cursor-pointer transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            {isGeoLoading && <Loader2 size={10} className="animate-spin" />}
            <span>Clock Out</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleClockInClick}
          disabled={isGeoLoading}
          className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-full shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
        >
          {isGeoLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Clock size={13} className="stroke-[2.5]" />
          )}
          <span>Clock In</span>
        </button>
      )}

      {/* Geolocation Compliance Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setShowConsentModal(false)}
          />

          <div className="relative bg-white w-full max-w-sm rounded-xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col">
            
            {/* Header */}
            <div className="p-4 bg-brand-charcoal text-white flex items-center gap-2">
              <Navigation size={18} className="text-brand-green" />
              <h3 className="text-sm font-bold text-white m-0">Location Tracking Consent</h3>
            </div>

            {/* Description */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-charcoal font-medium leading-relaxed m-0">
                To comply with dispatch dispatch safety, client arrival triggers, and accurate payroll logging, Space Insulation records your GPS coordinates <strong>only at the exact moments of clock-in and clock-out</strong>.
              </p>
              
              <div className="p-3 bg-brand-grey-light rounded-lg border border-brand-grey-medium text-[10px] text-brand-grey-dark space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1 font-bold text-brand-charcoal">
                  <ShieldCheck size={12} className="text-brand-green" />
                  <span>Your Privacy Safeguards:</span>
                </div>
                <div>• No background location recording outside active shift logging.</div>
                <div>• Used solely for client address proximity calculations.</div>
              </div>

              {consentError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <span>{consentError}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3.5 bg-brand-grey border-t border-brand-grey-medium flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-3.5 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey-medium text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Decline
              </button>
              
              <button
                type="button"
                onClick={handleAcceptConsent}
                className="px-4 py-1.5 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Accept & Proceed
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
