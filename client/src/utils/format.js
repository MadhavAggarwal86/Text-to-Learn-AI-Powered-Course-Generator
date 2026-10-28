export const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const DIFFICULTY_BADGE = {
  beginner: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  advanced: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};

export const difficultyBadgeClass = (difficulty) =>
  DIFFICULTY_BADGE[difficulty] ?? DIFFICULTY_BADGE.beginner;

export const capitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1);

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const pluralize = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
