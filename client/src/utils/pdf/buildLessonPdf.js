import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { breakTops, latin1, placeLinks, planPageSlices } from './paginate.js';

// This module (and its two large libraries) is only loaded when someone clicks
// "Download PDF" (see LessonPDFExporter's dynamic import).

const PAGE = { width: 210, height: 297 }; // A4, mm
const MARGIN = 14; // mm
const FOOTER = 8; // mm reserved at the bottom for the footer line
const MAX_CANVAS_PX = 30_000; // browsers refuse canvases much taller than ~32k px

/**
 * Renders `element` (a LessonPrintView) to a multi-page A4 PDF and starts the download.
 * One screenshot is taken of the whole element, then cut into pages between its
 * [data-pdf-block] children. Links inside it stay clickable in the PDF.
 */
export async function downloadLessonPdf(element, { fileName, footerText }) {
  const contentWidth = PAGE.width - 2 * MARGIN;
  const mmPerPx = contentWidth / element.offsetWidth;
  const pageHeightPx = (PAGE.height - 2 * MARGIN - FOOTER) / mmPerPx;

  const origin = element.getBoundingClientRect();
  const blocks = [...element.querySelectorAll(':scope > [data-pdf-block]')].map((block) => ({
    top: block.getBoundingClientRect().top - origin.top,
    keepWithNext: block.hasAttribute('data-pdf-keep-with-next'),
  }));
  const blockTops = breakTops(blocks);
  const links = [...element.querySelectorAll('a[href]')].map((anchor) => {
    const rect = anchor.getBoundingClientRect();
    return {
      url: anchor.href,
      top: rect.top - origin.top,
      bottom: rect.bottom - origin.top,
      left: rect.left - origin.left,
      width: rect.width,
    };
  });

  const totalHeight = element.scrollHeight;
  const scale = Math.min(2, MAX_CANVAS_PX / totalHeight); // 2x for sharp text when possible
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const slices = planPageSlices(blockTops, totalHeight, pageHeightPx);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage();
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.max(1, Math.round((slice.end - slice.start) * scale));
    pageCanvas
      .getContext('2d')
      .drawImage(
        canvas,
        0,
        Math.round(slice.start * scale),
        canvas.width,
        pageCanvas.height,
        0,
        0,
        canvas.width,
        pageCanvas.height,
      );
    pdf.addImage(
      pageCanvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      MARGIN,
      MARGIN,
      contentWidth,
      (slice.end - slice.start) * mmPerPx,
    );
  });

  for (const link of placeLinks(links, slices)) {
    pdf.setPage(link.page + 1);
    pdf.link(
      MARGIN + link.left * mmPerPx,
      MARGIN + link.top * mmPerPx,
      link.width * mmPerPx,
      link.height * mmPerPx,
      { url: link.url },
    );
  }

  const pageCount = slices.length;
  const footer = latin1(footerText);
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(footer, MARGIN, PAGE.height - MARGIN / 2);
    pdf.text(`Page ${page} of ${pageCount}`, PAGE.width - MARGIN, PAGE.height - MARGIN / 2, {
      align: 'right',
    });
  }

  pdf.save(fileName);
  return { pageCount };
}
