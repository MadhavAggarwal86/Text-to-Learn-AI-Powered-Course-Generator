import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { lessonStatus } from '../utils/courseNav.js';

const ICONS = {
  completed: { Icon: CheckCircle2, className: 'text-emerald-500', label: 'Completed' },
  opened: { Icon: CircleDot, className: 'text-indigo-500', label: 'Opened' },
  new: { Icon: Circle, className: 'opacity-40', label: 'Not opened yet' },
};

/** A lesson's progress as an icon: completed, opened, or not opened yet. */
export default function LessonStatusIcon({ lesson, className = 'h-4 w-4' }) {
  const { Icon, className: color, label } = ICONS[lessonStatus(lesson)];
  return <Icon className={`${className} shrink-0 ${color}`} aria-label={label} role="img" />;
}
