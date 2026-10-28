import { Download, FileText, Headphones, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAudioTranscript, useLessonAudio } from '../hooks/queries.js';
import { getErrorMessage } from '../utils/api.js';
import { pdfFileName } from '../utils/pdf/paginate.js';
import ErrorMessage from './common/ErrorMessage.jsx';

/** Seconds since `running` became true (a reassuring counter during a ~30 s wait). */
function useElapsedSeconds(running) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [running]);
  return seconds;
}

/**
 * "Explain in Hinglish": a spoken Hinglish explanation of the lesson. The server writes a
 * Hinglish script with Gemini and turns it into speech (~30 s the first time, then stored).
 * Renders a button; once requested, a full-width panel with the player follows it.
 */
export default function AudioExplainer({ lesson }) {
  const [requested, setRequested] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const audio = useLessonAudio(lesson.id, requested);
  const transcript = useAudioTranscript(lesson.id, showTranscript && Boolean(audio.data));
  const loading = audio.isFetching && !audio.data;
  const elapsed = useElapsedSeconds(loading);

  // Already fetched earlier this session: show the player straight away.
  const open = requested || Boolean(audio.data);
  const fileName = pdfFileName(lesson.title).replace(/\.pdf$/, '-hinglish.wav');

  return (
    <>
      {!audio.data && (
        <button
          type="button"
          onClick={() => (audio.isError ? audio.refetch() : setRequested(true))}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
          {loading ? 'Preparing audio…' : 'Explain in Hinglish'}
        </button>
      )}

      {open && (
        <section
          className="card basis-full p-4"
          aria-label="Hinglish audio explanation"
          aria-busy={loading}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Headphones className="h-4 w-4 text-indigo-500" />
            Hinglish audio explanation
          </p>

          {loading && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400" role="status">
              Writing and recording a Hinglish explanation… {elapsed}s
              <span className="block text-xs text-slate-500">
                The first time takes about 30 seconds; after that it plays instantly.
              </span>
            </p>
          )}

          {audio.isError && (
            <div className="mt-3">
              <ErrorMessage
                message={getErrorMessage(audio.error)}
                onRetry={() => audio.refetch()}
              />
            </div>
          )}

          {audio.data && (
            <>
              <audio
                controls
                autoPlay={requested}
                src={audio.data}
                className="mt-3 w-full"
                aria-label={`Hinglish explanation of ${lesson.title}`}
              />
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <a
                  href={audio.data}
                  download={fileName}
                  className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <Download className="h-4 w-4" />
                  Download audio
                </a>
                <button
                  type="button"
                  onClick={() => setShowTranscript((shown) => !shown)}
                  aria-expanded={showTranscript}
                  className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <FileText className="h-4 w-4" />
                  {showTranscript ? 'Hide transcript' : 'Show transcript'}
                </button>
              </div>
              {showTranscript && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  {transcript.isPending && 'Loading transcript…'}
                  {transcript.isError && "Couldn't load the transcript."}
                  {transcript.data?.script}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
