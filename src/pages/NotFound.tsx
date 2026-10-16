import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const NotFound: React.FC = () => {
  const { role } = useAuth();
  const home = role === 'field_worker' ? '/worker-dashboard' : '/';

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-black text-[#151A2D]">404</p>
      <h1 className="text-xl font-bold text-[#151A2D]">Page not found</h1>
      <p className="text-sm text-[#737A86]">The page you're looking for doesn't exist or was moved.</p>
      <Link
        to={home}
        className="px-4 py-2 rounded-xl text-sm font-bold bg-[#151A2D] text-white hover:bg-[#252B45]"
      >
        Back to dashboard
      </Link>
    </div>
  );
};
