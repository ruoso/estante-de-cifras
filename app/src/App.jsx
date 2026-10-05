import { Button } from 'react-aria-components';
import './theme/theme.css';
import ThemeRoot from './theme/ThemeRoot.jsx';
import { getAppStore } from './worker/store.js';

// The first, deliberately minimal screen: a proof that React 19, the React
// Compiler, React Aria Components and the visual language all render together.
// The root is `ThemeRoot`, which carries the resolved `est theme-<applied>
// density-comfortable` class (shell.tokens) — the visual-language root this
// screen used to hard-code as `theme-current`. Real screens, styles and
// translated copy are the feature streams (the shell onwards); this is a
// placeholder with purpose-written text — no song, no copyrighted words
// (standing rule).
export default function App({ store = getAppStore() }) {
  return (
    <ThemeRoot store={store}>
      <main>
        <h1>Estante de Cifras</h1>
        {/* Status is carried by a word, never colour alone
            (docs/mockups/README.md line 27). */}
        <p role="status">Pronto para começar</p>
        <Button>Explorar o acervo</Button>
      </main>
    </ThemeRoot>
  );
}
