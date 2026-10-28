import { RichText } from './richText.jsx';

export default function ParagraphBlock({ text }) {
  return (
    <div className="space-y-3 leading-7 text-slate-700 dark:text-slate-300">
      <RichText text={text} />
    </div>
  );
}
