// How chord diagrams are drawn (shell.display_preferences): the React context
// ThemeRoot provides from the `diagramHanded` / `diagramOrientation` registers
// and every ChordDiagram reads, so all callers follow the choice with no prop
// threaded through them (workflow 16 §How diagrams are drawn). The default is
// the defaults, so a diagram rendered outside a ThemeRoot draws right-handed
// and vertical.

import { createContext } from 'react';
import { DEFAULT_HAND, DEFAULT_ORIENTATION } from './resolve.js';

export const DiagramDisplayContext = createContext(
  Object.freeze({ handed: DEFAULT_HAND, orientation: DEFAULT_ORIENTATION }),
);
