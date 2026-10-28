import { Prism } from 'prism-react-renderer';

// prism-react-renderer bundles the common languages (JS/TS/JSX, Python, SQL, CSS, HTML,
// C/C++, Go, Rust, JSON, YAML...). Extra Prism language files register themselves on a
// global `Prism`, so expose ours before prismLanguages.js imports them.
globalThis.Prism = Prism;
