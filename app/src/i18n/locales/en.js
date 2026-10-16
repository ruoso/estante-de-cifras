/**
 * English — the source language. Every other language is checked against the
 * keys here; a key missing elsewhere falls back to this text.
 *
 * Plurals are written as `{ one, other }` and chosen by `count`.
 */
export default {
  app: { name: 'Estante de Cifras', wordmark: 'Estante' },

  ordinal: { one: '{n}st', two: '{n}nd', few: '{n}rd', other: '{n}th' },

  locale: { label: 'Language' },

  header: {
    help: 'Help',
    helpLabel: 'Help and what changed',
  },

  shell: {
    nav: 'Destinations',
    search: 'Search',
    books: 'Books',
    setlists: 'Setlists',
  },

  // The book-management screen (books.shelf, workflow 7). `{name}` is a book's
  // title; `{count}` the number of saves waiting to sync.
  books: {
    add: 'Add a book',
    addTitle: 'Add a book',
    close: 'Close',
    nameLabel: 'Book name',
    namePlaceholder: 'Name this book',
    newBookHelp: 'A name, and an empty book. No account needed.',
    create: 'New book',
    // Add-a-book: By link (books.add_by_link; W07 L83-86) — paste a book's
    // invitation link to open it.
    byLink: 'By link',
    byLinkMeta: 'Paste a link to a book on Estante.',
    byLinkLabel: 'Book link',
    byLinkPlaceholder: 'https://…/i/…',
    byLinkOpen: 'Open',
    byLinkInvalid: 'That is not a book link.',
    // Add-a-book: Mine on Estante (books.add_by_link; W07 L87-95) — the account's
    // books not on this shelf yet.
    mineOnEstante: 'Mine on Estante',
    mineMeta: 'Your books that are not on this shelf yet.',
    mineSignedOut: 'Sign in to see them.',
    mineSignIn: 'Sign in',
    mineAdd: 'Add',
    mineAddLabel: 'Add {name}',
    mineLeave: 'Leave',
    mineLeaveLabel: 'Leave {name}',
    mineEmpty: 'All your books are already on this shelf.',
    mineError: 'We couldn’t reach Estante. Try again.',
    // Add-a-book: Upload (books.upload_ui; W07 L96-99) — a zip of a book, read as
    // a remote and previewed before anything is written (workflow 7 §Uploading a
    // book, §A preview comes first; W07 tablet). `{name}` is the file name,
    // `{branch}` the zip's branch, `{line}` a marker line, `{commit}`/`{path}` the
    // marked commit and file.
    uploadRow: 'Upload',
    uploadRowMeta: 'A zip of a book, with or without its history.',
    uploadChoose: 'Choose a zip',
    uploadTitle: 'Upload {name}',
    uploadCancelSurface: 'Cancel the upload',
    uploadWhatToDo: 'What to do with it',
    uploadWhatToDoLabel: 'What to do with the upload',
    uploadAsNew: 'Import as a new book',
    uploadMerge: 'Merge into an existing book',
    uploadMergeInto: 'Merge into',
    uploadNoTargets: 'No books you can save to yet. Import as a new book instead.',
    uploadBranch:
      'From the zip’s branch {branch}. Edits in the zip that were never saved are read as one more save: changes from the upload, by you.',
    uploadSongs: 'Song by song',
    uploadAdded: 'added',
    uploadChanged: 'changed',
    uploadConflict: 'conflict',
    uploadReplace: 'replace',
    uploadUnresolved: 'unresolved',
    uploadUnresolvedHelp: 'unresolved merge: fix it before importing',
    uploadMarkerLine: 'first marker on line {line}',
    uploadKeep: 'Replace “{name}” with the uploaded version',
    uploadLeftOutTitle: 'Left out',
    uploadLeftOutBody:
      'A book holds songs, setlists, a README and .gitattributes, so these stay behind.',
    uploadCanonTitle: 'Put in canonical form',
    uploadCanonBody: 'The voicings are put in canonical order; the chart is left as written.',
    uploadMarkersTitle: 'An unfinished merge in the history',
    uploadMarkersBody:
      'Commit {commit} left conflict markers in {path}. Fix it on the computer and upload again.',
    uploadMarkersLatest: 'Import the latest version without its history',
    uploadConfirmCaption: 'Nothing is written until you confirm.',
    uploadConflictCaption: 'The conflict goes to resolution.',
    uploadConfirmNew: 'Import as a new book',
    uploadConfirmMerge: 'Merge and save',
    uploadBadZip: 'That file could not be read as a book zip.',
    uploadFailed: 'The import could not be completed. Nothing was written.',
    cancel: 'Cancel',
    save: 'Save',
    onDevice: 'On this device',
    onEstante: 'On Estante',
    canSave: 'can save',
    reader: 'reader',
    renameLabel: 'Rename {name}',
    renameTitle: 'Rename “{name}”',
    renameField: 'Name on your shelf',
    empty: 'No books yet. Add a book to start.',
    syncing: 'syncing',
    savesWaiting: {
      one: '{count} save waiting to go up',
      other: '{count} saves waiting to go up',
    },
    needsYou: 'needs you',
    offline: 'offline since {time}',
    offlineUnknown: 'offline',
    noLongerShared: 'no longer shared with you',
    // books.fork (workflow 11): the shelf's fork lines and the cannot-save word —
    // each state carried by a word, never colour alone.
    cannotSaveHere: 'can’t save here',
    fromOriginal: 'from {original}',
    originalNewSaves: {
      one: '{original} has {count} new save.',
      other: '{original} has {count} new saves.',
    },
    originalNoLongerShared: 'original no longer shared',
    // books.bring_in (workflow 11 §Following the original; W11 board #2-#4):
    // the shelf's button, the bring-in screen and the gone card. Copy names the
    // original book, not its owner (books.fork Decision 4).
    bringIn: 'Bring them in',
    bringInLabel: 'Bring them in from {original}',
    bringInTitle: 'Bring in saves from {original}',
    bringInBody: {
      one: '{count} new save in {original} since you last brought them in. Nothing is written to {book} until you confirm.',
      other: '{count} new saves in {original} since you last brought them in. Nothing is written to {book} until you confirm.',
    },
    bringInFetching: 'Fetching the new saves from {original}…',
    bringInNote: 'Note',
    bringInNotePrefill: 'Bring in changes from {original}: {titles}',
    bringInNotePrefillEmpty: 'Bring in changes from {original}',
    bringInConflict: {
      one: '{songs} meets your own edits. After confirming you’ll settle it one conflict at a time; the rest comes in at once.',
      other: '{songs} meet your own edits. After confirming you’ll settle them one conflict at a time; the rest comes in at once.',
    },
    bringInCaption: 'Merges into your copy, saves, and sends it to Estante.',
    bringInNotNow: 'Not now',
    bringInBusy: 'Bringing them in…',
    bringInStale: 'Something changed since this preview, so it was made again. Check it, then bring them in.',
    bringInOffline: 'Bringing them in needs the network. Nothing changed: connect, then try again.',
    originalGoneTitle: 'The original is no longer shared with you.',
    originalGoneBody:
      'This book stops following {original}; it was last brought in on {date}. Nothing else changes: your copy, its history and its songs are all here, and you save, share and sync it as before.',
    originalGoneBodyUndated:
      'This book stops following {original}. Nothing else changes: your copy, its history and its songs are all here, and you save, share and sync it as before.',
    forkedNote:
      '{book} is your own now: it took the place of the original on your shelf, so every song shows once in search.',
    syncNow: 'Sync now',
    notInStep: 'Some books are not in step',
    // The shelf filling on a new device (account.new_device, workflow 13 §What
    // comes down; W13 board frame 2). Each state is a word, never colour alone.
    restoredTitle: 'Home book restored.',
    restoredBody: 'Your instrument, notation and language are set.',
    restoredDismiss: 'Dismiss',
    restoredDismissLabel: 'Dismiss the home book notice',
    yourShelf: 'Your shelf',
    yourShelfCount: { one: '{count} book', other: '{count} books' },
    fillReady: 'ready',
    fillCloning: 'cloning {percent}%',
    fillWaiting: 'waiting',
    fillReadyMeta: { one: '{count} song · searchable', other: '{count} songs · searchable' },
    fillCloningMeta: 'songs searchable as they arrive',
    fillWaitingMeta: 'next in line',
    fillProgressLabel: 'Bringing {name} to this device',
    onlyOn: 'Only on your {device}: {title}',
    onlyOnOther: 'Only on another device: {title}',
    onlyOnHelp: 'Put it online there to have it here.',
    // The per-book detail (books.online, workflow 7 L46-63, L128-137; W07 board).
    detailBack: 'Back to books',
    pickBook: 'Pick a book to see its details.',
    private: 'private',
    sharedBy: 'shared by {owner}',
    shared: 'shared',
    youOwn: 'You own it',
    youCanSave: 'You can save',
    readOnly: 'Read only',
    putOnline: 'Put online',
    putOnlineBody:
      'Only on this device. Putting it online creates it on Estante, private: only you can open it, until you invite people to it, at most 50.',
    putOnlineQuota: 'Your account is full. Remove a book or free space, then try again.',
    putOnlineSignedOut: 'Sign in to put a book online.',
    putOnlineOffline: 'You’re offline. Connect, then put it online.',
    putOnlineError: 'Couldn’t put it online. Try again.',
    // The losing-access notice on a `gone` book (sync.lost_access, workflow 8
    // §Losing access; the W11 board surface, minus the "stops following"
    // language). The state is the word, never colour alone.
    lostAccessTitle: 'No longer shared with you',
    lostAccessBody:
      'This book is no longer shared with you, so it will not sync again. Nothing is lost: your copy, its history and its songs are all here to read, and any saves not yet on Estante are kept on this device. Download it, or make it your own to keep saving.',
    // The take-down notice on a `taken_down` book (books.notice_surface, workflow
    // 10 §A copyright notice). The card title is localized; its body is the
    // operator's reason, rendered verbatim (the service frames it and it is
    // inherently unlocalizable — Decision 4), so there is no body key.
    takenDownTitle: 'This book has been taken down',
    download: 'Download',
    downloadBody:
      'A zip of the repository as it is on this device: the whole history, and unsaved changes as modified files. Any git tool opens it.',
    remove: 'Remove from my shelf',
    removeBody: 'Deletes this device’s copy only. The book stays on Estante.',
    removeTitle: 'Remove “{name}” from this device?',
    removeLoss: {
      one: 'This device has {count} save not yet on Estante; removing this copy loses it. The book stays on Estante.',
      other:
        'This device has {count} saves not yet on Estante; removing this copy loses them. The book stays on Estante.',
    },
    removeUnsaved: {
      one: '{count} song with unsaved changes will be lost',
      other: '{count} songs with unsaved changes will be lost',
    },
    removeGone:
      'This book is only on this device. Removing it deletes it for good — there is no copy on Estante. Download it first to keep a copy.',
    removeConfirm: 'Remove from my shelf',
    delete: 'Delete the book',
    deleteBody: 'Deletes it from Estante, for everyone. Only its owner can.',
    deleteTitle: 'Delete {name} from Estante?',
    deleteModalBody:
      'This deletes the book, with its whole history, for everyone who shares it. It cannot be undone.',
    deleteField: 'Type the book’s name to confirm',
    deleteConfirm: 'Delete the book',
    // Leaving one shared book (books.leave; workflow 10 §Leaving a book; Leave-book board).
    leave: 'Leave this book',
    leaveBody: 'Stop following it on all your devices.',
    leaveOffline: 'Leaving needs a connection.',
    leaveOfflineBody: 'Nothing has changed; you are still a member.',
    leaveTitle: 'Leave {name}?',
    leaveSentence: 'You will no longer open or sync it, on any of your devices, and it is removed from this one. The owner can invite you again.',
    leaveSentenceRemote: 'You will no longer open or sync it, on any of your devices. The owner can invite you again.',
    leaveSentenceNamed: 'You will no longer open or sync it, on any of your devices, and it is removed from this one. {owner} can invite you again.',
    leaveSentenceRemoteNamed: 'You will no longer open or sync it, on any of your devices. {owner} can invite you again.',
    leaveUnsaved: {
      one: '{count} song with unsaved changes will be lost',
      other: '{count} songs with unsaved changes will be lost',
    },
    leaveUnpushed: {
      one: '{count} save has not reached the book and never will',
      other: '{count} saves have not reached the book and never will',
    },
    leaveUnpushedHelp: 'Make it your own to keep them as a book of yours, with its history; or download the book as it is on this device.',
    leaveForkFirst: 'Make it my own first',
    leaveDownloadFirst: 'Download first',
    leaveConfirm: 'Leave the book',
    leaveFailed: 'You did not leave {name}. You are still a member.',
    // The owner-only Share card on the per-book detail (books.share, workflow 10).
    share: 'Share',
    shareBody: 'Invite people to read or edit this book — up to fifty.',
    // The book detail's fork cards (books.fork, workflow 11; W11 board :189-196).
    cannotSaveTitle: 'Can’t save here',
    cannotSaveBody: {
      one: '{count} save can no longer go to {book}: you can read it, but no longer save to it.',
      other: '{count} saves can no longer go to {book}: you can read it, but no longer save to it.',
    },
    fork: 'Fork',
    forkBody: 'Your own copy of {book}, with its history, that keeps following it.',
  },

  // The sharing surface (books.share, workflow 10; board W10): the owner's view
  // and controls for sharing a hosted book, and the roster a plain member sees.
  // Role and state are each carried by a word, never colour alone.
  sharing: {
    shareTitle: 'Share {name}',
    close: 'Close',
    intro: 'Only people you invite can open this book, each with their own account.',
    memberIntro:
      'Shared with you by its owner. To change it, make it your own. Only the owner invites people; other readers aren’t listed.',
    loading: 'Loading…',
    retry: 'Try again',
    people: 'People',
    countOfLimit: '{count} of {limit}',
    roomForMore: {
      one: 'Room for {count} more.',
      other: 'Room for {count} more.',
    },
    full: '{name} is full. Invitations no longer admit anyone; remove someone to make room.',
    members: 'Members',
    invitations: 'Invitations',
    you: 'You',
    ownerMeta: 'owns this book',
    editorMeta: 'saves to this book',
    readerMeta: 'reads this book',
    roleOwner: 'Owner',
    roleEditor: 'Editor',
    roleReader: 'Reader',
    changeRole: 'Change {name}’s role',
    makeEditor: 'Make editor',
    makeReader: 'Make reader',
    remove: 'Remove',
    removeTitle: 'Remove {name}?',
    removeBody:
      'Removing takes effect the next time their app reaches Estante; the other members are not affected. What is already on their device stays there and cannot be recalled.',
    removeField: 'Type {name} to confirm',
    removeConfirm: 'Remove {name}',
    cancel: 'Cancel',
    invitePeople: 'Invite people',
    songInvite: 'Invite someone to this song',
    inviteIntro:
      'One link, for as many people as you send it to. Each signs in, or makes an account, and the book goes on their shelf.',
    songInviteBody: 'The invitation brings them into {book}, and opens on this song once they’ve signed in.',
    role: 'Role',
    roleHelp: 'Readers read the book and keep it on their shelf. Editors also save to it.',
    expires: 'Expires',
    expiryDay: 'A day',
    expiryWeek: 'A week',
    expiryMonth: 'A month',
    expiryUntilWithdrawn: 'Until withdrawn',
    limitToggle: 'Limit how many can use it',
    limitHelp: 'Optional. Set it to 1 for one person.',
    limitField: 'Number of uses',
    createLink: 'Create link',
    linkReady: 'Here is the link. Copy it now — it won’t be shown again.',
    linkLabel: 'Invitation link',
    copy: 'Copy',
    copied: 'Copied',
    done: 'Done',
    inviteRowTitle: '{role} invitation',
    stateOpen: 'open',
    stateWithdrawn: 'withdrawn',
    stateUsedUp: 'used up',
    termsDay: 'Expires in a day',
    termsWeek: 'Expires in a week',
    termsMonth: 'Expires in a month',
    termsUntilWithdrawn: 'Until withdrawn',
    usesNoLimit: 'no limit on uses',
    usesLeft: {
      one: '{count} use left',
      other: '{count} uses left',
    },
    withdraw: 'Withdraw',
    withdrawNote:
      'Withdrawing an invitation stops anyone new joining through it. Those who joined stay members.',
    joinedThrough: 'Joined through it:',
    joinedCount: {
      one: '{count} person',
      other: '{count} people',
    },
    joinedNobody: 'nobody yet',
    noInvitations: 'No invitations yet.',
    songForMembers: 'For people already in the book',
    songForMembersBody: 'Members open {name} at its address.',
    songAddressLabel: 'Song address',
    youAreEditor: 'You’re an editor',
    youAreReader: 'You’re a reader',
    errNetwork: 'You’re offline, or Estante is unreachable. Connect and try again.',
    errForbidden: 'Only the owner can do that.',
    errNotFound: 'This book isn’t available.',
    errGeneric: 'Something went wrong. Try again.',
  },

  // The search screen (songs.search, workflow 2). `{instrument}` falls back to
  // the generic noun `instrument` when no instrument-in-use is surfaced yet.
  search: {
    label: 'Search songs, words and chords',
    placeholder: 'Songs, words, chords…',
    clearQuery: 'Clear search',
    clearFilter: 'Clear filter',
    scopeToBook: 'Search only in {book}',
    instrument: 'instrument',
    explore: 'Explore {query} on your {instrument}',
    exploreMeta: 'every way to play it, easiest first',
    matching: 'Songs matching “{query}”',
    recent: 'Recent',
    books: 'Books',
    empty: 'No songs match “{query}”.',
    songCount: { one: '{count} song', other: '{count} songs' },
    stillLoading: 'still loading',
    voicedFor: 'voiced for {instrument}',
    unsaved: 'unsaved',
    conflict: 'conflict',
    where: '{book} · {folder}/',
    addToSetlist: 'Add {title} to a setlist',
    // The word that marks a setlist result in the one song search
    // (books.setlist_search, workflow 12 L33-34; mockups README L26 — status by
    // a word, never colour alone).
    setlist: 'Setlist',
  },

  // Setlists (books.setlists, workflow 12, board W12): the Setlists destination
  // list, the open/read view, the structured editor, the Add-to-setlist dialog
  // and the missing-item repoint panel.
  setlists: {
    // The Setlists destination.
    title: 'Setlists',
    empty: 'No setlists yet. Add a song to a setlist from search or the reading view.',
    loading: 'Loading setlists…',
    songCount: { one: '{count} song', other: '{count} songs' },
    // The open/read view.
    back: 'Back',
    play: 'Play',
    edit: 'Edit',
    more: 'More',
    done: 'Done',
    inKey: 'in {key}',
    missing: 'missing',
    missingNotice: '{title} is missing.',
    missingDetail: 'Nothing is at {path} any more, so it is skipped when playing.',
    pointItAtASong: 'Point it at a song',
    // The editor.
    addSong: 'Add song',
    save: 'Save',
    saveMessage: 'Edit setlist',
    discard: 'Discard',
    unsaved: 'unsaved changes',
    songsLabel: 'Songs · drag to reorder',
    keyNoteHint: 'Key and note apply in this setlist only',
    dragToReorder: 'Drag to reorder',
    removeFromSetlist: 'Remove {title} from setlist',
    keyLabel: 'Key for {title}',
    keyPlaceholder: 'Key',
    noteLabel: 'Note for {title}',
    notePlaceholder: 'Note',
    notInBook: '{path} is not in the book',
    // The missing-item repoint panel.
    pointHereTitle: 'Point it at a song in {book}',
    searchLabel: 'Search for a song',
    cancel: 'Cancel',
    pointHere: 'Point here',
    noResults: 'No songs found.',
    // The raw *.setlist.md side pane (wide, read-only).
    relativeNote: 'Links are relative to {folder}, so the file opens the songs on any git host.',
    // The Add-to-setlist dialog (from search and the reading view).
    addToSetlistTitle: 'Add to setlist',
    newSetlist: 'New setlist…',
    pickerMeta: '{book} · {count}',
    copyNotice: 'This song will be copied into {book} first.',
    copyDetail: '{title} is in {other}, and a setlist points only at songs in its own book.',
    copyThenUnsaved: 'The copy and the setlist change are then unsaved changes to {book}, saved like any other.',
    thenUnsaved: 'The setlist change is then an unsaved change to {book}, saved like any other.',
    add: 'Add',
    copyAndAdd: 'Copy and add',
    // The New-setlist dialog.
    newSetlistTitle: 'New setlist',
    newSetlistNameLabel: 'Setlist name',
    newSetlistNamePlaceholder: 'Setlist name',
    create: 'Create',
  },

  // The setlist player (books.play, workflow 12 §Playing through, §The key;
  // board W12): the chrome-free full-screen performance surface.
  play: {
    stop: 'Stop playing',
    previous: 'Previous song',
    next: 'Next song',
    position: '{i} of {n}',
    positionAwake: '{i} of {n} · screen kept awake',
    inKey: 'In {key}',
    setlistKey: 'Setlist key {key} · written in {songKey}',
    setlistKeyNote: 'Setlist key {key}',
    nextHeading: 'Next',
    nextItem: '{number}. {title}',
    note: 'Note: {note}',
    hint: 'Swipe, tap an edge, or use a pedal',
    announce: '{title}, {i} of {n}',
    announceNext: 'Next: {title}',
    empty: 'This setlist has no songs to play yet.',
  },

  // The chord explorer (music.explorer, workflow 16): reached from search's chord
  // row, every way to play a chord on the instrument in use, ranked and grouped,
  // each starrable as *your shape*.
  explorer: {
    title: 'Explore a chord',
    back: 'Back to search',
    chord: 'Chord',
    unreadable: '“{text}” is not a chord this app can read.',
    group: {
      open: 'Open',
      fret: 'Fret {position}',
      count: { one: '{count} shape', other: '{count} shapes' },
    },
    showMore: 'Show {count} more',
    showFewer: 'Show fewer',
    star: 'Star {chord}, {shorthand} as your shape',
    unstar: 'Your shape for {chord}, {shorthand} — unstar',
    notice: {
      readAs: 'Read as {chord} — {reading}.',
      flip: 'Read as {chord} instead?',
      about: {
        sevenPlus:
          'In Brazilian notation 7+ is the major seventh; in American and Real Book it is a sharp fifth.',
        bareNine:
          'In Brazilian notation a bare 9 adds the ninth with no seventh; in American and Real Book it includes the flat seventh.',
        degreeSign:
          'A bare ° reads as the diminished seventh; the plain triad is the other reading.',
        sevenFour:
          'In Brazilian notation 7(4) suspends the third; in American and Real Book it adds the fourth above it.',
      },
    },
    empty: {
      title: 'No shape fits the rules',
      body:
        '{chord} asks for more notes than {instrument} can sound under your voicing rules. The search did not relax the rules to force one.',
      rules: 'Voicing rules',
      hint: 'Allow omitted notes there, or try a simpler chord.',
    },
    enter: {
      name: 'Enter a shape',
      meta: 'place the fingers by hand, then star it',
      title: 'Enter a shape',
      help: 'Tap a fret to place a finger, tap it again to lift it. Tap the nut to open or mute the string.',
      nut: 'Open or mute string {n}',
      muteString: 'Mute string {n}',
      openString: 'Open string {n}',
      setFret: 'String {n}, fret {fret}',
      readout: 'What it sounds',
      muted: 'String {n}: muted',
      openNote: 'String {n}: open, {note}',
      frettedNote: 'String {n}: fret {fret}, {note}',
      foreign: 'not in the chord',
      unplayable: 'This shape can’t be played as entered, but it is kept as drawn.',
      star: 'Star this shape',
      cancel: 'Cancel',
    },
  },

  // A new device (account.new_device, workflow 13): how a device is named by its
  // kind, the notation in the restore notice, and the two-My-songs choice (W13
  // board frame 3).
  newDevice: {
    kind: {
      iphone: 'iPhone',
      ipad: 'iPad',
      'android-phone': 'Android phone',
      'android-tablet': 'Android tablet',
      mac: 'Mac',
      windows: 'Windows computer',
      linux: 'Linux computer',
      chromebook: 'Chromebook',
    },
    thisKind: {
      iphone: 'This iPhone',
      ipad: 'This iPad',
      'android-phone': 'This phone',
      'android-tablet': 'This tablet',
      mac: 'This Mac',
      windows: 'This computer',
      linux: 'This computer',
      chromebook: 'This Chromebook',
      other: 'This device',
    },
    notation: {
      brazilian: 'Brazilian notation',
      american: 'American notation',
      realbook: 'Real Book notation',
    },
    title: 'Your two My songs',
    later: 'Later',
    merged: '{device}’s preferences and shapes were merged into your account’s, setting by setting.',
    heading: '{device} has its own My songs',
    body: 'Your account has a My songs too. Bring the two together, or keep them apart.',
    merge: 'Merge',
    mergeBody: '{device}’s songs go into your account’s My songs. Preview first, song by song.',
    mergeWaiting: 'Your account’s My songs is still coming to this device.',
    keepBoth: 'Keep both',
    keepBothBody: 'This one stays on the shelf as My songs (this device).',
    keepBothTitle: 'My songs (this device)',
    previewTitle: 'What merging would do',
    previewNote: 'Nothing is written until you confirm',
    previewLoading: 'Reading this device’s My songs…',
    unrelated: 'The two share no history, so every song that is in both is shown as a conflict to choose between.',
    keepBothInstead: 'Keep both instead',
    mergeAndSave: 'Merge and save',
    failed: 'The merge could not be prepared. Nothing was written.',
  },

  // The first-run empty state on the search front door (account.first_run,
  // workflow 1 §Cold / §My songs; mockup W01). The four ways to fill an empty
  // shelf, in workflow-1 order, and the listed-from-the-start My songs entry.
  // `exampleLabel` is the localised shelf title the example book is seeded with
  // (Decision 5); the open/meta copy uses W01's phone form (Decision 6).
  firstRun: {
    heading: 'Your shelf is empty',
    body: 'A book is a collection of songs: yours, a teacher’s, your band’s. Search looks through every book on your shelf.',
    writeSong: 'Write a song',
    writeSongMeta: 'It goes into My songs',
    addByLink: 'Add a book by its link',
    addByLinkMeta: 'From a teacher or a bandmate',
    signIn: 'Sign in',
    signInMeta: 'Bring back your shelf from another device',
    openExample: 'Open the example book',
    openExampleMeta: 'Songs that come with the app, put on your shelf; remove it any time',
    mySongs: 'My songs',
    mySongsMeta: 'No songs yet · your own, on this device',
    exampleLabel: 'Example Book',
  },

  // The invited door into a shared book (books.add_by_link, workflow 1 §Invited;
  // mockup W01). Generic before sign-in — it names only "a book on Estante",
  // never the title or owner (Decision 1, the design delta), since a dead link
  // must tell its holder nothing. The dead/full copy is W01's; a status is always
  // a word, never colour alone.
  // shell.routing — an address for something not on this device (workflow 7
  // §Links to books). The book state names nothing about the book.
  notHere: {
    back: 'Back',
    brand: 'Estante',
    bookTitle: 'This link doesn’t open a book',
    bookBody:
      'It isn’t on this device. If you were invited, ask whoever sent it for a new invitation; if it’s yours on Estante, add it from Books.',
    goToBooks: 'Go to Books',
    songTitle: 'This song isn’t in {book}',
    setlistTitle: 'This setlist isn’t in {book}',
    itemBody: 'It may have been renamed, moved or deleted.',
    openBook: 'Open {book}’s songs',
  },
  invited: {
    brand: 'Estante',
    close: 'Close',
    working: 'Opening…',
    workingHeading: 'Opening the invitation',
    promptHeading: 'You’re invited to a book on Estante',
    promptBody:
      'To open it, sign in, or make an account first — no book can be read without one.',
    passkeyTitle: 'An account is a passkey',
    passkeyBody: 'No password to choose. Your phone makes it, and it takes seconds.',
    makeAccount: 'Make an account',
    signIn: 'I have an account: sign in',
    promptFooter: 'Then the book goes on your shelf, and opens on its songs.',
    deadTitle: 'This link doesn’t open a book',
    deadBody:
      'The invitation may have expired or been withdrawn, or this account isn’t in the book. Ask whoever sent it to you for a new one.',
    addByLink: 'Add a book by its link',
    fullTitle: 'This book is full',
    fullBody:
      'It has reached its limit of people, so the invitation can’t let anyone else in. Ask the book’s owner to make room, then open the link again.',
    errorTitle: 'We couldn’t open this link',
    errorBody:
      'Something went wrong reaching Estante. Check your connection, then open the link again.',
    ok: 'OK',
  },
  // The sign-in surface (account.sign_in, workflows 7 & 13; mockup W13). The
  // method screen's copy is W13's; the email, check-your-email and offer-a-
  // passkey steps and the worded errors realise the same wording (Decision 7).
  // Every status is a word, never colour alone; no error ever names the address.
  signIn: {
    brand: 'Estante',
    close: 'Close',
    // The method screen (W13 §Signing in).
    heading: 'Sign in',
    body: 'Bring your books, instruments and preferences to this phone.',
    usePasskey: 'Use a passkey',
    emailLink: 'Email me a link',
    note: 'No passkey here? The link signs you in on this phone, and recovers your account if every device with a passkey is lost.',
    // The emailed-link request step.
    emailHeading: 'Email me a link',
    emailBody: 'We’ll send a sign-in link to your email. Open it on this device to sign in.',
    emailLabel: 'Your email',
    emailSend: 'Send the link',
    usePasskeyInstead: 'Use a passkey instead',
    // After requesting a link — never says whether the address has an account.
    checkHeading: 'Check your email',
    checkBody: 'If that address has an account, a sign-in link is on its way. Open it on this device to sign in.',
    checkBack: 'Back to sign in',
    // Redeeming an emailed link at boot.
    redeeming: 'Signing you in…',
    working: 'Working…',
    // Offering to add a passkey to this device (workflow 13 lines 23-24).
    offerHeading: 'Make signing in quicker',
    offerBody: 'Add a passkey to this device, so next time is one tap.',
    offerAdd: 'Add a passkey',
    offerSkip: 'Not now',
    // Worded errors and retries.
    errorPasskey: 'That passkey didn’t work — try again or use an emailed link.',
    errorExpired: 'This link has expired or has already been used — request a new one.',
    errorOffline: 'Couldn’t reach Estante. Check your connection and try again.',
    requestNewLink: 'Request a new link',
  },

  // The account screen (account.account_screen, workflow 13 §The account screen;
  // design.theme_picker; mockup Theme-picker). Three regions: Preferences (theme
  // + language, present and writable signed in or not), Signed-in devices and
  // Passkeys (additive, when signed in). The chosen option is marked by the word
  // "Selected", never colour alone; every status and error is a word. `{device}`
  // is a device description, `{name}` a passkey's label, `{time}`/`{date}` a
  // localized instant.
  account: {
    open: 'Account',
    title: 'Account',
    back: 'Back',
    // Preferences.
    preferences: 'Preferences',
    theme: 'Theme',
    language: 'Language',
    themeAutomatic: 'Automatic',
    themeAutomaticMeta: 'Follows this device',
    themeEstante: 'Estante',
    themeEstanteMeta: 'Neutral, ink-blue chords',
    themeCaderno: 'Caderno',
    themeCadernoMeta: 'Paper, red-pen chords, serif',
    themePalco: 'Palco',
    themePalcoMeta: 'Dark stage, amber, read far',
    selected: 'Selected',
    themeNote:
      'Automatic follows this device: light → Estante, dark → Palco. Choosing a named theme replaces it. Your choice follows you to every device; automatic re-reads each device’s own light or dark mode.',
    // Density and chord diagrams (shell.display_preferences).
    density: 'Density',
    densityCompact: 'Compact',
    densityCompactMeta: 'Smaller, more in view',
    densityCompactMetaLong: 'Tighter spacing, a smaller chart — more of a song in view',
    densityComfortable: 'Comfortable',
    densityComfortableMeta: 'The default',
    densityRoomy: 'Roomy',
    densityRoomyMeta: 'Larger, read from further',
    densityRoomyMetaLong: 'Looser spacing, a larger chart — read from further away',
    diagrams: 'Chord diagrams',
    diagramHand: 'Hand',
    diagramHandRight: 'Right-handed',
    diagramHandRightMeta: 'The default · lowest string on the left',
    diagramHandLeft: 'Left-handed',
    diagramHandLeftMeta: 'Mirrored · lowest string on the right',
    diagramNeck: 'Neck',
    diagramNeckVertical: 'Vertical',
    diagramNeckVerticalMeta: 'The default · the nut at the top',
    diagramNeckHorizontal: 'Horizontal',
    diagramNeckHorizontalMeta: 'The nut at the left, frets to the right',
    diagramsNote:
      'Changes how a shape is drawn, never which shapes are found. Every diagram follows it.',
    languageNote: 'Uses your browser’s language until you choose one.',
    // Not signed in.
    notSignedIn: 'Not signed in',
    notSignedInBody:
      'These preferences are saved on this device now. Sign in to keep your books and carry theme and language to your other devices.',
    usePasskey: 'Use a passkey',
    emailLink: 'Email me a link',
    // Signed in.
    signedIn: 'Signed in',
    signedInStatus: 'Signed in on this device',
    loading: 'Loading…',
    retry: 'Try again',
    // Signed-in devices.
    devices: 'Signed-in devices',
    thisDevice: 'This device',
    unknownDevice: 'A signed-in device',
    inUseNow: '{device} · in use now',
    lastUsed: 'last used {time}',
    offlineManage:
      'You’re offline. You can still sign out of this device; your other devices and passkeys can’t be managed until you reconnect.',
    signOut: 'Sign out',
    signOutLabel: 'Sign {device} out',
    signOutThis: 'Sign out of this device',
    signOutTitle: 'Sign {device} out?',
    signOutBody:
      'It stops working on that device the next time it reaches Estante. Nothing on it is removed.',
    signOutConfirm: 'Sign out',
    cancel: 'Cancel',
    // Signing out of THIS device (account.sign_out; workflow 13 §Signing out;
    // mockup W13-new-device.dc.html:174-197).
    signOutThisTitle: 'Sign out of this device?',
    signOutChoice: 'What to do with this account’s books on this device',
    signOutRemove: 'Remove this account’s books from this device',
    signOutRemoveMeta: 'For a borrowed or shared device.',
    signOutKeep: 'Keep them here',
    signOutKeepMeta: 'As local books, no longer synced.',
    signOutNotYet: 'Not yet on Estante:',
    signOutUnsavedSongs: {
      one: '{title} · unsaved changes in {count} song',
      other: '{title} · unsaved changes in {count} songs',
    },
    signOutUnpushed: {
      one: '{title} · {count} save not yet pushed',
      other: '{title} · {count} saves not yet pushed',
    },
    signOutOnlyHere: '{title} is only on this device. Download it before it is removed.',
    signOutDownload: 'Download',
    signOutDownloadLabel: 'Download {title}',
    signOutConfirmRemove: 'Sign out and remove',
    signOutConfirmKeep: 'Sign out and keep',
    signOutLeftOffline:
      'Signed out on this device. Estante will clear the session when this device next reaches it.',
    // Passkeys.
    passkeys: 'Passkeys',
    passkeyUnnamed: 'Passkey',
    passkeyAdded: 'Added {date}',
    addPasskey: 'Add a passkey to this device',
    removePasskey: 'Remove',
    removePasskeyLabel: 'Remove {name}',
    removePasskeyTitle: 'Remove {name}?',
    removePasskeyBody:
      'This passkey will no longer sign you in. Your other passkeys still work; you can add another any time.',
    removePasskeyConfirm: 'Remove',
    // Leaving Estante (account.leaving, workflow 17; mockup W17-leaving.dc.html).
    leaving: 'Leaving Estante',
    leavingBody: 'Take a copy of everything you hold here, then end your account if you want to.',
    leaveTakeData: 'Take your data out',
    leaveDelete: 'Delete my account',
    // Take your data out — local, offline, one zip per book.
    leaveTakeTitle: 'Take your data out',
    leaveOffline: 'Offline',
    leaveOfflineNote:
      'Your books are on this device, so downloads work here. Deleting your account needs a connection.',
    leaveDataBody:
      'Each book is saved as it is on this device — the full history and your unsaved changes — just as Download does on any book.',
    leaveDownloadAll: 'Download everything',
    leaveDownload: 'Download',
    leaveDownloadLabel: 'Download {title}',
    leaveHomeBook: 'Your home book',
    leaveClose: 'Done',
    // Delete my account — terminal, type-the-email confirm.
    leaveTitle: 'Delete your account?',
    leaveWhen: 'When you delete your account:',
    leaveWillAccount: 'Your account, every session and every passkey are removed.',
    leaveWillBooks: 'The books you own are deleted for everyone who shares them.',
    leaveWillAccess: 'Your access to books other people own ends.',
    leaveWillDevice: 'Your books and home book are removed from this device.',
    leaveOwnHead: 'Books you own — deleted for everyone:',
    leaveSharedWith: {
      one: '{title} · shared with {count} person — they will lose access',
      other: '{title} · shared with {count} people — they will lose access',
    },
    leaveOnlyYou: '{title} · only you — deleted',
    leaveLocalHead: 'Only on this device — take it first:',
    leaveTakeFirst: 'Take your data out first',
    leaveConfirmLabel: 'Type your email address to confirm:',
    leaveMismatch: 'That is not the email on this account. Check it and try again.',
    leaveNeedsConnection: 'Needs a connection — available once you are back online.',
    leaveCannotUndo: 'This cannot be undone.',
    // Worded errors.
    errNetwork: 'You’re offline, or Estante is unreachable. Connect and try again.',
    errGeneric: 'Something went wrong. Try again.',
    // The Recovery email region, the last way in, and the passkey-confirmed
    // delete (account.recovery_email; workflow 13, workflow 17).
    recoveryHeading: 'Recovery email',
    recoveryNone: 'No recovery email',
    recoveryNoneWarn: 'If you lose every device with a passkey, there is no way back in.',
    recoveryLabel: 'Recovery email',
    recoveryHint: 'Used only to email you a sign-in link. Shown here, to you, and nowhere else.',
    recoverySend: 'Send a verification link',
    recoveryWaiting: 'Waiting for you to confirm',
    recoverySent: 'We sent a verification link to {address}. Check your inbox and open it.',
    recoveryOnceNone: 'The link works once, for fifteen minutes. Until it is opened, nothing changes and the account still has no recovery email.',
    recoveryOnceKept: 'The link works once, for fifteen minutes. Until it is opened, nothing changes and {address} stays your recovery email.',
    recoverySendAgain: 'Send again',
    recoveryDifferent: 'Use a different address',
    recoveryConfirmed: 'Confirmed',
    recoveryConfirmedBody: 'Gets a sign-in link when you ask for one. Shown only to you.',
    recoveryChange: 'Change',
    recoveryChangeHint: 'Changing it keeps this address in effect until the new one is confirmed; this address then gets a short notice that it was changed.',
    recoveryInvalid: 'That does not look like an email address.',
    recoveryOfflineHead: 'When offline',
    recoveryOffline: 'The recovery email needs a connection, like signing in. Its buttons wait until you are back online; your songs do not.',
    rateLimited: 'Too many tries — try again shortly.',
    lastWayIn: 'last way in',
    lastWayInBody: 'Your only way to sign in — add a recovery email or another passkey first.',
    leaveByPasskey: 'This account has no email. Confirm with one of your passkeys to delete it.',
    leaveNotConfirmed: 'Not deleted — the passkey was not confirmed.',
    leaveNotConfirmedBody: 'Nothing has changed. Try again when you are ready.',
    leaveRefused: 'That passkey did not confirm this account. Try again.',
    leaveNowEmail: 'This account now has an email — type it to confirm.',
  },

  // The recovery email's confirm page, opened by the emailed link
  // (account.recovery_email; workflow 13 §Confirming it).
  recoveryConfirm: {
    brand: 'Estante',
    heading: 'Recovery email',
    working: 'Confirming your recovery email…',
    confirmed: 'Your recovery email is confirmed',
    body: 'Your recovery email is now where Estante sends a sign-in link if you lose every device with a passkey.',
    notice: 'This link only confirms the address — it does not sign you in on this device, and opens no book.',
    expired: 'This link has expired or was already used — send a new one from the account screen.',
    taken: 'This address is the recovery email of another Estante account — sign in with it instead.',
    rateLimited: 'Too many tries — try again shortly.',
    errNetwork: 'You’re offline, or Estante is unreachable. Connect and try again.',
    retry: 'Try again',
    open: 'Open Estante',
  },

  // Writing a new song (songs.new_song, workflow 3; W03 board). The ways in (the
  // Create row, "new song in this book"), the which-book bar above the editor,
  // and the host's own chrome. `{query}` is the search that becomes the title;
  // `{book}` the book the song goes into.
  newSong: {
    create: 'Create “{query}”',
    createMeta: 'A new song in {book}',
    inThisBook: 'New song in {book}',
    inBook: 'In {book}',
    changeable: 'can change until the first save',
    changeBook: 'Change book',
    back: 'Back',
    unsaved: 'unsaved',
    untitled: 'Untitled song',
    notationNote:
      'The notation comes from your preference, so the song reads the same to everyone.',
  },

  // The make-it-your-own sheet (books.fork, workflow 11 §Ways in; W11 board #1).
  // It names the book, not its owner (Decision 4).
  fork: {
    title: '{book} is someone else’s — make it your own?',
    body: 'You can read {book}, but not save to it. Making it your own gives you:',
    pointCopy: 'Your own copy of the book, with all its history. Your edits move into it and save there.',
    pointFollow: 'It keeps following {book}: when it has new saves, you choose when to bring them in.',
    pointShelf: 'It takes the place of {book} on your shelf, so nothing shows twice.',
    smallPrint: 'Your copy goes on Estante, private to you. You can share it, with its own limit of 50 people.',
    confirm: 'Make it my own',
    notNow: 'Not now',
    busy: 'Making it your own…',
    offline: 'Making it your own needs the network. Nothing changed: connect, then try again.',
    quota: 'This would put you over your limit on Estante.',
    signedOut: 'Sign in to make it your own.',
    error: 'Couldn’t make it your own. Nothing changed: try again.',
  },

  // The save sheet, discard confirm and save-all (songs.save_sheet, workflow 4;
  // W04 board). `{title}` is a song's title, `{count}` a number of songs,
  // `{book}` a book's label. The on-screen "what changed" rows are localized
  // (Decision 3); the saved note stays the diff's neutral English, so it reads
  // the same for every member of a shared book.
  saveSheet: {
    title: 'Save {title}',
    titleAll: { one: 'Save {count} song', other: 'Save {count} songs' },
    whatChanged: 'What changed',
    note: 'Note',
    pushCaption:
      'Saving shares this version with whoever shares the book; with no network, at the next sync.',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    saveAll: 'Save all',
    saveAllLabel: 'Save all changes in {book}',
    // A new song with no title line yet is named here (acceptance 7), and the
    // first save ever asks for the author's name (§Who made the change).
    songNameLabel: 'Name this song',
    songNameHelp: 'Used for its title and its file name.',
    nameLabel: 'Your name, as it will appear in a song’s history',
    nameHelp: 'Asked once. After you sign in, your account’s name is offered instead.',
    // The Worker's backstop refusal surfaced (a marked/unreadable file); the
    // editor's gate catches it first, so this is rare (Constraints).
    refused: 'Not saved. Line {line} could not be read. Fix it in the editor, then save again.',
    // A book with an in-progress merge holds every save until the conflicts are
    // settled (sync.conflicts; workflow 9 L42-43) — distinct from the marker-line
    // refusal above.
    refusedMerge:
      'Not saved. Settle the conflicts in this book first — a save now would be folded into the merge.',
    failed: 'Not saved. Something went wrong writing it to this device. Your changes are still here — save again.',
    // Discard — the one destructive action, which always asks (§Discarding).
    discardTitle: 'Discard changes to {title}?',
    discardBody: 'The song goes back to how it was last saved. This would be lost:',
    keepEditing: 'Keep editing',
    discard: 'Discard changes',
    // A book the user cannot push to (§A book the user cannot push to): the
    // offer on the book detail's lost-access and cannot-save cards, which opens
    // the make-it-your-own sheet (`fork`, books.fork).
    makeYourOwn: 'Make this book your own',
    notNow: 'Not now',
    // The localized "what changed" rows (renderChange, Decision 3): a location
    // and what changed there. Musical tokens — chords, note names, section
    // names, property keys, bar numbers — pass through as data, never translated.
    change: {
      untitledSection: '(untitled)',
      titleWhere: 'Title',
      sectionsWhere: 'Sections',
      voicingsWhere: 'Voicings',
      sectionBar: '{section} bar {bar}',
      added: '{value} added',
      removed: '{value} removed',
      changed: '{before} → {after}',
      sectionAdded: 'section added',
      sectionRemoved: 'section removed',
      sectionRenamed: 'renamed to {name}',
      sectionReordered: 'reordered',
      wordsChanged: 'words changed',
      voicingBlockAdded: 'added for {tuning}',
      voicingBlockRemoved: 'removed for {tuning}',
      voicingAdded: 'for {tuning}: {chord} added',
      voicingRemoved: 'for {tuning}: {chord} removed',
      voicingChanged: 'for {tuning}: {chord} changed',
    },
  },

  // A song's history (songs.history, workflow 6; W06 board). `{book}` is a
  // book's label, `{title}` a song's title, `{file}` a song's file name, `{date}`
  // a version's date. The on-screen "what changed" rows reuse the save sheet's
  // localized renderChange; the per-row summary stays the diff's neutral English
  // one-liner, like the save note. `you` and `merged, with your resolution` are
  // words, never colour alone (mockup README L26).
  history: {
    title: 'History',
    newestFirst: '{book} · newest first',
    songInBook: '{title} · {book}',
    listLabel: 'Versions of {title}',
    you: 'you',
    unsaved: 'Unsaved, on this device',
    unsavedBadge: 'unsaved',
    unsavedChanges: 'unsaved changes',
    mergedWithResolution: 'Merged, with your resolution',
    backToSong: 'Back to the song',
    backToHistory: 'Back to history',
    whatChanged: 'What changed from the version before',
    whatChangedToNow: 'What changed from this version to now',
    songAsItWas: 'The song as it was',
    asItWasThen: '{title} as it was then',
    compareNow: 'Compare with now',
    compareBefore: 'Compare with the version before',
    restore: 'Restore this version',
    showText: 'Show the text',
    lineDiffCaption: 'the line diff of {file} against the version before',
    empty: 'No versions yet.',
    // Restoring over unsaved changes asks first, showing what would be lost
    // (workflow 6 §Restoring; W06 restore dialog).
    restoreTitle: 'Restore the version of {date}?',
    restoreBody:
      '{title} has unsaved changes on this device. Restoring replaces them, and this would be lost:',
    restoreCaption:
      'The whole version is restored. It is then unsaved, and saving it makes a new version; nothing in the history is changed.',
    keepChanges: 'Keep my changes',
    loseAndRestore: 'Lose them and restore',
    // Restoring one block of a version (songs.restore_part, workflow 6 §Restoring).
    restoreBlock: 'Restore this block',
    restoreBlockNamed: 'Restore this block: {block}',
    voicingBlock: 'Voicings for {tuning}',
    restorePartTitle: 'Restore {block}?',
    restorePartBody:
      '{block} has unsaved changes on this device. Restoring this block replaces them, and this would be lost:',
    restorePartCaption:
      'Only this block is restored; the rest of the song is left as it is. It is then unsaved, and saving makes a new version; nothing in the history is changed.',
    nothingToRestore: 'Restoring this block brings nothing back.',
    noBlockRestore:
      'This version is too old to restore block by block. You can still restore the whole version.',
  },

  // The per-song conflict resolver (sync.conflicts, workflow 9 §Settling one;
  // W09 phone). `{title}` a song's title, `{author}` the incoming author (who
  // labels *theirs* — the mockup's *Ana's*), `{n}`/`{total}` the stepper,
  // `{section}`/`{chord}`/`{tuning}`/`{variation}`/`{key}` musical tokens that
  // pass through as data (never translated). Statuses carry a word, never colour
  // alone (mockup README L26).
  songConflict: {
    back: 'Back',
    stepOf: 'Conflict {n} of {total}',
    prev: 'Previous conflict',
    next: 'Next conflict',
    yours: 'Yours',
    theirs: '{author}’s',
    theirsFallback: 'Theirs',
    // Headings and sublines per kind.
    chartTitle: '{section}',
    chartTitleFallback: 'A bar you both changed',
    chartBody: 'You and {author} both changed this.',
    chartBodyFallback: 'You both changed this.',
    voicingTitle: 'The shape for {chord}',
    voicingBody: '{tuning} · {variation}. You and {author} each chose a different shape.',
    voicingBodyFallback: '{tuning} · {variation}. You each chose a different shape.',
    mainVariation: 'main variation',
    propertyTitle: 'The {key}',
    propertyBody: 'You and {author} both changed it.',
    propertyBodyFallback: 'You both changed it.',
    titleTitle: 'The title',
    titleBody: 'You and {author} both named it differently.',
    titleBodyFallback: 'You both named it differently.',
    genericTitle: 'A change you both made',
    genericBody: 'You and {author} both changed this.',
    genericBodyFallback: 'You both changed this.',
    absent: '(removed)',
    keepMine: 'Keep mine',
    takeTheirs: 'Take theirs',
    keepBoth: 'Keep both',
    edit: 'Edit',
    readsAsYours:
      'Until you settle it, {title} reads as your version, with the places in conflict marked.',
    // Keep both, for a whole song: yours stays, theirs becomes its own song.
    keepBothSongTitle: 'Two songs?',
    keepBothSongBody:
      'Keep yours as it is and save {author}’s version beside it, as its own song, for when you have really made two songs.',
    keepBothSongBodyFallback:
      'Keep yours as it is and save the incoming version beside it, as its own song, for when two people have really made two songs.',
    keepBothSong: 'Keep both, as two songs',
    previewLabel: '{title}, your version',
    // The §7 musical-terms phrase a screen reader announces at a conflicted
    // place in the reading preview (docs/screen-reader.md §7.1; workflow 9
    // lines 13-23): what conflicts, so the region never rides on colour alone.
    spoken: {
      chartLine: 'conflict in the chart line',
      line: 'conflict in this line',
    },
    settledSoFar: 'Settled so far',
    settledMine: 'Kept yours',
    settledTheirs: 'Took {author}’s',
    settledKeepBoth: 'Kept both — {author}’s in a variation',
    settledEdit: 'Edited the text',
    allSettled: 'Every conflict in {title} is settled.',
    // The *edit* affordance: the song's marked text, raw, with git's markers
    // (workflow 9 §Settling one; W09 tablet). The only monospaced surface here
    // (mockup README L24). Save refuses while a marker line remains, pointing at
    // it (§11.12.3; workflow 4 L54-56).
    editTitle: 'Edit the text of {title}',
    editHelp: 'Keep the lines you want, from either side or both, and delete the three marker lines.',
    editTextLabel: 'The song’s text, with the conflict markers',
    editSave: 'Save',
    editCancel: 'Cancel',
    editRefused:
      'Not saved. Line {line} is still a conflict marker. Remove every marker line once you have chosen what stays, then save again.',
    markersTitle: 'Reading the markers',
    markerStart: 'your version starts',
    markerMid: 'yours ends, {author}’s starts',
    markerEnd: '{author}’s version ends',
  },

  // The book-level paused panel (sync.conflicts, workflow 9 §Meeting one / §The
  // rest / §Leaving one; W09 computer). `{count}` a song count, `{title}` a
  // song's title, `{author}` the incoming author. The merge is book-wide: nothing
  // new comes in until it is settled (workflow 9 L38-45).
  bookConflicts: {
    needsYou: { one: '{count} song needs you.', other: '{count} songs need you.' },
    needsYouBody:
      'The latest incoming saves and yours changed the same places. Everything else is already here, and you can read and edit as usual; this book takes nothing new from sync until these are settled.',
    inConflict: 'In conflict',
    conflictsCount: { one: '{count} conflict', other: '{count} conflicts' },
    conflictBadge: 'conflict',
    settle: 'Settle',
    settleSong: 'Settle {title}',
    keepBothSong: 'Keep both',
    keepBothSongFor: 'Keep both versions of {title} as two songs',
    deletedBody: '{author} deleted this song. You had edited it.',
    keepSong: 'Keep the song, with the edits',
    deleteSong: 'Delete it',
    cameIn: 'Came in, already here',
    addedBy: 'added by {author}',
    changedBy: 'updated by {author}',
    savingTitle: 'Saving in this book',
    savingBody: {
      one: 'Settle the song first. A save made now would be folded into the merge.',
      other: 'Settle the {count} songs first. A save made now would be folded into the merge.',
    },
    savingSafe: 'Your unsaved edits are safe as they are until then.',
    notNowTitle: 'Not now',
    notNowBody:
      'The conflicts can wait as long as you like. Abandoning puts the book back as it was before this sync; the incoming saves wait to be merged at the next one.',
    abandon: 'Abandon the merge',
  },

  // The file view (books.file_view, workflow 14): the book as git sees it — the
  // tree with each file's status as a word, a raw editor, the whole history with
  // line diffs, and the file operations (rename/move, delete, new song, saving
  // several). `{book}` is the book's title; `{name}`/`{file}` a file's path;
  // `{folder}` its folder; `{count}` a file count.
  fileView: {
    filesEntry: 'Files',
    filesFor: 'Files in {name}',
    title: 'Files',
    titleIn: '{book} · Files',
    back: 'Back',
    backToFiles: 'Back to files',
    backToHistory: 'Back to history',
    historyTab: 'History',
    filesTab: 'Files',
    historyTitle: '{book} · History',
    newSong: 'New song',
    tree: 'Files in {book}',
    holds:
      'A book holds songs (*.cifra.md), setlists (*.setlist.md), README.md and .gitattributes, and nothing else.',
    status: {
      unsaved: 'unsaved changes',
      new: 'new',
      deleted: 'deleted',
      conflict: 'conflict',
    },
    filesChanged: { one: '{count} file changed', other: '{count} files changed' },
    save: 'Save…',
    saveFiles: { one: 'Save {count} file…', other: 'Save {count} files…' },
    rename: 'Rename',
    renameLabel: 'Rename {name}',
    renameSong: 'Rename song',
    renameSetlist: 'Rename setlist',
    renameNameLabel: 'Name, in {folder}/',
    renameNameLabelRoot: 'Name',
    renameHintSong: 'A song keeps .cifra.md, so it stays a song. The title inside it does not change.',
    renameHintSetlist: 'A setlist keeps .setlist.md, so it stays a setlist.',
    linkNotice: 'Links to it are updated in the same save',
    renameCancel: 'Cancel',
    renameConfirm: 'Rename',
    deleteLabel: 'Delete {name}',
    deleteTitle: 'Delete {name}?',
    deleteBody:
      'It is removed from the book when you save. A setlist that points at it will show a missing item.',
    deleteCancel: 'Keep it',
    deleteConfirm: 'Delete',
    changesTitle: 'Changes not saved',
    changesCaption: 'One save, one commit',
    noChanges: 'No changes to save.',
    historyHeading: 'History',
    merge: 'merge',
    commits: 'Versions of {book}',
    commitFiles: { one: '{count} file', other: '{count} files' },
    commitMeta: '{author} · {date} · {hash} · {files}',
    restore: 'Restore this version',
    restoreCaption:
      'Restoring writes that file as it was after this commit into the working copy, to be saved as a new version.',
    diffCaption: 'the line diff of {file} in this commit',
    emptyEditor: 'Choose a file to open it.',
    emptyCommit: 'Choose a commit to see what it changed.',
  },

  nav: {
    label: 'Sections',
    explore: 'Chords',
    instrument: 'Instrument',
    library: 'Saved',
    sheets: 'Songs',
    backup: 'Backup',
  },

  chip: {
    summary: 'Instrument: {label}. Change instrument.',
    add: '+ Add instrument',
  },

  viewAs: {
    fromSheet: 'from this sheet',
    fromLink: 'from the link',
    viewing: ' Viewing as {label} ({source})',
    back: 'Back to my {label}',
    keep: 'Keep as my default',
  },

  input: {
    label: 'Chord',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Show',
    readAs: ' Read “{text}” as {reading}. ',
    use: 'Use {reading}',
    build: 'Build the chord',
    root: 'Root',
    quality: 'Quality',
    seventh: 'Seventh',
    bass: 'Bass',
    bassRoot: 'Root',
    extensions: 'Extensions',
  },

  quality: {
    major: 'Major',
    minor: 'Minor',
    dim: 'Diminished',
    aug: 'Augmented',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'No 7th',
    dominant: 'Dominant 7th',
    major: 'Major 7th',
    diminished: 'Diminished 7th',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'major 7th',
      dominantSharpFive: 'dominant 7th, raised 5th',
    },
    bareNine: {
      add: 'added 9th, no 7th',
      dominant: 'dominant 9th, includes the flat 7th',
    },
    degreeSign: {
      diminishedSeventh: 'diminished 7th',
      diminishedTriad: 'diminished triad, no 7th',
    },
    sevenFour: {
      suspendedFourth: 'suspended 4th',
      addedFourth: 'added 4th',
    },
  },

  errors: {
    empty: 'Enter a chord.',
    unexpected: 'Unexpected "{text}".',
    needsNumber: '"{text}" must be followed by a number.',
    bassNeeded: 'A "/" must be followed by a bass note or a number.',
    badNote: 'Cannot parse note: {text}',
    badPitch: 'Cannot parse pitch: {text}',
    emptyTuning: 'A tuning needs at least one string.',
    unknownQuality: 'Unknown chord quality: {quality}',
    badDegree: 'Bad extension degree: {degree}',
    badAlteration: 'Bad extension alteration: {alter}',
    unknownDialect: 'Unknown notation dialect: {dialect}',
    noRoot: '"{text}" does not start with a note name.',
    badRoot: 'Cannot read the root note "{text}".',
    badBass: 'Cannot read the bass note "{text}".',
    unreadable: 'Cannot read "{text}" in "{whole}".',
    noSheetInLink: 'That link carries no sheet.',
    cannotDecompress: 'This browser cannot read compressed sheet links.',
    unknownLinkFormat: 'That link is not in a format this app understands.',
    notASheet: 'That link does not contain a song sheet.',
  },

  toggles: {
    label: 'Diagram display',
    neck: 'Neck view',
    left: 'Left-handed',
  },

  results: {
    announceNone: 'No fingerings found.',
    announceCount: '{count} fingerings in {positions} positions.',
    empty: 'Enter a chord to see how it can be played.',
    none: 'No fingerings for this chord on {label}.',
    noneHelp:
      'It may need more strings than this instrument has, or your voicing rules may be too strict.',
    adjustRules: 'Adjust voicing rules',
    save: ' Save',
    saved: ' Saved',
    saveLabel: 'Save {shorthand} to your library',
    removeLabel: 'Remove {shorthand} from your library',
  },

  groups: {
    open: 'Open position',
    fret: 'Fret {position}',
    list: '{position} fingerings',
    showFewer: 'Show fewer',
    showAll: 'Show all {count}',
  },

  difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },

  diagram: {
    open: 'open position',
    startingAt: 'starting at fret {position}',
    barre: 'barre across {count} strings at fret {fret}',
    fingers: 'fingers {fingers}',
    muted: { one: '{count} string not played', other: '{count} strings not played' },
    rootOn: 'root on the {ordinal} string',
    noRoot: 'no root',
    voicedAs: 'voiced as {chord}',
    toPlay: '{difficulty} to play',
    yourShape: 'your shape',
    default: 'default',
  },

  chart: {
    label: 'Chart',
    // Screen-reader structural phrases (shell.a11y_chart; docs/screen-reader.md
    // §5, §7). `bar` leads a stated numbered measure (§5, cifra.md §2.8);
    // `noChord` reads a no-chord mark (§5, cifra.md §2.6); the region words
    // bound a conflict (§7.1) or a shown default (§7.3) by a word, never colour.
    spoken: {
      noChord: 'no chord',
      bar: 'bar {n}:',
      needsYou: 'needs you',
      conflict: 'a conflict',
      endOfConflict: 'end of conflict',
      default: 'default',
      endOfDefaults: 'end of defaults',
    },
  },

  // The spoken chord name (shell.a11y_chart; docs/screen-reader.md §3): a chord
  // announced by its name in words, never its glyph, in the app language. The
  // interval numbers name a chord's degrees (`7` → "seven").
  chord: {
    spoken: {
      doubleFlat: 'double flat',
      flat: 'flat',
      sharp: 'sharp',
      doubleSharp: 'double sharp',
      minor: 'minor',
      major: 'major',
      diminished: 'diminished',
      augmented: 'augmented',
      suspendedTwo: 'suspended two',
      suspendedFour: 'suspended four',
      fifth: 'five',
      over: 'over',
      add: 'add',
      footnote: 'footnote',
      interval: { 2: 'two', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 9: 'nine', 11: 'eleven', 13: 'thirteen' },
    },
  },

  // The reading view (songs.reading, workflow 2; board W02): the chart, the
  // shapes, the variation picker, the transpose control, full screen, and the
  // responsive app bar. `{key}` is a key name (a musical token, never
  // translated), `{offset}` a signed semitone count, `{instrument}` the
  // instrument in use, `{artist}`/`{book}` the song's artist and its book,
  // `{list}` a comma-joined chord list.
  reading: {
    back: 'Back',
    byline: '{artist} · {book}',
    keyOf: 'Key of {key}',
    shapes: 'Shapes',
    shapesInKey: 'Shapes in {key}',
    shapesFor: 'Shapes · {instrument}',
    shapesCaption: "Hollow: the app's default. Filled in colour: your shape for that chord.",
    transposedCaptionKey:
      "The song's own shapes are for {key}, so transposed chords use your shapes, then the defaults.",
    transposedCaption:
      'A transposed song has no chosen shapes, so each chord uses your shape, then the default.',
    unvoiced: 'No playable shape for {list}.',
    // The variation picker (workflow 2 L73-74).
    variationLabel: 'Variation',
    variationDefault: 'Default',
    // The transpose control and its status (workflow 2 L135-146; W02 L181-186).
    transpose: 'Transpose',
    transposeTitle: 'Transpose the view',
    down: 'Down a semitone',
    up: 'Up a semitone',
    writtenKey: 'Written key',
    transposedToKey: 'Transposed to {key} ({offset})',
    transposedBy: 'Transposed ({offset})',
    backToKey: 'Back to {key}',
    backToWritten: 'Back to the written key',
    arrangingOff: 'Arranging is off while transposed',
    // The no-voicings notice and the arrange seam (workflow 2 L75-77).
    noVoicings:
      'Nobody has chosen shapes for {instrument} in this song yet. These are the easiest shapes for each chord.',
    arrangeFor: 'Arrange for {instrument}',
    // The first-open instrument prompt, asked once (workflow 1 §The instrument;
    // W01 L104-108; songs.first_song). The copy is fixed to "guitar".
    instrumentPrompt: 'Playing on guitar — change?',
    instrumentPromptChange: 'Change instrument',
    instrumentPromptDismiss: 'Keep guitar and dismiss',
    // The app bar and action bar.
    arrange: 'Arrange',
    edit: 'Edit',
    history: 'History',
    addToSetlist: 'Add to setlist',
    print: 'Print',
    share: 'Share',
    more: 'More',
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    // A background sync brought a new version while the song was open
    // (sync.read_in_place, workflow 8 §"A song open while it changes"; W08). The
    // non-modal notice names who changed it and opens the song's history.
    // `{name}` is the incoming author's display name.
    updatedBy: 'Updated by {name}',
    seeWhatChanged: 'See what changed',
    updateDismiss: 'Dismiss update notice',
  },

  // The arrange surface (songs.arrange, workflow 5; board W05): the mode entered
  // from reading that turns the chords into things to tap. `{instrument}` is the
  // instrument in use, `{chord}` a chord symbol (a musical token, never
  // translated), `{shorthand}` its spoken fret string, `{name}` a variation name.
  arrange: {
    back: 'Back',
    done: 'Done',
    modeChip: 'Arranging · {instrument}',
    modeHint: 'Tap a chord to choose its shape',
    chordButton: 'Choose a shape for {chord}',
    shapes: 'Shapes',
    shapesCaption:
      'Chosen shapes show in ink. A chord you have not chosen shows your shape or the app’s default, each marked.',
    chooseEveryUnchosen: 'Choose these for every unchosen chord',
    runWizard: 'Run the wizard',
    variations: 'Variations',
    // The picker (W05 L89-112).
    pickerLabel: 'Shapes for {chord}',
    scopeLabel: 'Which chords this changes',
    everyChord: 'Every {chord}',
    onlyHere: 'Only here',
    onlyHereWarning:
      'Only here marks this bar in the chart, for everyone who plays the song. On their instruments it shows the default until someone chooses.',
    choose: 'Choose',
    chooseShape: 'Choose this shape',
    chooseShapeLabel: 'Choose {chord}, {shorthand}',
    enterShape: 'Enter a shape',
    enterShapeTitle: 'Enter a shape for {chord}',
    noShapes: 'No playable shape for {chord} on {instrument}.',
    // The variation selector and the add-a-variation dialog (W05 L75-85, 200-224).
    variationLabel: 'Variation',
    variationDefault: 'Default',
    newVariation: '+ New variation',
    selectorCaption: 'The selector shows only when {instrument} has more than one variation in this song.',
    addVariationTitle: 'Add a variation',
    variationName: 'Name for this variation',
    variationPlaceholder: 'Up the neck',
    variationCopy: 'Start from the shapes in “{name}”',
    variationNeedsName: 'Give the variation a name.',
    variationTaken: 'There is already a variation called “{name}” for this instrument.',
    addVariationCancel: 'Cancel',
    addVariationConfirm: 'Add',
  },

  library: {
    title: 'Saved shapes',
    empty: 'Nothing saved for {label} yet. Star a shape on the chords screen to keep it here.',
    count: '{count} saved for {label}.',
    list: 'Saved shapes for {label}',
    open: 'Open',
    openLabel: 'Show {chord} on the chords screen',
    remove: 'Remove',
    removeLabel: 'Remove {chord} {shorthand} from your saved shapes',
  },

  catalog: {
    '6guitar': 'Guitar (6-string)',
    '7guitar': 'Guitar (7-string)',
    '4bass': 'Bass (4-string)',
    '5bass': 'Bass (5-string)',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolin',
    tenorbanjo: 'Tenor banjo',
  },

  // The short name the header chip shows (shell.header_chrome; workflow 15
  // §The roster, and switching): the catalogue name without its string count
  // when the standard instrument is meant.
  catalogShort: {
    '6guitar': 'Guitar',
    '7guitar': '7-string guitar',
    '4bass': 'Bass',
    '5bass': '5-string bass',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolin',
    tenorbanjo: 'Tenor banjo',
  },

  tuning: {
    Standard: 'Standard',
    'Drop D': 'Drop D',
    'Open G': 'Open G',
    'Open D': 'Open D',
    DADGAD: 'DADGAD',
    'Open C': 'Open C',
    Brazilian: 'Brazilian',
    'Standard (re-entrant)': 'Standard (re-entrant)',
    'Low G': 'Low G',
    Baritone: 'Baritone',
    'Standard (Brazil)': 'Standard (Brazil)',
    Irish: 'Irish',
    custom: 'Custom',
    customOption: 'Custom tuning',
  },

  form: {
    edit: 'Edit instrument',
    choose: 'Choose your instrument',
    add: 'Add an instrument',
    firstRunHelp: 'Everything is shown for this instrument. You can add others and switch at any time.',
    addHelp: 'It joins your list; the header switcher moves between them.',
    instrument: 'Instrument',
    fallbackName: 'Instrument',
    tuning: 'Tuning',
    strings: 'Strings',
    stringsHelp: 'Lowest string first. Any comma-separated pitch list works, including re-entrant tunings.',
    style: 'How you play',
    styleHelp:
      'It sets which shapes you are offered: fingerstyle allows a muted string in the middle of a chord, strumming does not. The instrument screen can change it later.',
    name: 'Name',
    nameHelp: 'Shown in the switcher. Give custom tunings names you will recognise.',
    frets: 'Frets',
    save: 'Save changes',
    start: 'Start playing',
    addButton: 'Add instrument',
    cancel: 'Cancel',
    needName: 'Give the instrument a name.',
    badTuning: 'That tuning does not read: {reason}',
  },

  backup: {
    title: 'Backup',
    help:
      'Everything you have is kept in this browser, which is fine until the device is not. ' +
      'A backup is one zip holding your instruments and settings, your saved shapes, and ' +
      'every song as a plain text file you can read and edit anywhere.',
    save: 'Save a backup',
    insideTitle: 'What is in it',
    inside:
      'One zip, with your instruments and their rules and your settings in one file, your ' +
      'saved shapes in another, and every song as a text file named after it. Drop another ' +
      'song into the songs folder with any zip tool and it comes back with the rest.',
    restore: 'Restore a backup',
    confirmTitle: 'Restore from “{name}”?',
    confirmBody:
      'Everything on this device is replaced by what the file holds: {instruments} and {songs}.',
    instruments: { one: '{count} instrument', other: '{count} instruments' },
    songs: { one: '{count} song', other: '{count} songs' },
    confirmButton: 'Replace everything',
    nudgeTitle: 'Your songs are only on this device',
    nudgeText: {
      one:
        'The song here is in no backup. On Android a new phone does not get it, and a ' +
        'browser that clears its data takes it with it.',
      other:
        'The {count} songs here are in no backup. On Android a new phone does not get ' +
        'them, and a browser that clears its data takes them with it.',
    },
    notNow: 'Not now',
    failed: 'That backup could not be read: {reason}',
  },
  instruments: {
    title: 'Instruments',
    help:
      'Everything on screen is for the instrument in use. Each keeps its own tuning, voicing rules, saved shapes and songs.',
    inUse: 'In use',
    reentrant: 'Re-entrant',
    meta: '{tuning} · {count} frets',
    use: 'Use',
    useLabel: 'Use {label}',
    edit: 'Edit',
    editLabel: 'Edit {label}',
    delete: 'Delete',
    deleteLabel: 'Delete {label}',
    add: 'Add instrument',
    back: '← All instruments',
    deleteThis: 'Delete this instrument',
    confirmTitle: 'Delete {label}?',
    confirmShapes: {
      one: 'Its {count} saved shape will go with it. ',
      other: 'Its {count} saved shapes will go with it. ',
    },
    confirmSongs: 'Songs are kept, since they carry their own tuning. This cannot be undone.',
    confirmButton: 'Delete instrument',
  },

  rules: {
    title: 'Voicing rules',
    help: 'How chords are voiced on {label}.',
    preset: 'Preset',
    custom: 'Custom',
    presets: {
      beginner: 'Beginner',
      strumming: 'Strumming',
      fingerstyle: 'Fingerstyle',
      jazz: 'Jazz',
      bassFriendly: 'Bass-friendly',
    },
    rules: 'Rules',
    rootInBass: 'Root must be the lowest note',
    requireThird: 'Require the 3rd',
    omitFifth: 'The 5th may be omitted',
    allowRootless: 'Allow rootless voicings',
    requireExtensions: 'Require every named extension',
    allowBarre: 'Allow barre chords',
    allowInnerMutes: 'Allow a muted string between sounding ones',
    allowDoubling: 'Allow a note on more than one string',
    allowDuplicatePitch: 'Allow the identical pitch twice',
    limits: 'Limits',
    maxSpan: 'Maximum stretch (frets)',
    minSoundingStrings: 'Fewest strings sounding',
    maxResultsPerGroup: 'Shapes shown per position',
    weights: 'Difficulty weights',
    weightsHelp:
      'How much each thing counts towards a shape being hard. Negative values make a shape easier.',
    weight: {
      spanPerFret: 'Stretch, per fret',
      barre: 'Barre',
      fullBarre: 'Full barre, extra',
      perFinger: 'Each finger',
      innerMute: 'Inner muted string',
      mutedString: 'Each muted string',
      positionPerFret: 'Position, per fret',
      omittedFifth: 'Omitting the 5th',
      rootless: 'Omitting the root',
      nonRootBass: 'Unrequested inversion',
      openString: 'Each open string (a bonus)',
      nonAdjacentStretch: 'Wide stretch',
    },
  },

  sheets: {
    title: 'Song sheets',
    help: 'Chords for a song on {label}, each pinned to the fingering you want taught.',
    titlePlaceholder: 'Song title',
    newTitleLabel: 'New song title',
    create: 'New song',
    untitled: 'Untitled song',
    shared: 'Shared song',
    sharedInstrument: 'Shared instrument',
    empty: 'No songs yet.',
    measures: { one: '{count} measure', other: '{count} measures' },
    chords: { one: '{count} chord', other: '{count} chords' },
    chosenHere: { one: ' · {count} voicing chosen here', other: ' · {count} voicings chosen here' },
    voicedFor: 'Voiced for {list}',
    view: 'View',
    viewLabel: 'View {title}',
    edit: 'Edit',
    editLabel: 'Edit {title}',
    duplicate: 'Duplicate',
    duplicateLabel: 'Duplicate {title}',
    delete: 'Delete',
    deleteLabel: 'Delete {title}',
    imported: 'Imported the song "{title}".',
  },

  editor: {
    // The CodeMirror source editor (songs.editor, workflows 3 & 4).
    source: {
      sourceLabel: 'Song source',
      viewToggle: 'What to show',
      text: 'Text',
      preview: 'Preview',
      previewLabel: 'Preview of the song as it will be read',
      addSection: 'Add section',
      save: 'Save',
      undo: 'Undo',
      pasteFenced: 'The pasted song is now inside a fence, so it reads as music.',
      pasteTitleAdded: 'Its first line became the title.',
      notSaved: 'Not saved.',
      voicingStop:
        'Line {line} is a voicing that can’t be read, and saving would drop it. Fix it or delete it, then save again.',
      markerStop: 'Line {line} is a conflict marker. Resolve it before the song can be saved.',
      afterRuleStop:
        'Line {line} comes after the rule, where only voicing blocks are kept, and saving would drop it. If it is part of the song, move the rule below it; a voicings heading needs a tuning, like ## Voicings: E2 A2 D3 G3 B3 E4.',
    },
    // A background sync merged a new version in under the open editor's unsaved
    // edits (songs.edit_in_place, workflow 8 §"A song open while it changes";
    // W08). The non-modal notice names who it came from and opens the song's
    // history. `{name}` is the incoming author's display name. Reuses the
    // reading view's wording (reading.updatedBy) — the same event, same model.
    updatedBy: 'Updated by {name}',
    seeWhatChanged: 'See what changed',
    updateDismiss: 'Dismiss update notice',
    variationInUse: 'Variation:',
    variationLabel: 'Which variation to use',
    variationDefault: 'Default',
    variationAdd: 'Add a variation',
    variationHelp:
      'One instrument can have several variations in a song — an easy one and a fuller ' +
      'one, say. They all live in the text, each under its own heading; which one you are ' +
      'working in is remembered per song.',
    variationName: 'Name for this variation',
    variationPlaceholder: 'Up the neck',
    variationCopy: 'Start from the shapes in “{name}”',
    variationNeedsName: 'Give the variation a name.',
    variationTaken: 'There is already a variation called “{name}” for this instrument.',
    variationCancel: 'Cancel',
    variationConfirm: 'Add',
    chartBarNumbers: 'Show bar numbers',
    chartVoicedAs: 'Name the chords in the chart by what the shapes sound',
    back: '← All songs',
    titleLabel: 'Song title',
    title: 'Title',
    song: 'The song',
    placeholder: '# Verse\nA | Cm | A | Cm',
    help: {
      sections: {
        term: 'Sections',
        text: 'Three ways to name one: a line beginning with #, a name in brackets, or a ' +
          'name and a colon. The last two may carry that section’s chords on the same ' +
          'line. A colon only names a section when chords follow it, so a sung line ' +
          'with a colon in it stays a line of words.',
        example: '# Verse\n[Intro] G  D  Em  C\nSolo: Am  F  C  G',
      },
      chart: {
        term: 'A chart',
        text: 'A vertical bar starts a new measure; spaces separate the chords inside one.',
        example: 'C  Am | F  G | C\nF     | G    | C',
      },
      words: {
        term: 'Or the words underneath',
        text: 'A line of chords over the line it is sung to, each chord above the syllable it falls on.',
        example: 'G            D\nWhen I first saw you',
      },
      either: {
        term: 'When a line could be either',
        text: 'A vertical bar makes it a chart. A leading > makes it words, and is the only way to settle a line that reads as a chord.',
        example: 'G\n> A',
      },
      bars: {
        term: 'Bar numbers',
        text: 'Bars count on their own. Write @9 at the start of a measure where the chart ' +
          'stops agreeing with the score it came from — writing a repeat out straight means ' +
          'the same bars appear twice, and the count has to be told. A heading can carry it ' +
          'instead, and a number on its own line applies to the bar after it.',
        example: '# A @9\nDm | G7 | @17 Em | A7',
      },
      variations: {
        term: 'More than one variation',
        text: 'The word before the colon names a variation, so one instrument can have ' +
          'several in one song — an easy version and a fuller one, say. A plain Voicings ' +
          'heading is the default. Which one you are working in is chosen above the shapes.',
        example: '# Voicings: E2, A2, D3, G3, B3, E4\nC = x32010\n\n# Up the neck: E2, A2, D3, G3, B3, E4\nC = x35553',
      },
      voicings: {
        term: 'Voicings',
        text: 'They sit after a --- rule, one block per tuning under a heading that names it, so the same song serves every instrument. A chord played more than one way is footnoted. A chord you have saved a shape for gets that shape when it first appears.',
        example: '---\n\n# Voicings: E2, A2, D3, G3, B3, E4\nCm = x35543\nCm[2] = 8-10-10-8-8-8',
      },
    },
    notAChord: 'Not a chord: {list}',
    badVoicingLines: 'Could not read these voicing lines: {list}',
    chart: 'The chart',
    chartHelp: 'Click any chord to choose how that one is played.',
    nothingYet: 'Nothing written yet.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', using the default shape',
    chordUnvoiced: ', cannot be voiced',
    chordChoose: '. Choose a voicing.',
    voicings: 'Voicings',
    voicingsHelp: 'Click a shape to change it everywhere it is used.',
    voicingsDefaults:
      ' Shapes marked default are what the explorer would show first; choose only the ones that need it.',
    voicingsEmpty: 'Write the song above and its chords appear here.',
    voicingsList: 'Voicings used in this song',
    choose: 'Choose',
    change: 'Change',
    everywhere: '{verb} {key} everywhere. ',
    usingDefault: 'Using the default shape. ',
    usedIn: { one: 'Used in {count} place.', other: 'Used in {count} places.' },
    default: 'default',
    missing: 'No playable shape on {label} for: {list}. Its voicing rules may be too strict.',
    share: 'Share link',
    snapPage: 'Line this page up',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pageOf: 'Page {current} of {total}',
    print: 'Print',
    shareLabel: 'Share link for this song',
    shareHelp: 'Anyone opening this link sees the song as written.',
  },

  picker: {
    enter: 'Enter a shape',
    editCurrent: 'Edit this shape',
    changeEverywhere: 'Change {label} everywhere',
    howPlayed: 'How is {chord} played here?',
    noParse: 'That chord does not parse.',
    none: 'No fingerings for {chord} on {label}. Its voicing rules may be too strict.',
    replaces: { one: 'Replaces this shape in {count} place. ', other: 'Replaces this shape in {count} places. ' },
    ways: '{count} ways to play it, grouped by position and easiest first.',
    changesOne: 'Changes this one chord. ',
    chosen: ', currently chosen',
    clearEverywhere: 'Clear everywhere',
    clearChoice: 'Clear choice',
    cancel: 'Cancel',
  },

  wizard: {
    open: 'Voicing wizard',
    barHelp: 'Choose shapes for the whole song at once.',
    title: 'Choose shapes for the whole song',
    help:
      'Each of these picks a shape for every chord in the song, taking the hand’s path ' +
      'through the chart into account rather than judging each chord on its own. You see ' +
      'what it would do before anything changes.',
    planners: {
      smoothest: {
        name: 'The smoothest path',
        text:
          'Keeps the hand where it is and the top voice from leaping. Two easy shapes at ' +
          'opposite ends of the neck are harder to play in sequence than two middling ones ' +
          'next to each other.',
        how: [
          'Every shape the search offers for the chord is a candidate.',
          'Each one is scored on how hard it is to hold, plus how far the hand and the top ' +
            'voice would have to move from the shape before it.',
          'The chart is walked in reading order, so each choice answers the one before it.',
        ],
      },
      openPosition: {
        name: 'Down at the nut',
        text:
          'The lowest shape each chord has, with open strings where they help. The shapes a ' +
          'beginner already knows.',
        how: [
          'Every shape the search offers for the chord is a candidate.',
          'Each one is scored on how hard it is to hold, plus how far up the neck it sits, ' +
            'less a credit for each open string.',
          'The chart is walked in reading order, so each choice answers the one before it.',
        ],
      },
      choroCentro: {
        name: 'Choro, beside a seven-string',
        text:
          'The six-string’s part in a regional: a thumb bass plus three fingers, in the first ' +
          'quarter of the neck, with its bass a third above whatever the seven-string is ' +
          'playing so the two do not double each other.',
        how: [
          'Shapes are enumerated rather than searched. The ordinary search discards a shape ' +
            'with muted strings when a fuller one is no harder, which is right for a solo ' +
            'player and wrong here, where the low strings are quiet because the seven-string ' +
            'has them.',
          'Four sounding strings, or five. Four is the norm in this idiom and five the ' +
            'occasional departure: a bass note under the thumb and the rest under three fingers.',
          'Or three notes with the thumb up on the fourth string and the low string ' +
            'dropped, which one source gives as the idiom’s other texture. Offered only for ' +
            'a chord with a seventh: what goes is a root or a fifth, and it is allowed ' +
            'because the tritone — the third and the seventh — still sounds. Offered rather ' +
            'than preferred, since the transcriptions show four voices in that position.',
          'The strings sounded are next to each other, with the thumb on the lowest, the ' +
            'second-lowest or the fourth, and the grip reaching at least the second string ' +
            'from the top. A hole in the middle is a decision you can still make; a shape ' +
            'that needs one cannot be undone.',
          'Nothing above the seventh fret, open strings welcome, and the grip’s own bass ' +
            'between the low E and the D above it. That is the stretch of neck the sources ' +
            'name, and the register the transcriptions of Época de Ouro actually sit in.',
          'The lowest note is a third above whatever the seven-string is playing — the slash ' +
            'note where the chart writes one, the root otherwise — in whichever octave that ' +
            'guitar is in. This is the whole point: the two guitars take different inversions ' +
            'so they do not double each other.',
          'Where a third above that bass is not in the chord, another relation stands in for ' +
            'it — which one is the choice below. The case is named in the literature rather ' +
            'than a gap here: a third above the seventh of a dominant resolving to a major ' +
            'chord lands on a note the style does not use.',
          'Every note of the chord is kept except the fifth, which is the one this idiom ' +
            'drops — unless that fifth is flattened or sharpened, since a ♭5 or a ♯5 is what ' +
            'makes the chord that chord.',
          'The chart is walked in reading order, preferring shapes that keep the same strings ' +
            'sounding, which is what turns a run like Gm, Gm6, Gm7 into one grip with one ' +
            'finger moving.',
          'Where two shapes cost the same, the one lower on the neck wins, and a fuller ' +
            'chord beats one that spends a string doubling a note.',
        ],
        options: {
          whenNoThirdAbove: {
            label: 'Where no third above the other guitar is in the chord',
            values: {
              sixth: 'A sixth, then an octave',
              thirdBelow: 'A third below',
            },
            rules: {
              sixth:
                'Where a third above the other guitar’s bass is not in the chord, a sixth ' +
                'above it is used, and failing that an octave. These are the first remedies ' +
                'the literature names for that case.',
              thirdBelow:
                'Where a third above the other guitar’s bass is not in the chord, the grip ' +
                'drops a third BELOW it instead, resting on the fifth — the second ' +
                'inversion. The literature gives this for the same case, describing it as in ' +
                'perfect keeping with the style, and names the recording it comes from.',
            },
          },
        },
      },
    },
    summary: {
      one: '{count} of {total} chords would change.',
      other: '{count} of {total} chords would change.',
    },
    covers: {
      one: '{count} bar',
      other: '{count} bars',
    },
    nothing: 'Every chord already has the shape this would choose.',
    missing: 'No shape for {list}.',
    how: 'How it works',
    howTitle: 'How this chooses',
    sources: 'Where this comes from',
    noSources: 'No source: this is a rule of thumb about hands, not a claim about how anybody’s music is played.',
    apply: 'Use these shapes',
    back: '← Other ways',
    cancel: 'Cancel',
    preview: 'See the plan',
    policyLabel: 'Choose a policy',
    previewTitle: 'The shapes it would choose',
    planReady: 'The plan is ready',
    planReadyPrompt:
      '{variation} already has shapes chosen in this song. Put the plan beside them, or over them?',
    choiceLabel: 'Where to put the plan',
    newVariation: 'Into a new variation',
    newVariationHint: '{variation} stays as it is',
    over: 'Over {variation}',
    overHint: 'Replaces what is chosen there',
    defaultName: 'New voicings',
    editNote:
      'Either way it is an edit in the working copy: the save sheet shows what it chose, and discard undoes it.',
    write: 'Write the plan',
  },

  shape: {
    foreign: '{note}, not in the chord',
    title: 'Enter a shape',
    titleFor: 'Enter a shape for {chord}',
    help:
      'Click a fret to put a finger on it, and again to take it off. The row above the nut ' +
      'switches a string between open and not played.',
    frets: 'Frets {from} to {to}',
    towardsNut: 'Move the window towards the nut',
    upTheNeck: 'Move the window up the neck',
    sketch: 'Shape being entered: {shorthand}',
    unplayable: 'No hand for this',
    empty: 'Nothing on any string yet.',
    clear: 'Clear',
    cancel: 'Cancel',
    save: 'Use this shape',
  },

  print: { legend: 'Chord shapes used' },

  confirm: { cancel: 'Cancel', confirm: 'Delete' },

  install: {
    title: 'Add Explore Chords to your home screen',
    label: 'Install this app',
    promptHelp: 'It opens like an app and keeps working with no network — handy in a lesson.',
    iosHelp:
      'Tap Share, then "Add to Home Screen". It then opens like an app and keeps working with no network.',
    install: 'Install',
    notNow: 'Not now',
    gotIt: 'Got it',
    never: "Don't ask again",
  },

  // The PWA update notice (shell.pwa): a quiet, dismissible status that a new
  // version is waiting. `reload` takes it now; `dismiss` hides the notice and
  // the update applies on the next launch.
  update: {
    ready: 'A new version is ready.',
    reload: 'Reload now',
    dismiss: 'Dismiss',
  },

  announce: {
    whatsNew: "What's new",
    showTutorial: 'Show the tutorial',
    letsGo: "Let's go",
    close: 'Close',
    sinceLast: 'What changed since your last visit',
  },

  announcements: {
    welcome: {
      title: 'Welcome to Explore Chords',
      sections: [
        {
          heading: 'Find a chord',
          text:
            'Type it the way you write it — C7M, Cmaj7 or C∆7 all work — and every way to play ' +
            'it on your instrument appears, grouped by where the hand sits and easiest first. ' +
            'When a symbol could mean two things, a chip says which reading was taken and ' +
            'lets you flip it.',
        },
        {
          heading: 'Your instrument comes first',
          text:
            'The switcher in the header moves between the instruments you have set up. Each ' +
            'keeps its own tuning and its own voicing rules; the Instrument screen is where ' +
            'you edit them, and where a bass and a ukulele are allowed to want different things.',
        },
        {
          heading: 'Save the shapes you like',
          text:
            'Star any shape and it goes to Saved. Later, a chord you have a saved shape for ' +
            'takes that shape automatically when it first appears in a song.',
        },
        {
          heading: 'Write songs as text',
          text:
            'Under Songs, a chart is plain text: a line starting with # names a section, a ' +
            'vertical bar starts a new measure, spaces separate chords in one. Click any chord ' +
            'to choose how it is played; the choice is written back into the text after a --- ' +
            'rule, one block per tuning, so the same song serves every instrument.',
        },
        {
          heading: 'It works without a signal',
          text:
            'Once loaded, everything runs on your device. Add it to your home screen and take ' +
            'it into a lesson with no network at all.',
        },
      ],
    },
    '0.2.0': {
      title: 'What changed in 0.2',
      sections: [
        {
          heading: 'One song, every instrument',
          text:
            'A song no longer belongs to one instrument. Its voicings are kept per tuning, ' +
            'after a --- rule in the text, so the same chart plays on your guitar and your ' +
            'ukulele with each keeping its own shapes. Songs saved in the earlier form convert ' +
            'on their own, and separate per-instrument copies of one song fold into one.',
        },
        {
          heading: 'Chords you have not chosen a shape for still have one',
          text:
            'They take the shape the chord screen would show first, marked as a default. ' +
            'Choose only the ones that need it.',
        },
        {
          heading: 'Saved shapes flow into songs',
          text:
            'A shape you have starred is used the moment its chord first enters a song, if it ' +
            'differs from the default.',
        },
        {
          heading: 'B° means the seventh',
          text:
            'A bare ° now reads as the diminished seventh, which is what the symbol means in ' +
            'practice; the word dim is the triad, and a chip offers the other reading.',
        },
      ],
    },
    '0.3.0': {
      title: 'What changed in 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'The app now speaks Brazilian Portuguese, Latin American Spanish and Italian as ' +
            'well as English. It follows your browser’s language; the selector in the header changes ' +
            'it, and the choice is remembered on this device.',
        },
        {
          heading: 'Charts line up',
          text:
            'On screen and in print, the measures of a section sit in columns, the way a ' +
            'hand-written chart does, and the printed sheet leads with the chart and keeps ' +
            'the shapes small below it.',
        },
      ],
    },
    '0.4.0': {
      title: 'What changed in 0.4',
      sections: [
        {
          heading: 'Strumming or fingerstyle',
          text:
            'The rules that used to be called Standard are now Strumming, and Fingerstyle sits ' +
            'beside them. A picking hand can simply not pick the string in the middle of a ' +
            'chord, so fingerstyle allows shapes strumming cannot reach. Setting up an ' +
            'instrument now asks which you play, and the instrument screen changes it later.',
        },
        {
          heading: 'No more shapes muted for nothing',
          text:
            'A shape is no longer offered when the same shape with one of its muted strings ' +
            'ringing is on offer too and the fingers that fill it go down easily. G minor gives ' +
            'you 3x0333, where the D string rings, instead of 3xx333, where it is damped for ' +
            'no reason, and open C is offered whole rather than as fragments of itself. A ' +
            'reach or a barre still counts as work, so the shapes that need one are all still ' +
            'there. A muted string in the middle also stopped counting against how hard a shape ' +
            'is: played fingerstyle, a string you do not pick costs you nothing.',
        },
      ],
    },
    '0.5.0': {
      title: 'What changed in 0.5',
      sections: [
        {
          heading: 'Songs with their words',
          text:
            'A song can now be written the way a cifra is: a line of chords over the line it ' +
            'is sung to, each chord above the syllable it falls on. Paste one in and it reads ' +
            'as one, with [Intro] and Intro: naming sections the way # already does. The words ' +
            'come with it onto the printed sheet, which now takes two columns where the song ' +
            'is narrow enough — usually halving the pages. On a phone a verse wraps instead ' +
            'of running off the side.',
        },
        {
          heading: 'Charts are untouched',
          text:
            'A song with no words under its chords reads exactly as it did before. Where a ' +
            'line could be either, a vertical bar makes it a chart and a leading > makes it ' +
            'words — which is the only way to settle a verse that really does read "A", ' +
            'against the chord of the same name.',
        },
      ],
    },
    '0.6.0': {
      title: 'What changed in 0.6',
      sections: [
        {
          heading: 'A song opens to be read',
          text:
            'A song now has a page of its own that shows it as it will come out on paper — ' +
            'the words under the chords, and the shapes you play from — rather than opening ' +
            'the editor. The text is still a button away, and the song list offers both.',
        },
        {
          heading: 'One page at a time',
          text:
            'That page is broken into pages the size of your screen, so you can see where the ' +
            'song runs past the end of one. The arrows in the corner turn them, and land a ' +
            'whole page in the clear, which makes playing from a screen a page turn rather ' +
            'than a scroll. Their middle straightens the page up again after a scroll by ' +
            'hand, and the bar at the top no longer takes a strip of the window with it.',
        },
        {
          heading: 'Cifras read better',
          text:
            'Brackets around a run of chords mark a repeat and are no longer read as chords. ' +
            'Chords that carry on past the end of a line keep the spacing they were written ' +
            'with. And a verse that wraps onto a line of one word is read as words, not as a ' +
            'chord nobody recognises.',
        },
      ],
    },
    '0.7.0': {
      title: 'What changed in 0.7',
      sections: [
        {
          heading: 'Save everything to a file',
          text:
            'Everything you have is kept in this browser, which is fine until the device is ' +
            'not. The instrument screen now saves the lot as one zip — your instruments and ' +
            'their rules, your settings, your saved shapes and every song — and restores it ' +
            'here or on another device.',
        },
        {
          heading: 'Your songs are text files',
          text:
            'Inside the zip each song is a plain text file you can read or edit with anything. ' +
            'Drop another one into the songs folder with any zip tool and it comes back as a ' +
            'song, named after its file. A backup is yours to keep, not a format only this app ' +
            'can make sense of.',
        },
      ],
    },
    '0.8.0': {
      title: 'What changed in 0.8',
      sections: [
        {
          heading: 'A reminder to back up',
          text:
            'Backup has a screen of its own now, and the song list speaks up when songs are ' +
            'in no backup — because a new Android phone does not bring them across, and a ' +
            'browser that clears its data takes them with it. On a phone, saving hands the ' +
            'file to the share sheet, which is where Drive, Files and iCloud are.',
        },
        {
          heading: 'Pages fill down before across',
          text:
            'Reading a song, a column now runs to the foot of the page before any of the song ' +
            'goes beside it. A few verses on a wide screen used to come out as one line across ' +
            'the top of an otherwise empty page. A second column is a page saved, not width to ' +
            'be used up.',
        },
        {
          heading: 'Chords keep their own brackets',
          text:
            'Em7(b5), A7(b13) and C7(9) were being read as a chord called Em7(b5 with a stray ' +
            'bracket beside it, because brackets also mark a repeat. Only a bracket that ' +
            'nothing closes, or that nothing opened, is a repeat mark now.',
        },
      ],
    },
    '0.9.0': {
      title: 'What changed in 0.9',
      sections: [
        {
          heading: 'The repeat sign',
          text:
            'A chart can say % for a measure that carries on as before, and it is read as ' +
            'that rather than as a chord nobody recognises. It is shown the way you wrote it, ' +
            'not turned into the chord it stands for, and there is nothing to choose for it: ' +
            'the chord it repeats already has its shape where it was written.',
        },
      ],
    },
    '0.10.0': {
      title: 'What changed in 0.10',
      sections: [
        {
          heading: 'Every diagram the same size',
          text:
            'A shape that sits up the neck carries a fret number, and the room for it used to ' +
            'make that diagram wider than the rest, leaving a row of them ragged and each grid ' +
            'off-centre under its name. Every diagram now reserves that room whether it needs ' +
            'it or not. The fret number is bigger too, and so are the diagrams on a printed ' +
            'sheet, which were too small to read from a music stand.',
        },
        {
          heading: 'What a shape actually sounds',
          text:
            'A chord name says what the harmony is. The shape decides which of its notes ends ' +
            'up lowest, and whether the root is played at all. Where the two differ, the name ' +
            'now carries a quiet note of what you are really holding: a Gm7 with its third ' +
            'underneath reads Gm7/Bb. It matters most when another instrument has the bass, ' +
            'because then taking a different inversion is the arrangement rather than an ' +
            'accident.',
        },
        {
          heading: 'The voicing wizard',
          text:
            'A button above the chart chooses shapes for the whole song at once. Three ways ' +
            'so far: the smoothest path for the hand, down at the nut, or the six-string’s ' +
            'part in a choro regional alongside a seven-string. It shows what it would do ' +
            'before anything changes, and each one explains its own rules and cites its own ' +
            'sources under "How it works".',
        },
        {
          heading: 'Or name the chart by what you play',
          text:
            'A checkbox on the reading page names the chords in the chart by what the chosen ' +
            'shapes actually sound, so Gm reads Gm/Bb where its shape puts the third ' +
            'underneath. Off by default, since a chart names the harmony. It reaches the ' +
            'printed sheet too, because that is the same renderer.',
        },
      ],
    },
    '0.11.0': {
      title: 'What changed in 0.11',
      sections: [
        {
          heading: 'Enter a shape by clicking it',
          text:
            'The list of shapes for a chord is what the search found, which is no help when ' +
            'you already know what you want to play and it is not there. Both ways of ' +
            'choosing a voicing now also offer a diagram big enough to click: a fret to put a ' +
            'finger on it, again to take it off, the row above the nut to switch a string ' +
            'between open and not played. It starts from the shape in effect, or from nothing, ' +
            'and it will let you save a stretch it cannot find fingers for — a shape can be ' +
            'right and awkward. Underneath are the notes it holds, with any note from outside ' +
            'the chord marked.',
        },
        {
          heading: 'Shapes go down the page on a phone',
          text:
            'A song\u2019s shapes and your saved ones were laid out in one row that scrolled ' +
            'sideways, which left seven of eight off the edge of a screen with the whole page ' +
            'height going spare. They wrap now. The chord results still scroll sideways, ' +
            'because those are ranked and the first one in the row is the answer.',
        },
        {
          heading: 'Fewer pages when reading a song',
          text:
            'A song whose chart lines are wider than a phone screen came out with a page per ' +
            'section heading and its shapes cut off the side. The chart now takes the one page ' +
            'it needs, and the shapes carry on across pages instead of being clipped.',
        },
      ],
    },
    '0.12.0': {
      title: 'What changed in 0.12',
      sections: [
        {
          heading: 'Bar numbers',
          text:
            'Transcribing from a score often means rewriting its structure: a repeat gets ' +
            'written out straight, because that reads better to play from. The chart\u2019s bars ' +
            'then stop matching the score\u2019s numbers, and \u201cfrom bar 9\u201d has to mean bar 9 of ' +
            'the score. So bars count on their own, and @9 at the start of a measure says what ' +
            'number that bar really is — on a heading too, as # A @9. The numbers run in the ' +
            'margin of the reading page, and on the printed sheet with it. Off until you ask ' +
            'for them, and not offered for a song with words in it, where a chord can last ' +
            'four bars or half of one and the text does not say which.',
        },
        {
          heading: 'The way to enter a shape is findable',
          text:
            'A chord has as many shapes as it has — forty-three for a C on a guitar — and the ' +
            'buttons sat under that list, which on a phone put every one of them past the ' +
            'bottom of the screen. They are above the list now, under the title.',
        },
      ],
    },
    '0.13.0': {
      title: 'What changed in 0.13',
      sections: [
        {
          heading: 'More than one way to play the same song',
          text:
            'A song used to hold one set of shapes per instrument. Now it can hold several — ' +
            'an easy version and a fuller one, or two runs of the wizard kept side by side to ' +
            'compare. The word before the colon on a voicings heading names the variation, so ' +
            '“# Up the neck: E2, A2, …” is a variation called Up the neck. Add one above the ' +
            'shapes, starting from the one you are in or from nothing, and switch between ' +
            'them there or on the reading page. A chord a variation says nothing about sits on ' +
            'its default, exactly as before.',
        },
        {
          heading: 'A stray “null” is gone',
          text:
            'The reading page of a song with words in it printed the word null under the ' +
            'title, and so did the shapes panel of a song with no chords yet. Both are fixed, ' +
            'along with the reason they happened at all.',
        },
      ],
    },
    '0.14.0': {
      title: 'What changed in 0.14',
      sections: [
        {
          heading: 'The choro wizard asks how you want it played',
          text:
            'Some questions in this style have no right answer, only a preference. When the ' +
            'seven-string walks up a semitone — F to F♯, under a bar of F and a bar of F♯° — a ' +
            'third above it is A both times, so the six-string takes the same bass note twice. ' +
            'A chorão might do exactly that, or drop to a third below instead. Both are in the ' +
            'literature. That choice now sits beside the shapes: turn it and watch the whole ' +
            'song answer. The “How this chooses” list turns with it, so what it says is always ' +
            'what it is about to do.',
        },
        {
          heading: 'Chords it used to leave blank',
          text:
            'A dominant with its seventh in the bass — C7/B♭ on its way to F — came back with ' +
            'no shape at all. There is a documented answer: the six-string goes a third BELOW ' +
            'the other guitar and rests on the fifth, C7/G. It plays that now. Cm7 was quietly ' +
            'missing its third for a related reason. And a dominant can now be played as three ' +
            'notes with the thumb up on the fourth string, which is the style’s other texture ' +
            'and was simply absent here.',
        },
        {
          heading: 'Diminished chords keep their tritone',
          text:
            'Asked for F♯°, the wizard gave four strings with no tritone in them and one of ' +
            'those spent doubling a note. The fifth is the note this style drops — but not when ' +
            'it is a flat fifth, which is the note that makes a diminished chord diminished. It ' +
            'stays now, and so does the sharp fifth of an augmented chord.',
        },
        {
          heading: 'One chord, two shapes, where the song wants them',
          text:
            'The wizard chose one shape per chord for a whole song. It can now give the same ' +
            'chord a different shape in a different bar where its policy calls for one, and ' +
            'writes the footnote marker itself. The preview shows the song as it will actually ' +
            'be — the shapes it will carry, and how many bars each one covers — so a chord it ' +
            'has split in two is something you see before you accept it rather than after.',
        },
      ],
    },
    '0.15.0': {
      title: 'What changed in 0.15',
      sections: [
        {
          heading: 'A dissertation we could not find last time',
          text:
            'The choro wizard follows written sources, and the one work devoted entirely to ' +
            'the six-string’s part — José Paulo Becker on the Época de Ouro, 1996 — was not ' +
            'to be had. It turned up. Everything below comes out of reading it, which is why ' +
            'this release corrects things 0.14 had only half right. It is now listed under ' +
            '“Where this comes from” with the rest.',
        },
        {
          heading: 'The question it asks you is a better one now',
          text:
            'It used to ask what to do when the third above the other guitar repeated the ' +
            'note you had just played. No source asks that — and Becker, who documents this ' +
            'part in detail, never has the six-string go below the seven-string at all. So ' +
            'the question is now the one the literature does ask: when no third above the ' +
            'other guitar is in the chord, do you want a sixth and then an octave, or the ' +
            'third below? C7/B♭ on its way to F is the case, and you can hear both.',
        },
        {
          heading: 'It reaches the top string, and stays in its own register',
          text:
            'Two sources disagree about where the fingers go, and the one transcribing actual ' +
            'performances won. Becker’s Época de Ouro guitar uses the first string constantly ' +
            '— a D minor as D under A, D and F, straight across the top four — so the wizard ' +
            'now offers those shapes. Measuring his transcriptions also gave the register the ' +
            'part really sits in, never below the open sixth string and mostly between G and ' +
            'the D above it, and the wizard now keeps to it instead of drifting up the neck.',
        },
        {
          heading: 'And one thing deliberately left as it was',
          text:
            'The three-note dominant with the thumb on the fourth string, new in 0.14, rests ' +
            'on a single source. Becker never mentions dropping a string, and his ' +
            'transcriptions show four voices in that position. So the shape is still offered ' +
            'and is no longer preferred. Where “How it works” tells you something rests on ' +
            'one source, or on our reading rather than theirs, it now says so.',
        },
      ],
    },
  },

  instr: {
    chip: {
      change: '{label}, change instrument',
      description: '{catalogue}, {tuning} tuning: {pitches}',
      descriptionCustom: '{catalogue}, custom tuning: {pitches}',
    },
    roster: {
      title: 'Instruments',
      inUse: 'in use',
      reentrant: 're-entrant',
      strings: { one: '{count} string', other: '{count} strings' },
      open: 'Open {label}',
      add: 'Add instrument',
      addMeta: 'catalogue, a tuning, a name',
      footer:
        'The one in use shapes every chord the app shows. Switching re-derives them everywhere — one tap. One instrument in use at a time.',
      close: 'Close',
      back: 'Back',
    },
    add: {
      title: 'Add instrument',
      cancel: 'Cancel',
      instrument: 'Instrument',
      tuning: 'Tuning',
      tuningGroup: 'Choose a tuning',
      custom: 'Custom…',
      customOption: 'Custom tuning',
      customPlaceholder: 'E2 A2 D3 G3 B3 E4',
      tuningHelp:
        'The tuning is the instrument’s identity — the same spelling a song’s voicing block uses (cifra.md §6). A capo is a tuning; there is no capo field.',
      name: 'Name',
      howYouPlay: 'How you play',
      howYouPlayHelp: 'The preset. Tune the individual rules later, on the instrument’s screen.',
      submit: 'Add instrument',
      badTuning: 'That tuning does not read: {reason}',
    },
    detail: {
      use: 'Use this instrument',
      inUse: 'in use',
      definition: 'Definition',
      edit: 'Edit',
      catalogue: 'Catalogue',
      tuning: 'Tuning',
      frets: 'Frets',
      voicingRules: 'Voicing rules',
      editRules: 'Edit rules',
      remove: 'Remove instrument',
    },
    rules: {
      title: 'Voicing rules',
      preset: 'Preset',
      presetGroup: 'Voicing preset',
      reset: 'Reset to {preset}',
      explainer:
        'Editing any rule turns the preset to Custom and keeps it exactly. An instrument that still names a preset is rebuilt from it when it loads; a Custom set is not.',
      rules: 'Rules',
      limits: 'Limits',
      costs: 'Costs',
      noBass:
        'Root in bass is forced off on an instrument with no bass register — a ukulele, a cavaquinho — so switching it to Jazz cannot re-break it.',
      on: 'on',
      off: 'off',
      toggleLabel: '{label}, {state}',
      rule: {
        requireRoot: 'Root required',
        rootInBass: 'Root in bass',
        requireThird: 'Third required',
        omitFifth: 'Fifth may be omitted',
        allowRootless: 'Rootless allowed',
        requireExtensions: 'Extensions required',
        allowBarre: 'Barre allowed',
        allowInnerMutes: 'Inner mutes allowed',
        allowDoubling: 'Doubling allowed',
        allowDuplicatePitch: 'Duplicate pitch allowed',
      },
      limit: {
        maxSpan: 'Max span',
        maxSpanUnit: 'frets',
        minSoundingStrings: 'Min sounding strings',
        maxResultsPerGroup: 'Shapes per group',
      },
    },
    shapes: {
      heading: 'My shapes · {tuning}',
      saved: { one: '{count} saved', other: '{count} saved' },
      empty: 'No shapes saved for this tuning yet. Star one in the explorer.',
      footer:
        'Starred one at a time in the explorer (workflow 16); reviewed and removed here. Never written into a song.',
      remove: 'Remove your shape for {chord}, {shorthand}',
    },
    remove: {
      title: 'Remove {label}?',
      shapes: { one: 'Its {count} saved shape', other: 'Its {count} saved shapes' },
      body:
        '{shapes} and the song variations in use for {tuning} are removed with it. Your songs keep their own voicings — only this instrument’s own settings go.',
      cancel: 'Cancel',
      confirm: 'Remove',
    },
  },
};
