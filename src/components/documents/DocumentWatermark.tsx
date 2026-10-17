import React from 'react';
import { WATERMARK_OPACITY, WATERMARK_SRC } from '../../utils/documentPdf';

/**
 * Faint logo behind an on-screen document. The parent must be `position: relative` with
 * `isolation: isolate`. PDF export removes this and draws a centered watermark on each page instead.
 */
export const DocumentWatermark: React.FC = () => (
  <div
    data-watermark
    aria-hidden="true"
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center',
      paddingTop: '300px',
      overflow: 'hidden',
    }}
  >
    <img src={WATERMARK_SRC} alt="" style={{ width: '62%', height: 'auto', opacity: WATERMARK_OPACITY, alignSelf: 'flex-start' }} />
  </div>
);
