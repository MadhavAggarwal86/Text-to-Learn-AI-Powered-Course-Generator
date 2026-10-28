import { renderInline } from './richText.jsx';

export default function HeadingBlock({ text }) {
  return (
    <h2 className="pt-6 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
      {renderInline(text)}
    </h2>
  );
}
