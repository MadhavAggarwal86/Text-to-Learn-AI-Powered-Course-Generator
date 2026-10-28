import { Download, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pdfFileName } from '../../utils/pdf/paginate.js';
import LessonPrintView from './LessonPrintView.jsx';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/**
 * "Download PDF" for a lesson. While exporting, a light, A4-width copy of the lesson is
 * rendered off-screen; it is captured and turned into a PDF, then removed. The PDF code
 * (html2canvas-pro + jsPDF, ~600 kB) is only downloaded the first time this is used.
 */
export default function LessonPDFExporter({ courseTitle, position, lesson }) {
  const [status, setStatus] = useState('idle'); // idle | exporting | error
  const printRef = useRef(null);

  useEffect(() => {
    if (status !== 'exporting') return;
    let cancelled = false;

    (async () => {
      try {
        // Let the off-screen copy lay out and its fonts load before capturing it.
        await document.fonts?.ready;
        await nextFrame();
        await nextFrame();
        const { downloadLessonPdf } = await import('../../utils/pdf/buildLessonPdf.js');
        await downloadLessonPdf(printRef.current, {
          fileName: pdfFileName(lesson.title),
          footerText: `Text-to-Learn · ${courseTitle}`,
        });
        if (!cancelled) setStatus('idle');
      } catch (error) {
        console.error('PDF export failed', error);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, lesson.title, courseTitle]);

  const exporting = status === 'exporting';

  return (
    <>
      <button
        type="button"
        onClick={() => setStatus('exporting')}
        disabled={exporting}
        className="btn-secondary"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting ? 'Preparing PDF…' : 'Download PDF'}
      </button>
      {status === 'error' && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t create the PDF. Please try again.
        </span>
      )}

      {exporting &&
        createPortal(
          // Off-screen, not hidden: display:none or opacity:0 would make the capture blank.
          <div style={{ position: 'fixed', left: -10_000, top: 0, zIndex: -1 }}>
            <LessonPrintView
              ref={printRef}
              courseTitle={courseTitle}
              moduleNumber={position.moduleNumber}
              moduleTitle={position.module.title}
              lessonNumber={position.index + 1}
              lessonCount={position.total}
              lesson={lesson}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
