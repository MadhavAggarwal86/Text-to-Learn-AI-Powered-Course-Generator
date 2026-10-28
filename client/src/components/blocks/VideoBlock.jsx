import { ExternalLink, Play, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { useVideos } from '../../hooks/queries.js';

export const youtubeSearchUrl = (query) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// Privacy-enhanced embed domain: YouTube sets no tracking cookies until the video plays.
const embedUrl = (videoId) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;

/**
 * The lesson's video. The server searches YouTube with the AI's query (cached); the top
 * result is shown as a thumbnail and the real player only loads when clicked, which keeps
 * lessons fast (each player is ~1 MB) and avoids loading YouTube until the learner wants it.
 * Without results (no API key, quota used up, nothing found) it falls back to a search link.
 */
export default function VideoBlock({ query }) {
  const { data: videos, isPending, isError } = useVideos(query);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);

  if (isPending) {
    return (
      <div className="card overflow-hidden" aria-busy="true" aria-label="Loading video">
        <div className="aspect-video animate-pulse bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-2 p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (isError || !videos?.length) return <VideoSearchLink query={query} />;

  const video = videos[Math.min(selected, videos.length - 1)];

  function choose(index) {
    setSelected(index);
    setPlaying(false);
  }

  return (
    <figure className="card overflow-hidden">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            src={embedUrl(video.videoId)}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label={`Play video: ${video.title}`}
          >
            {video.thumbnail && (
              <img
                src={video.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
                <Play className="ml-1 h-7 w-7 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>

      <figcaption className="p-4">
        <p className="font-medium leading-snug">{video.title}</p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{video.channelTitle}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {videos.length > 1 &&
            videos.map((option, index) => (
              <button
                key={option.videoId}
                type="button"
                onClick={() => choose(index)}
                aria-pressed={option === video}
                title={option.title}
                className={`rounded-full px-3 py-1 transition-colors ${
                  option === video
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Video {index + 1}
              </button>
            ))}
          <a
            href={youtubeSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            More on YouTube
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </figcaption>
    </figure>
  );
}

/** Fallback when no video can be embedded: the AI's query with a YouTube search link. */
function VideoSearchLink({ query }) {
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
