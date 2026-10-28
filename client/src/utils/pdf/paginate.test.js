import { describe, expect, it } from 'vitest';
import { breakTops, latin1, pdfFileName, placeLinks, planPageSlices } from './paginate.js';

describe('breakTops', () => {
  it('never allows a break right after a keep-with-next block (a heading)', () => {
    const blocks = [
      { top: 0 },
      { top: 300, keepWithNext: true }, // heading
      { top: 340 }, // its paragraph: no break allowed before it
      { top: 700 },
    ];

    expect(breakTops(blocks)).toEqual([0, 300, 700]);
  });

  it('keeps a heading with its text when the page would otherwise end after it', () => {
    // Without the rule the page would end at 960 with the heading stranded at 900-960.
    const blocks = [{ top: 0 }, { top: 500 }, { top: 900, keepWithNext: true }, { top: 960 }];

    expect(planPageSlices(breakTops(blocks), 1500, 1000)[0]).toEqual({ start: 0, end: 900 });
  });
});

describe('planPageSlices', () => {
  it('uses one page when everything fits', () => {
    expect(planPageSlices([0, 100, 300], 500, 1000)).toEqual([{ start: 0, end: 500 }]);
  });

  it('breaks before the last block that still starts on the page', () => {
    // Blocks start at 0, 400, 700, 950; pages hold 1000px; content is 1600px.
    const slices = planPageSlices([0, 400, 700, 950], 1600, 1000);

    expect(slices).toEqual([
      { start: 0, end: 950 },
      { start: 950, end: 1600 },
    ]);
  });

  it('never cuts a block that fits on a page', () => {
    const tops = [0, 300, 650, 900, 1250, 1500, 1900];
    const total = 2200;
    const slices = planPageSlices(tops, total, 1000);

    for (const { end } of slices.slice(0, -1)) expect(tops).toContain(end);
    expect(slices.every(({ start, end }) => end - start <= 1000)).toBe(true);
  });

  it('cuts a block taller than a whole page at the page limit', () => {
    // A 2500px block (e.g. a very long code sample) starting at 100.
    const slices = planPageSlices([0, 100, 2600], 2800, 1000);

    expect(slices).toEqual([
      { start: 0, end: 100 },
      { start: 100, end: 1100 },
      { start: 1100, end: 2100 },
      { start: 2100, end: 2800 },
    ]);
  });

  it('covers the content exactly once, with no gaps or overlaps', () => {
    const slices = planPageSlices([0, 120, 480, 900, 1300, 1700, 2050], 2400, 800);

    expect(slices[0].start).toBe(0);
    expect(slices.at(-1).end).toBe(2400);
    slices.slice(1).forEach((slice, i) => expect(slice.start).toBe(slices[i].end));
  });

  it('ignores duplicate and zero block tops', () => {
    expect(planPageSlices([0, 0, 500, 500], 900, 600)).toEqual([
      { start: 0, end: 500 },
      { start: 500, end: 900 },
    ]);
  });
});

describe('placeLinks', () => {
  const slices = [
    { start: 0, end: 950 },
    { start: 950, end: 1600 },
  ];

  it('puts each link on its page with page-relative coordinates', () => {
    const placed = placeLinks(
      [
        { url: 'https://a.example', top: 100, bottom: 120, left: 10, width: 200 },
        { url: 'https://b.example', top: 1000, bottom: 1018, left: 20, width: 150 },
      ],
      slices,
    );

    expect(placed).toEqual([
      { url: 'https://a.example', page: 0, top: 100, height: 20, left: 10, width: 200 },
      { url: 'https://b.example', page: 1, top: 50, height: 18, left: 20, width: 150 },
    ]);
  });

  it('drops a link that straddles a page break', () => {
    expect(
      placeLinks([{ url: 'https://c.example', top: 940, bottom: 960, left: 0, width: 50 }], slices),
    ).toEqual([]);
  });
});

describe('pdfFileName', () => {
  it.each([
    ['The useEffect Hook Basics', 'text-to-learn-the-useeffect-hook-basics.pdf'],
    ['Café & Crème: Résumé!', 'text-to-learn-cafe-creme-resume.pdf'],
    ['   ', 'text-to-learn-lesson.pdf'],
    ['हिंदी', 'text-to-learn-lesson.pdf'],
  ])('%j → %s', (title, expected) => {
    expect(pdfFileName(title)).toBe(expected);
  });

  it('keeps names reasonably short', () => {
    expect(pdfFileName('a'.repeat(200)).length).toBeLessThanOrEqual(
      'text-to-learn-.pdf'.length + 60,
    );
  });
});

describe('latin1', () => {
  it('drops characters the built-in PDF fonts cannot draw', () => {
    expect(latin1('Text-to-Learn · Café 🚀 हिंदी')).toBe('Text-to-Learn · Café');
  });
});
