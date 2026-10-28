import { ExternalLink, PlayCircle } from 'lucide-react';

export const youtubeSearchUrl = (query) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// Phase 5 stub: shows the AI's search query with a link to YouTube results.
// Phase 7 embeds the top matching video (via the backend YouTube API) and keeps this
// link as the fallback when no video is found.
export default function VideoBlock({ query }) {
  return (
    <aside className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
        <PlayCircle className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Recommended video
        </p>
        <p className="mt-0.5 font-medium">{query}</p>
      </div>
      <a
        href={youtubeSearchUrl(query)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary justify-center"
      >
        Watch on YouTube
        <ExternalLink className="h-4 w-4" />
      </a>
    </aside>
  );
}
