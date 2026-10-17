import type { jsPDF } from 'jspdf';
import { generateDocumentPdf, pdfToBase64 } from './documentPdf';

export const generateEstimateJsPdf = (element: HTMLElement): Promise<jsPDF> => generateDocumentPdf(element);

export async function generateEstimatePdfBase64(element: HTMLElement): Promise<{ pdf: jsPDF; pdfBase64: string }> {
  const pdf = await generateDocumentPdf(element);
  return { pdf, pdfBase64: await pdfToBase64(pdf) };
}
