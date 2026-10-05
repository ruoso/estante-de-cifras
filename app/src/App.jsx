import { Button } from 'react-aria-components';

// The first, deliberately minimal screen: a proof that React 19, the React
// Compiler, React Aria Components and the visual-language root all render
// together. Real screens, styles and translated copy are the feature streams
// (the shell onwards); this is a placeholder with purpose-written text — no
// song, no copyrighted words (standing rule).
export default function App() {
  return (
    <div className="est theme-current">
      <main>
        <h1>Estante de Cifras</h1>
        {/* Status is carried by a word, never colour alone
            (docs/mockups/README.md line 27). */}
        <p role="status">Pronto para começar</p>
        <Button>Explorar o acervo</Button>
      </main>
    </div>
  );
}
