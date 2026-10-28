// Pure layout maths for the PDF export, kept free of DOM/canvas code so it can be tested.

/**
 * Where a page may break, given the blocks in order ([{ top, keepWithNext }]): before any
 * block, except right after one marked keepWithNext (a heading must not end a page).
 */
export function breakTops(blocks) {
  return blocks.filter((_, i) => i === 0 || !blocks[i - 1].keepWithNext).map((b) => b.top);
}

/**
 * Splits content `totalHeight` px tall into page slices of at most `pageHeight` px.
 * Breaks are placed at block tops (`blockTops`), choosing the last one that still fits,
 * so blocks stay whole. Only a block taller than a full page is cut at the page limit.
 * Returns [{ start, end }] in px.
 */
export function planPageSlices(blockTops, totalHeight, pageHeight) {
  const breaks = [...new Set(blockTops)].filter((top) => top > 0).sort((a, b) => a - b);
  const slices = [];
  let start = 0;

  while (totalHeight - start > 0.5) {
    const limit = start + pageHeight;
    if (limit >= totalHeight) {
      slices.push({ start, end: totalHeight });
      break;
    }
    const fitting = breaks.filter((top) => top > start + 0.5 && top <= limit);
    const end = fitting.length ? fitting.at(-1) : limit;
    slices.push({ start, end });
    start = end;
  }
  return slices;
}

/**
 * Puts each link rectangle ({ url, top, bottom, left, width }, px) on the page whose slice
 * contains it: returns { url, page, left, width, top (relative to the page), height }.
 * Links that straddle a break are dropped (a page break never falls inside a block, so this
 * only affects blocks too tall for one page).
 */
export function placeLinks(links, slices) {
  return links.flatMap(({ url, top, bottom, left, width }) => {
    const page = slices.findIndex((s) => top >= s.start - 0.5 && bottom <= s.end + 0.5);
    if (page === -1) return [];
    return [{ url, page, left, width, top: top - slices[page].start, height: bottom - top }];
  });
}

/** "React Hooks: useEffect!" → "text-to-learn-react-hooks-useeffect.pdf" */
export function pdfFileName(title) {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `text-to-learn-${slug || 'lesson'}.pdf`;
}

/** jsPDF's built-in fonts only cover Latin-1; drop anything else from footer text. */
export function latin1(text) {
  return text.replace(/[^\x20-\x7e\xa0-\xff]/g, '').trim();
}
