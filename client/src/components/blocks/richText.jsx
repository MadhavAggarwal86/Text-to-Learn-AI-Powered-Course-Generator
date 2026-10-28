// Turns AI-written lesson text into React elements. It understands only the small
// formatting the lesson prompt asks for: **bold**, `inline code`, line breaks, and lines
// starting with "- " (bullets) or "1. " (numbered). Everything is rendered as text nodes,
// never as HTML, so model output can't inject markup or scripts.

const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/** **bold** and `code` inside a single line of text. */
export function renderInline(text) {
  return text.split(INLINE_TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-pink-700 dark:bg-slate-800 dark:text-pink-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function lineKind(line) {
  if (BULLET.test(line)) return 'bullet';
  if (NUMBERED.test(line)) return 'numbered';
  if (line.trim() === '') return 'blank';
  return 'text';
}

/**
 * Groups lines into paragraphs and lists:
 *   [{ kind: 'text', lines: [...] }, { kind: 'bullet', items: [...] }, ...]
 * Blank lines end the current group.
 */
export function groupLines(text) {
  const groups = [];
  for (const line of text.split('\n')) {
    const kind = lineKind(line);
    const last = groups.at(-1);
    if (kind === 'blank') {
      groups.push({ kind: 'break' });
    } else if (kind === 'text') {
      if (last?.kind === 'text') last.lines.push(line.trim());
      else groups.push({ kind: 'text', lines: [line.trim()] });
    } else {
      const item = line.replace(kind === 'bullet' ? BULLET : NUMBERED, '').trim();
      if (last?.kind === kind) last.items.push(item);
      else groups.push({ kind, items: [item] });
    }
  }
  return groups.filter((group) => group.kind !== 'break');
}

/** A block of lesson text: paragraphs (with line breaks) and bullet/numbered lists. */
export function RichText({ text }) {
  return groupLines(text).map((group, i) => {
    if (group.kind === 'text') {
      return (
        <p key={i}>
          {group.lines.map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {renderInline(line)}
            </span>
          ))}
        </p>
      );
    }
    const List = group.kind === 'numbered' ? 'ol' : 'ul';
    return (
      <List
        key={i}
        className={`space-y-1 pl-6 ${group.kind === 'numbered' ? 'list-decimal' : 'list-disc'}`}
      >
        {group.items.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </List>
    );
  });
}
