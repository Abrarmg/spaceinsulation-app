import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AdminEstimatesList } from './estimates/AdminEstimatesList';
import { WorkerEstimatesList } from './estimates/WorkerEstimatesList';
import { Loader2 } from 'lucide-react';

export const EstimatesList: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setCurrentUserRole(data.role);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  if (currentUserRole === 'field_worker') {
    return <WorkerEstimatesList />;
  }

  return <AdminEstimatesList />;
};
