export interface Certification {
  id: string;
  name: string;
  issue_date: string | null;
  expiry_date: string | null;
}

export interface DayAvailability {
  isAvailable: boolean;
  start: string;
  end: string;
}

export interface WeeklyAvailability {
  MON: DayAvailability;
  TUE: DayAvailability;
  WED: DayAvailability;
  THU: DayAvailability;
  FRI: DayAvailability;
  SAT: DayAvailability;
  SUN: DayAvailability;
}

export interface Profile {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  email: string | null; // Often found in profiles or auth
  is_active: boolean;
  start_date: string | null;
  internal_notes: string | null;
  weekly_availability: WeeklyAvailability | null;
  
  // Backwards compatibility for old data
  availability: string | null;
  certification_name: string | null;
  certification_expiry: string | null;
  status: string | null;
  
  profile_wages?: {
    hourly_rate: number | null;
    payroll_type: string | null;
  } | null;
  
  staff_certifications?: Certification[];
}

export interface TimeEntry {
  id: string;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  profiles?: {
    full_name: string;
  } | null;
}

export interface StaffFilterState {
  searchQuery: string;
  role: string;
  status: string;
  certification: string;
  availability: string;
}
