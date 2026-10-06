import { supabase } from '../../supabaseClient';
import { InspectionReport, InspectionPhoto } from './types';

/**
 * Attaches signed URLs from private storage 'inspection-photos' to photo objects.
 */
export async function populateSignedUrlsForPhotos(photos: InspectionPhoto[]): Promise<InspectionPhoto[]> {
  if (!photos || photos.length === 0) return [];

  return await Promise.all(
    photos.map(async (photo) => {
      if (!photo.storage_path) return photo;
      try {
        const { data, error } = await supabase.storage
          .from('inspection-photos')
          .createSignedUrl(photo.storage_path, 3600); // 1 hour valid
        if (!error && data?.signedUrl) {
          return { ...photo, signedUrl: data.signedUrl };
        }
      } catch (e) {
        console.error('Error generating signed url for photo', photo.id, e);
      }
      return photo;
    })
  );
}

/**
 * Populates signed URLs for an inspection report.
 */
export async function populateSignedUrlsForReport(report: InspectionReport): Promise<InspectionReport> {
  if (!report.photos || report.photos.length === 0) return report;
  const photosWithUrls = await populateSignedUrlsForPhotos(report.photos);
  return { ...report, photos: photosWithUrls };
}

/**
 * Fetches all inspection reports for a customer, with inspector profile, photos, and signed URLs.
 * Ordered by inspection_date DESC, created_at DESC.
 */
export async function fetchInspectionReportsForCustomer(customerId: string): Promise<InspectionReport[]> {
  try {
    const { data, error } = await supabase
      .from('inspection_reports')
      .select(`
        *,
        inspector:profiles!inspected_by(id, full_name),
        photos:inspection_photos(
          *,
          uploader:profiles!uploaded_by(full_name)
        )
      `)
      .eq('customer_id', customerId)
      .order('inspection_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inspection reports:', error);
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Sort photos inside each report by sort_order
    const reports = data.map((rep: any) => ({
      ...rep,
      photos: (rep.photos || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }));

    // Populate signed URLs for photos
    const populated = await Promise.all(reports.map(populateSignedUrlsForReport));
    return populated;
  } catch (err) {
    console.error('fetchInspectionReportsForCustomer failed:', err);
    return [];
  }
}

/**
 * Fetches the latest / current condition inspection report for a customer.
 * Prioritizes completed reports, falls back to most recent report.
 */
export async function fetchLatestInspectionForCustomer(customerId: string): Promise<InspectionReport | null> {
  const reports = await fetchInspectionReportsForCustomer(customerId);
  if (reports.length === 0) return null;
  // If there are completed reports, use the newest completed report; otherwise newest report
  const completed = reports.find(r => r.status === 'completed');
  return completed || reports[0];
}

/**
 * Fetches an inspection report by ID with photos and signed URLs.
 */
export async function fetchInspectionReportById(reportId: string): Promise<InspectionReport | null> {
  try {
    const { data, error } = await supabase
      .from('inspection_reports')
      .select(`
        *,
        inspector:profiles!inspected_by(id, full_name),
        photos:inspection_photos(
          *,
          uploader:profiles!uploaded_by(full_name)
        )
      `)
      .eq('id', reportId)
      .maybeSingle();

    if (error || !data) return null;

    const report: InspectionReport = {
      ...data,
      photos: (data.photos || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    };

    return await populateSignedUrlsForReport(report);
  } catch (err) {
    console.error('fetchInspectionReportById failed:', err);
    return null;
  }
}
