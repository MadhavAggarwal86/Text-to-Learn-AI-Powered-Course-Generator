import { Check, Copy } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { useEffect, useState } from 'react';
import { resolveLanguage } from './prismLanguages.js';

const COPIED_MS = 2000;

/** Syntax-highlighted code with the language name and a copy button. Always dark. */
export default function CodeBlock({ language, text, showCopy = true }) {
  const prismLanguage = resolveLanguage(language);
  const code = text.replace(/\n+$/, '');

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-800 bg-[#282c34] shadow-sm">
      <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
        <span className="font-mono">{language || 'code'}</span>
        {showCopy && <CopyButton text={code} />}
      </figcaption>
      <Highlight code={code} language={prismLanguage} theme={themes.oneDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto p-4 text-sm leading-6`}
            style={{ ...style, background: 'transparent' }}
          >
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, j) => (
                    <span key={j} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
}

function CopyButton({ text }) {
  const [status, setStatus] = useState('idle'); // idle | copied | failed

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      // Clipboard access needs a secure context and permission.
      setStatus('failed');
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/10 hover:text-slate-200"
      aria-label="Copy code"
    >
      {status === 'copied' ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span aria-live="polite">
        {status === 'copied' ? 'Copied!' : status === 'failed' ? 'Copy failed' : 'Copy'}
      </span>
    </button>
  );
}
