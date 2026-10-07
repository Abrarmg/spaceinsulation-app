import React, { useState, useRef, useEffect } from 'react';
import { Job } from './types';
import { 
  getJobCardTheme, 
  getJobTypeDetails, 
  formatJobTimeRange, 
  getJobCrewMembers 
} from './schedulingUtils';
import { 
  Home, 
  Wind, 
  Layers, 
  ShieldCheck, 
  ClipboardList, 
  FileText, 
  Package, 
  MoreVertical,
  ExternalLink,
  MapPin,
  Edit2,
  Copy,
  Check
} from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  onEdit?: (job: Job) => void;
  compact?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({ 
  job, 
  onClick, 
  onEdit,
  compact = false 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const theme = getJobCardTheme(job);
  const typeDetails = getJobTypeDetails(job);
  const timeRange = formatJobTimeRange(job);
  const crewMembers = getJobCrewMembers(job);

  const customerName = job.customers?.full_name || 'Customer';
  const serviceAddress = job.customers?.service_address || 'No address listed';

  // Close context menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.customers?.service_address) {
      navigator.clipboard.writeText(job.customers.service_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setMenuOpen(false);
  };

  const handleOpenGoogleMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.customers?.service_address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customers.service_address)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
    setMenuOpen(false);
  };

  const renderIcon = () => {
    const size = 13;
    const className = `shrink-0 ${theme.iconColor}`;
    switch (typeDetails.iconName) {
      case 'home':
        return <Home size={size} className={className} />;
      case 'wind':
        return <Wind size={size} className={className} />;
      case 'layers':
        return <Layers size={size} className={className} />;
      case 'shield':
        return <ShieldCheck size={size} className={className} />;
      case 'clipboard':
        return <ClipboardList size={size} className={className} />;
      case 'file':
        return <FileText size={size} className={className} />;
      case 'box':
      default:
        return <Package size={size} className={className} />;
    }
  };

  return (
    <div
      onClick={() => onClick(job)}
      className={`group relative w-full ${theme.bg} ${theme.border} ${theme.borderAccent} border rounded-xl p-2.5 mb-1.5 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer select-none text-left`}
    >
      {/* Top Row: Time Range & 3-dots Menu */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[10px] font-bold ${theme.timeColor} tracking-tight truncate`}>
          {timeRange}
        </span>

        {/* 3-dots menu button */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors cursor-pointer border-none bg-transparent"
            title="Job Options"
          >
            <MoreVertical size={13} />
          </button>

          {/* Context menu popover */}
          {menuOpen && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onClick(job);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors text-slate-700 border-none bg-transparent cursor-pointer"
              >
                <ExternalLink size={13} className="text-slate-400" />
                <span>View Job Details</span>
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(job);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors text-slate-700 border-none bg-transparent cursor-pointer"
                >
                  <Edit2 size={13} className="text-slate-400" />
                  <span>Edit Job</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenGoogleMaps}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors text-slate-700 border-none bg-transparent cursor-pointer"
              >
                <MapPin size={13} className="text-[#76C442]" />
                <span>GPS Directions</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAddress}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors text-slate-700 border-none bg-transparent cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-slate-400" />}
                <span>{copied ? 'Address Copied!' : 'Copy Address'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Icon & Job Title */}
      <div className="flex items-center gap-1.5 mb-1 truncate">
        {renderIcon()}
        <span className={`text-[11px] font-bold ${theme.titleColor} truncate leading-tight`}>
          {typeDetails.title}
        </span>
      </div>

      {/* Customer Full Name */}
      <div className="text-[10.5px] font-semibold text-slate-800 truncate mb-0.5">
        {customerName}
      </div>

      {/* Service Address */}
      {!compact && (
        <div className="text-[9.5px] text-slate-500 truncate mb-2 leading-tight">
          {serviceAddress}
        </div>
      )}

      {/* Bottom Row: Crew Avatars (left) and Status Pill (right) */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5 mt-auto">
        {/* Overlapping crew avatars */}
        <div className="flex items-center -space-x-1.5 shrink-0 overflow-hidden py-0.5">
          {crewMembers.length > 0 ? (
            crewMembers.slice(0, 3).map((cm, idx) => (
              <div
                key={cm.id || idx}
                title={cm.name}
                className={`w-5 h-5 rounded-full ${cm.bgColor} ${cm.textColor} border border-white flex items-center justify-center text-[8.5px] font-extrabold shadow-3xs shrink-0 select-none`}
              >
                {cm.initials}
              </div>
            ))
          ) : (
            <div 
              title="Unassigned crew" 
              className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center text-[8px] font-bold"
            >
              ?
            </div>
          )}
          {crewMembers.length > 3 && (
            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 border border-white flex items-center justify-center text-[7.5px] font-bold shadow-3xs">
              +{crewMembers.length - 3}
            </div>
          )}
        </div>

        {/* Status Pill Badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${theme.pillBg} ${theme.pillText} shrink-0 leading-none shadow-3xs`}>
          {theme.pillLabel}
        </span>
      </div>
    </div>
  );
};
