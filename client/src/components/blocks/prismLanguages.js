// Imported in this order on purpose: prismSetup.js must run before the language files.
import './prismSetup.js';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';

import { Prism } from 'prism-react-renderer';

// Names models commonly use for a language, mapped to Prism's ids.
const ALIASES = {
  html: 'markup',
  xml: 'markup',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  'c#': 'csharp',
  cs: 'csharp',
  'c++': 'cpp',
  golang: 'go',
  yml: 'yaml',
  node: 'javascript',
  nodejs: 'javascript',
};

/** The Prism language id for a code block, or 'plaintext' if Prism can't highlight it. */
export function resolveLanguage(language = '') {
  const key = language.trim().toLowerCase();
  const id = ALIASES[key] ?? key;
  return Prism.languages[id] ? id : 'plaintext';
}
