// MyShapes — reviewing and removing an instrument's saved shapes
// (music.instruments, workflow 15 §Reviewing my shapes; workflow 16 L203-205).
// The shapes saved for this instrument (`shapes.json[id]`), grouped by tuning,
// each drawn as a `ChordDiagram kind="yours"` labelled *your shape* and each
// removable. Adding a shape stays the explorer's one-at-a-time starring
// (music.explorer) — this is review and removal only. A removed shape tombstones
// its leaf register (the Worker does the write; this view sends REMOVE_SHAPE).

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import ChordDiagram from '../diagram/ChordDiagram.jsx';
import { TrashIcon } from './icons.jsx';
import { buildShape, shapesByTuning } from './instrument-helpers.js';

export default function MyShapes({ entry, onRemoveShape }) {
  const groups = shapesByTuning(entry.shapes);

  if (!groups.length) {
    return (
      <p className="t-small" role="status">
        {t('instr.shapes.empty')}
      </p>
    );
  }

  return (
    <div className="instr-shapes">
      {groups.map(({ tuning, shapes }) => (
        <section className="instr-shapes-group" key={tuning}>
          <div className="section-label">
            <span className="t-h3">{t('instr.shapes.heading', { tuning })}</span>
            <span className="t-small">{t('instr.shapes.saved', { count: shapes.length })}</span>
          </div>
          <div className="shapes">
            {shapes.map((shape) => {
              const drawn = buildShape(entry, shape);
              if (!drawn) return null;
              return (
                <div className="instr-shape" key={`${shape.chord}\u0000${shape.shorthand}`}>
                  <ChordDiagram fingering={drawn.fingering} context={drawn.context} kind="yours" />
                  <Button
                    className="btn icon"
                    aria-label={t('instr.shapes.remove', {
                      chord: shape.chord,
                      shorthand: shape.shorthand,
                    })}
                    onPress={() => onRemoveShape(entry.id, shape.tuning, shape.chord)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="t-small">{t('instr.shapes.footer')}</p>
    </div>
  );
}
