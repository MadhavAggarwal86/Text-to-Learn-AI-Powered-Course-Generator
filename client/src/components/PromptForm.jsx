import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DIFFICULTIES } from '../utils/format.js';

const EXAMPLE_TOPICS = [
  'Intro to React Hooks',
  'Basics of Copyright Law',
  'How Photosynthesis Works',
  'Personal Finance for Beginners',
];

// Same limits the API enforces; checking here gives instant feedback.
const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

export default function PromptForm({ onSubmit, isGenerating }) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [touched, setTouched] = useState(false);

  const trimmed = topic.trim();
  const tooShort = trimmed.length < MIN_LENGTH;
  const showError = touched && tooShort;

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (tooShort || isGenerating) return;
    onSubmit({ topic: trimmed, difficulty });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 text-left sm:p-6" noValidate>
      <label htmlFor="topic" className="block text-sm font-medium">
        What do you want to learn?
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onBlur={() => setTouched(Boolean(topic))}
          maxLength={MAX_LENGTH}
          disabled={isGenerating}
          placeholder="e.g. Intro to React Hooks"
          aria-invalid={showError}
          aria-describedby={showError ? 'topic-error' : undefined}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
        />
        <button type="submit" disabled={isGenerating} className="btn-primary justify-center py-2.5">
          <Sparkles className="h-4 w-4" />
          {isGenerating ? 'Generating…' : 'Generate course'}
        </button>
      </div>
      {showError && (
        <p id="topic-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
          Please enter a topic of at least {MIN_LENGTH} characters.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <fieldset className="flex items-center gap-2" disabled={isGenerating}>
          <legend className="sr-only">Difficulty</legend>
          <span className="text-sm text-slate-500 dark:text-slate-400" aria-hidden="true">
            Level:
          </span>
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
            {DIFFICULTIES.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md px-3 py-1 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 ${
                  difficulty === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={option.value}
                  checked={difficulty === option.value}
                  onChange={() => setDifficulty(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2 text-sm">
          {EXAMPLE_TOPICS.map((example) => (
            <button
              key={example}
              type="button"
              disabled={isGenerating}
              onClick={() => {
                setTopic(example);
                setTouched(false);
              }}
              className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 transition-colors hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
