// FingeringGroups — the shared ranked-and-grouped list (music.explorer;
// design.explorer's one component for the explorer AND the in-song picker, so
// *explore a chord* and *choose a shape in a song* can never rank or group
// differently). It renders the view-model `fingering-groups.js` built over a
// `searchFingerings` result: one position group after another, each shape a
// `ChordDiagram` with its difficulty word and a per-shape action slot — the star
// here, the variation choice in the picker. It never re-sorts, re-groups or
// re-buckets; that is the carried core's own already-tested logic.
//
// Accessibility: each group's shapes are a `role="group"` (a selectable row of
// buttons, not a role="list" of buttons — [[role-list-of-rac-buttons-fails-axe]]);
// *show more* is a Button carrying `aria-expanded`; the difficulty is a word, the
// starred state a word plus the drawing, never colour alone.

import { useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';

export default function FingeringGroups({ groups, context, renderAction }) {
  // Which groups are expanded past the six-per-group display cap. Display-only —
  // expanding never changes the search (workflow 16 L65-67).
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (position) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });

  return (
    <div className="fingering-groups">
      {groups.map((group) => {
        const isExpanded = expanded.has(group.position);
        const shown = isExpanded ? group.shapes : group.shapes.slice(0, group.cap);
        return (
          <section className="fg-group" key={group.position}>
            <div className="section-label">
              <span className="t-h3">{group.label}</span>
              <span className="t-small">{t('explorer.group.count', { count: group.count })}</span>
            </div>
            <div className="shapes" role="group" aria-label={group.label}>
              {shown.map(({ fingering, starred }) => (
                <div className="fg-shape" key={fingering.shorthand}>
                  <ChordDiagram
                    fingering={fingering}
                    context={context}
                    kind={starred ? 'yours' : 'default'}
                  />
                  <div className="fg-shape-actions">
                    <span className="badge">{t(`difficulty.${fingering.difficulty}`)}</span>
                    {renderAction ? renderAction({ fingering, starred }) : null}
                  </div>
                </div>
              ))}
            </div>
            {group.hiddenCount > 0 ? (
              <Button
                className="btn quiet fg-more"
                aria-expanded={isExpanded}
                onPress={() => toggle(group.position)}
              >
                {isExpanded
                  ? t('explorer.showFewer')
                  : t('explorer.showMore', { count: group.hiddenCount })}
              </Button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
