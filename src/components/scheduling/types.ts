export interface Customer {
  id?: string;
  full_name: string;
  service_address: string | null;
  phone_number?: string | null;
  email?: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  role?: string;
}

export interface JobCrewMember {
  worker_id: string;
  profiles?: Profile | null;
}

export interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  assigned_worker_id: string | null;
  scope_of_work: string | null;
  attic_sqft: number | null;
  customers: Customer | null;
  profiles: Profile | null;
  job_crew?: JobCrewMember[];
}

export interface Assessment {
  id: string;
  lead_id: string;
  customer_id: string | null;
  assigned_to: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  notes: string | null;
  leads: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    source: string | null;
  } | null;
  profiles: Profile | null;
}

export type CalendarViewMode = 'month' | 'week' | 'day';

export type JobStatusCategory = 
  | 'inspection' 
  | 'quote_pending' 
  | 'scheduled' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export interface CalendarFilterState {
  searchQuery: string;
  crewFilter: string; // 'all' or worker_id/name
  jobTypeFilter: string; // 'all' or specific scope category
  statusFilter: string; // 'all' or status
}

export interface CrewMemberSummary {
  id: string;
  name: string;
  avatarInitials: string;
  avatarBg: string;
  avatarFg: string;
  status: 'on_job' | 'available' | 'off_today';
  jobCountThisMonth: number;
  todayJobCount: number;
}
