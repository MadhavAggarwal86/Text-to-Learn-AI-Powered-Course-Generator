import { CheckCircle2, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { renderInline } from './richText.jsx';

const LETTERS = 'ABCDEFGH';

/**
 * One multiple-choice question: pick an option, check it, then see whether it was right
 * and why. The answer is locked after checking; `onAnswer(isCorrect, chosenIndex)` feeds the
 * quiz score.
 */
export default function MCQBlock({ question, options, answer, explanation, number, onAnswer }) {
  const id = useId();
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = checked && selected === answer;

  function check() {
    if (selected === null || checked) return;
    setChecked(true);
    onAnswer?.(selected === answer, selected);
  }

  function optionClass(index) {
    if (!checked) {
      return selected === index
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60'
        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60';
    }
    if (index === answer) return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50';
    if (index === selected) return 'border-red-500 bg-red-50 dark:bg-red-950/50';
    return 'border-slate-200 opacity-60 dark:border-slate-700';
  }

  return (
    <fieldset className="card p-5" aria-describedby={checked ? `${id}-result` : undefined}>
      <legend className="sr-only">Question {number}</legend>
      <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
        Question {number}
      </p>
      <p className="mt-1 font-medium" id={`${id}-question`}>
        {renderInline(question)}
      </p>

      <div className="mt-4 space-y-2" role="radiogroup" aria-labelledby={`${id}-question`}>
        {options.map((option, index) => (
          <label
            key={index}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 ${optionClass(index)} ${checked ? 'cursor-default' : ''}`}
          >
            <input
              type="radio"
              name={id}
              value={index}
              checked={selected === index}
              onChange={() => setSelected(index)}
              disabled={checked}
              className="sr-only"
            />
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
              {LETTERS[index]}
            </span>
            <span className="flex-1">{renderInline(option)}</span>
            {checked && index === answer && (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-600"
                aria-label="Correct answer"
              />
            )}
            {checked && index === selected && index !== answer && (
              <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="Your answer" />
            )}
          </label>
        ))}
      </div>

      {!checked && (
        <button
          type="button"
          onClick={check}
          disabled={selected === null}
          className="btn-primary mt-4"
        >
          Check answer
        </button>
      )}

      {checked && (
        <div
          id={`${id}-result`}
          role="status"
          className={`mt-4 rounded-lg p-4 text-sm ${isCorrect ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200'}`}
        >
          <p className="font-semibold">
            {isCorrect ? 'Correct!' : `Not quite. The answer is ${LETTERS[answer]}.`}
          </p>
          <p className="mt-1">{renderInline(explanation)}</p>
        </div>
      )}
    </fieldset>
  );
}
