export interface Job {
  id: string;
  customer_id: string;
  job_number: number;
  status: string;
  priority?: string;
  scheduled_date: string | null;
  assigned_worker_id: string | null;
  attic_sqft: number | null;
  existing_r_value: number | null;
  target_r_value: number | null;
  scope_of_work: string | null;
  quoted_amount: number | null;
  estimated_material_cost: number | null;
  created_at: string;
  customers: {
    full_name: string;
    service_address: string;
  } | null;
  profiles: {
    full_name: string;
  } | null;
}

export interface JobFilterState {
  searchQuery: string;
  status: string;
  dateRange: string;
  crew: string;
  sort: string;
}
