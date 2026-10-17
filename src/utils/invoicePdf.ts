import type { jsPDF } from 'jspdf';
import { generateDocumentPdf, pdfToBase64 } from './documentPdf';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { InvoiceDocument, InvoiceDocumentData } from '../components/invoice/InvoiceDocument';

export const generateInvoiceJsPdf = (element: HTMLElement): Promise<jsPDF> => generateDocumentPdf(element);

export async function generateInvoicePdfBase64(element: HTMLElement): Promise<{ pdf: jsPDF; pdfBase64: string }> {
  const pdf = await generateDocumentPdf(element);
  return { pdf, pdfBase64: await pdfToBase64(pdf) };
}

/**
 * Generates an Invoice PDF from invoice data directly by mounting the InvoiceDocument component offscreen.
 * Useful for list views or automated workflows where the preview element is not already in the DOM.
 */
export async function generateInvoicePdfFromData(invoice: InvoiceDocumentData): Promise<{ pdf: jsPDF; pdfBase64: string }> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '8.5in';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  const root = createRoot(container);

  return new Promise<{ pdf: jsPDF; pdfBase64: string }>((resolve, reject) => {
    root.render(React.createElement(InvoiceDocument, { invoice, containerId: 'invoice-doc-headless' }));

    // Wait for DOM to render and any images to paint
    setTimeout(async () => {
      try {
        const docElem = (container.querySelector('#invoice-doc-headless') as HTMLElement) || container;
        const res = await generateInvoicePdfBase64(docElem);
        resolve(res);
      } catch (err) {
        reject(err);
      } finally {
        try {
          root.unmount();
          container.remove();
        } catch (_) {}
      }
    }, 150);
  });
}
