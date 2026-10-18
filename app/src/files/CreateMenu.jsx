// The file view's *New* menu (books.file_view_create_menu; workflow 14 §What
// can be done to a file; W14 #1 L58-63): one trigger on the tree's top bar — an
// icon `+` named *New* on a phone, a text button with the `+` on wider screens —
// opening the four kinds a book may hold, each with the board's line under it.
// README.md is offered only when the book has none; otherwise the item stays,
// disabled, reading *README.md already exists*, so it is announced, not just
// greyed (Constraint 7). The host decides what each choice does.

import { Button, Menu, MenuItem, MenuTrigger, Popover, Text } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { PlusIcon } from './icons.jsx';

const LINES = {
  song: { label: 'fileView.createSong', meta: 'fileView.createSongMeta', mono: true },
  setlist: { label: 'fileView.createSetlist', meta: 'fileView.createSetlistMeta', mono: true },
  folder: { label: 'fileView.createFolder', meta: 'fileView.createFolderMeta', mono: false },
};

export default function CreateMenu({ mode, choices, onAction }) {
  const disabledKeys = choices.filter((c) => !c.enabled).map((c) => c.id);
  return (
    <MenuTrigger>
      {mode === 'wide' ? (
        <Button className="btn">
          <PlusIcon />
          {t('fileView.new')}
        </Button>
      ) : (
        <Button className="btn icon" aria-label={t('fileView.new')}>
          <PlusIcon />
        </Button>
      )}
      <Popover className="card file-create-menu" placement="bottom end">
        <Menu aria-label={t('fileView.new')} disabledKeys={disabledKeys} onAction={(key) => onAction(String(key))}>
          {choices.map(({ id, enabled }) => {
            if (id === 'readme') {
              const label = enabled ? t('fileView.createReadme') : t('fileView.readmeExists');
              return (
                <MenuItem key={id} id={id} className="row file-create-item" textValue={label}>
                  <span className={enabled ? 'name t-mono' : 't-small'}>{label}</span>
                </MenuItem>
              );
            }
            const line = LINES[id];
            const label = t(line.label);
            return (
              <MenuItem key={id} id={id} className="row file-create-item" textValue={label}>
                <span className="grow">
                  <Text slot="label" className="name">
                    {label}
                  </Text>
                  <Text slot="description" className={line.mono ? 'meta t-mono' : 'meta'}>
                    {t(line.meta)}
                  </Text>
                </span>
              </MenuItem>
            );
          })}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
