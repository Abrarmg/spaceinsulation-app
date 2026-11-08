import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const NotFound: React.FC = () => {
  const { role } = useAuth();
  const home = role === 'field_worker' ? '/worker-dashboard' : '/';

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-bold text-navy">404</p>
      <h1 className="text-xl font-bold text-navy">Page not found</h1>
      <p className="text-sm text-muted">The page you're looking for doesn't exist or was moved.</p>
      <Link
        to={home}
        className="px-4 py-2 rounded-xl text-sm font-bold bg-navy text-white hover:bg-navy-soft"
      >
        Back to dashboard
      </Link>
    </div>
  );
};
