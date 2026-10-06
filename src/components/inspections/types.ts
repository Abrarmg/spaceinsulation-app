export type PhotoCategory = 
  | 'insulation_depth'
  | 'attic_overview'
  | 'soffits_baffles'
  | 'air_sealing'
  | 'mold_moisture'
  | 'attic_hatch'
  | 'other';

export interface PhotoCategoryMeta {
  id: PhotoCategory;
  label: string;
  description: string;
}

export const PHOTO_CATEGORIES: PhotoCategoryMeta[] = [
  { id: 'insulation_depth', label: 'Insulation Depth', description: 'Ruler or tape measure showing depth of insulation' },
  { id: 'attic_overview', label: 'Attic Overview', description: 'Wide shots of the attic space, framing, and general condition' },
  { id: 'soffits_baffles', label: 'Soffits & Baffles', description: 'Eaves, soffit vents, and cardboard/plastic baffle chutes' },
  { id: 'air_sealing', label: 'Air Sealing', description: 'Penetrations, wire drops, top plates, and plumbing chases' },
  { id: 'mold_moisture', label: 'Mold & Moisture', description: 'Signs of condensation, moisture staining, or mildew' },
  { id: 'attic_hatch', label: 'Attic Hatch', description: 'Attic access hatch, weatherstripping, and dam framing' },
  { id: 'other', label: 'Other Attic Photos', description: 'Miscellaneous equipment, bath fans, or wiring' }
];

export interface InspectionPhoto {
  id: string;
  inspection_report_id: string;
  customer_id: string;
  uploaded_by: string | null;
  category: PhotoCategory;
  storage_path: string;
  file_name: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
  signedUrl?: string;
  uploader?: {
    full_name: string;
  } | null;
}

export interface InspectionReport {
  id: string;
  customer_id: string;
  assessment_id: string | null;
  job_id: string | null;
  inspected_by: string | null;
  inspection_date: string;
  status: 'draft' | 'completed';
  current_r_value: string | null;
  target_r_value: string | null;
  attic_sqft: number | null;
  current_insulation_type: string | null;
  insulation_depth: string | null;
  soffits_baffles_condition: string | null;
  general_condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  inspector?: {
    id: string;
    full_name: string;
  } | null;
  photos?: InspectionPhoto[];
}
