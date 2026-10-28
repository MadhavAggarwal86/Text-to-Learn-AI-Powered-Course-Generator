import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useSetCourseShared } from '../hooks/queries.js';
import { getErrorMessage } from '../utils/api.js';
import { sharedCoursePath } from '../utils/courseNav.js';

const COPIED_MS = 2000;

/**
 * "Share": creates a read-only public link to the course. While shared, a panel shows the
 * link with copy and "stop sharing" (which makes the old link stop working).
 */
export default function ShareCourse({ course }) {
  const share = useSetCourseShared(course.id);
  const [copied, setCopied] = useState(false);
  const url = course.shareId
    ? `${window.location.origin}${sharedCoursePath(course.shareId)}`
    : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard blocked: the link is still selectable in the field.
    }
  }

  function stopSharing() {
    if (window.confirm('Stop sharing? The current link will stop working.')) {
      share.mutate(false);
    }
  }

  if (!url) {
    return (
      <>
        <button
          type="button"
          onClick={() => share.mutate(true)}
          disabled={share.isPending}
          className="btn-secondary"
        >
          <Share2 className="h-4 w-4" />
          {share.isPending ? 'Creating link…' : 'Share'}
        </button>
        {share.isError && (
          <span className="self-center text-sm text-red-600 dark:text-red-400">
            {getErrorMessage(share.error)}
          </span>
        )}
      </>
    );
  }

  return (
    <section className="card basis-full p-4" aria-label="Share this course">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="h-4 w-4 text-indigo-500" />
        Anyone with this link can view the course (read-only)
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Visitors see the lessons you have opened, without your progress. They don&apos;t need an
        account.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Share link"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button type="button" onClick={copy} className="btn-primary justify-center">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={stopSharing}
          disabled={share.isPending}
          className="btn-secondary justify-center hover:text-red-600"
        >
          Stop sharing
        </button>
      </div>
      {share.isError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {getErrorMessage(share.error)}
        </p>
      )}
    </section>
  );
}
