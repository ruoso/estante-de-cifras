/**
 * Italiano.
 *
 * Il lessico di chi insegna chitarra: tasto, barré, corda a vuoto,
 * diteggiatura, battuta. "Voicing" resta in inglese, come si usa davvero.
 */
export default {
  app: { name: 'Estante de Cifras', wordmark: 'Estante' },

  ordinal: { other: '{n}ª' },

  locale: { label: 'Lingua' },

  header: {
    help: 'Aiuto',
    helpLabel: 'Aiuto e novità',
  },

  shell: {
    nav: 'Destinazioni',
    search: 'Cerca',
    books: 'Libri',
    setlists: 'Scalette',
  },

  // La schermata di gestione dei libri (books.shelf, flusso 7). `{name}` è il
  // titolo di un libro; `{count}` il numero di salvataggi in attesa di sincronia.
  books: {
    // A book with no shelf label and no README heading — never its id
    // (songs.no_raw_ids Constraint 3).
    untitled: 'Libro senza titolo',
    back: 'Indietro',
    add: 'Aggiungi libro',
    addTitle: 'Aggiungi un libro',
    close: 'Chiudi',
    nameLabel: 'Nome del libro',
    namePlaceholder: 'Dai un nome al libro',
    newBookHelp: 'Un nome e un libro vuoto. Senza account.',
    create: 'Nuovo libro',
    byLink: 'Tramite link',
    byLinkMeta: 'Incolla un link a un libro su Estante.',
    byLinkLabel: 'Link del libro',
    byLinkPlaceholder: 'https://…/i/…',
    byLinkOpen: 'Apri',
    byLinkInvalid: 'Questo non è un link a un libro.',
    mineOnEstante: 'I miei su Estante',
    mineMeta: 'I tuoi libri non ancora su questo scaffale.',
    mineSignedOut: 'Accedi per vederli.',
    mineSignInPasskey: 'Accedi con una passkey',
    mineEmailLink: 'Nessuna passkey qui? Mandami un link via email',
    mineAdd: 'Aggiungi',
    mineAddLabel: 'Aggiungi {name}',
    mineLeave: 'Esci',
    mineLeaveLabel: 'Esci da {name}',
    mineEmpty: 'Tutti i tuoi libri sono già su questo scaffale.',
    mineError: 'Non è stato possibile raggiungere Estante. Riprova.',
    uploadRow: 'Carica',
    uploadRowMeta: 'Uno zip di un libro, con o senza la sua cronologia.',
    uploadTitle: 'Carica {name}',
    uploadCancelSurface: 'Annulla il caricamento',
    uploadWhatToDo: 'Cosa farne',
    uploadWhatToDoLabel: 'Cosa fare con il caricamento',
    uploadAsNew: 'Importa come nuovo libro',
    uploadMerge: 'Unisci a un libro esistente',
    uploadMergeInto: 'Unisci a',
    uploadNoTargets: 'Non hai ancora libri in cui puoi salvare. Importalo come nuovo libro.',
    uploadBranch:
      'Dal ramo {branch} dello zip. Le modifiche nello zip mai salvate vengono lette come un salvataggio in più: modifiche dal caricamento, fatte da te.',
    uploadSongs: 'Canzone per canzone',
    uploadAdded: 'aggiunta',
    uploadChanged: 'modificata',
    uploadConflict: 'conflitto',
    uploadReplace: 'sostituisci',
    uploadUnresolved: 'irrisolto',
    uploadUnresolvedHelp: 'unione irrisolta: risolvila prima di importare',
    uploadMarkerLine: 'primo marcatore alla riga {line}',
    uploadKeep: 'Sostituisci «{name}» con la versione caricata',
    uploadLeftOutTitle: 'Lasciati fuori',
    uploadLeftOutBody:
      'Un libro contiene canzoni, scalette e il suo README, quindi questi restano fuori.',
    uploadCanonTitle: 'Messo in forma canonica',
    uploadCanonBody: 'Le diteggiature vengono messe in ordine canonico; la griglia resta come scritta.',
    uploadMarkersTitle: 'Un’unione non finita nella cronologia',
    uploadMarkersBody:
      'Il commit {commit} ha lasciato marcatori di conflitto in {path}. Risolvilo sul computer e ricarica.',
    uploadMarkersLatest: 'Importa l’ultima versione senza la sua cronologia',
    uploadConfirmCaption: 'Non viene scritto nulla finché non confermi.',
    uploadConflictCaption: 'Il conflitto va alla risoluzione.',
    uploadConfirmNew: 'Importa come nuovo libro',
    uploadConfirmMerge: 'Unisci e salva',
    uploadBadZip: 'Non è stato possibile leggere quel file come zip di un libro.',
    uploadFailed: 'Non è stato possibile completare l’importazione. Non è stato scritto nulla.',
    cancel: 'Annulla',
    save: 'Salva',
    onDevice: 'Su questo dispositivo',
    onEstante: 'Su Estante',
    canSave: 'puoi salvare',
    reader: 'lettore',
    renameLabel: 'Rinomina {name}',
    renameTitle: 'Rinomina “{name}”',
    renameField: 'Nome nella tua libreria',
    empty: 'Ancora nessun libro. Aggiungi un libro per iniziare.',
    syncing: 'sincronizzazione',
    savesWaiting: {
      one: '{count} salvataggio in attesa di caricamento',
      other: '{count} salvataggi in attesa di caricamento',
    },
    needsYou: 'richiede attenzione',
    offline: 'offline da {time}',
    offlineUnknown: 'offline',
    noLongerShared: 'non più condiviso con te',
    // books.fork (workflow 11): le righe della copia propria sullo scaffale.
    cannotSaveHere: 'non puoi salvare qui',
    fromOriginal: 'da {original}',
    originalNewSaves: {
      one: '{original} ha {count} modifica nuova.',
      other: '{original} ha {count} modifiche nuove.',
    },
    originalNoLongerShared: 'originale non più condiviso',
    bringIn: 'Portale qui',
    bringInLabel: 'Porta qui le modifiche di {original}',
    bringInTitle: 'Porta qui le modifiche di {original}',
    bringInBody: {
      one: '{count} modifica nuova in {original} dall’ultima volta che le hai portate qui. Niente viene scritto in {book} finché non confermi.',
      other: '{count} modifiche nuove in {original} dall’ultima volta che le hai portate qui. Niente viene scritto in {book} finché non confermi.',
    },
    bringInFetching: 'Recupero delle modifiche nuove di {original}…',
    bringInNote: 'Nota',
    bringInNotePrefill: 'Porta le modifiche di {original}: {titles}',
    bringInNotePrefillEmpty: 'Porta le modifiche di {original}',
    bringInConflict: {
      one: '{songs} incontra le tue modifiche. Dopo la conferma lo sistemerai un conflitto alla volta; il resto entra subito.',
      other: '{songs} incontrano le tue modifiche. Dopo la conferma li sistemerai un conflitto alla volta; il resto entra subito.',
    },
    bringInCaption: 'Unisce alla tua copia, salva e invia a Estante.',
    bringInNotNow: 'Non ora',
    bringInBusy: 'Le sto portando qui…',
    bringInStale: 'Qualcosa è cambiato da questa anteprima, quindi è stata rifatta. Controllala, poi portale qui.',
    bringInOffline: 'Portarle qui richiede la rete. Non è cambiato niente: connettiti e riprova.',
    originalGoneTitle: 'L’originale non è più condiviso con te.',
    originalGoneBody:
      'Questo libro smette di seguire {original}; le modifiche sono state portate qui l’ultima volta il {date}. Nient’altro cambia: la tua copia, la sua cronologia e i suoi brani sono tutti qui, e salvi, condividi e sincronizzi come prima.',
    originalGoneBodyUndated:
      'Questo libro smette di seguire {original}. Nient’altro cambia: la tua copia, la sua cronologia e i suoi brani sono tutti qui, e salvi, condividi e sincronizzi come prima.',
    forkedNote:
      '{book} ora è tuo: ha preso il posto dell’originale sul tuo scaffale, così ogni canzone compare una volta nella ricerca.',
    syncNow: 'Sincronizza ora',
    notInStep: 'Alcuni libri non sono allineati',
    // Lo scaffale che si riempie su un nuovo dispositivo (account.new_device).
    restoredTitle: 'Libro di casa ripristinato.',
    restoredBody: 'Strumento, notazione e lingua sono impostati.',
    restoredDismiss: 'Chiudi',
    restoredDismissLabel: 'Chiudi l’avviso del libro di casa',
    yourShelf: 'Il tuo scaffale',
    yourShelfCount: { one: '{count} libro', other: '{count} libri' },
    fillReady: 'pronto',
    fillCloning: 'in download {percent}%',
    fillWaiting: 'in attesa',
    fillReadyMeta: { one: '{count} brano · ricercabile', other: '{count} brani · ricercabili' },
    fillCloningMeta: 'brani ricercabili man mano che arrivano',
    fillWaitingMeta: 'il prossimo in coda',
    fillProgressLabel: 'Porto {name} su questo dispositivo',
    onlyOn: 'Solo sul tuo {device}: {title}',
    onlyOnOther: 'Solo su un altro dispositivo: {title}',
    onlyOnHelp: 'Mettilo online lì per averlo qui.',
    // Il dettaglio di ogni libro (books.online, workflow 7 L46-63, L128-137; W07).
    // A book's songs (books.row_opens_songs; workflow 7 §A book's songs): the
    // bar's Manage and Settle, and the detail's Back, Rename and Files card.
    manage: 'Gestisci',
    manageLabel: 'Gestisci {book}',
    settle: 'Risolvi',
    settleLabel: 'Risolvi i conflitti in {book}',
    backToBook: 'Torna a {book}',
    rename: 'Rinomina',
    filesBody: 'Tutti i file del libro, così come sono salvati.',
    private: 'privato',
    sharedBy: 'condiviso da {owner}',
    shared: 'condiviso',
    youOwn: 'È tuo',
    youCanSave: 'Puoi salvare',
    readOnly: 'Sola lettura',
    putOnline: 'Metti online',
    putOnlineBody:
      'Solo su questo dispositivo: nessun altro può vederlo. Mettilo online per invitare persone — fino a 50.',
    putOnlineConfirmTitle: 'Mettere {name} online?',
    putOnlineConfirmBody:
      'Va su Estante come privato: solo tu puoi aprirlo. Nessun altro lo vede finché non inviti qualcuno da Condividi — fino a 50 persone.',
    putOnlineQuota: 'Il tuo account è pieno. Rimuovi un libro o libera spazio, poi riprova.',
    putOnlineSignedOut: 'Accedi per mettere un libro online.',
    putOnlineOffline: 'Sei offline. Connettiti e mettilo online.',
    putOnlineError: 'Impossibile metterlo online. Riprova.',
    lostAccessTitle: 'Non più condiviso con te',
    lostAccessBody:
      'Questo libro non è più condiviso con te, quindi non verrà più sincronizzato. Non si perde nulla: la tua copia, la sua cronologia e i suoi brani sono tutti qui da leggere, e i salvataggi non ancora su Estante restano su questo dispositivo. Scaricalo, oppure rendilo tuo per continuare a salvare.',
    takenDownTitle: 'Questo libro è stato rimosso',
    download: 'Scarica',
    downloadBody:
      'Uno zip di questo libro com’è su questo dispositivo: ogni brano e scaletta con tutta la sua cronologia, e le modifiche non salvate così come sono. Caricalo per riavere il libro.',
    remove: 'Rimuovi dalla mia libreria',
    removeBody: 'Cancella solo la copia di questo dispositivo. Il libro resta su Estante.',
    removeTitle: 'Rimuovere “{name}” da questo dispositivo?',
    removeLoss: {
      one: 'Questo dispositivo ha {count} salvataggio non ancora su Estante; rimuovere questa copia lo perde. Il libro resta su Estante.',
      other:
        'Questo dispositivo ha {count} salvataggi non ancora su Estante; rimuovere questa copia li perde. Il libro resta su Estante.',
    },
    removeUnsaved: {
      one: '{count} brano con modifiche non salvate andrà perso',
      other: '{count} brani con modifiche non salvate andranno persi',
    },
    removeGone:
      'Questo libro è solo su questo dispositivo. Rimuoverlo lo cancella per sempre — non c’è copia su Estante. Scaricalo prima per conservarne una copia.',
    removeConfirm: 'Rimuovi dalla mia libreria',
    delete: 'Elimina il libro',
    deleteBody: 'Lo elimina da Estante, per tutti. Solo il proprietario può.',
    deleteTitle: 'Eliminare {name} da Estante?',
    deleteModalBody:
      'Questo elimina il libro, con tutta la sua cronologia, per tutti quelli con cui è condiviso. Non si può annullare.',
    deleteField: 'Digita il nome del libro per confermare',
    deleteConfirm: 'Elimina il libro',
    // Leaving one shared book (books.leave; workflow 10 §Leaving a book; Leave-book board).
    leave: 'Esci da questo libro',
    leaveBody: 'Smetti di seguirlo su tutti i tuoi dispositivi.',
    leaveOffline: 'Per uscire serve una connessione.',
    leaveOfflineBody: 'Non è cambiato nulla; sei ancora un membro.',
    leaveTitle: 'Uscire da {name}?',
    leaveSentence: 'Non potrai più aprirlo né sincronizzarlo, su nessuno dei tuoi dispositivi, e viene rimosso da questo. Il proprietario può invitarti di nuovo.',
    leaveSentenceRemote: 'Non potrai più aprirlo né sincronizzarlo, su nessuno dei tuoi dispositivi. Il proprietario può invitarti di nuovo.',
    leaveSentenceNamed: 'Non potrai più aprirlo né sincronizzarlo, su nessuno dei tuoi dispositivi, e viene rimosso da questo. {owner} può invitarti di nuovo.',
    leaveSentenceRemoteNamed: 'Non potrai più aprirlo né sincronizzarlo, su nessuno dei tuoi dispositivi. {owner} può invitarti di nuovo.',
    leaveUnsaved: {
      one: '{count} brano con modifiche non salvate andrà perso',
      other: '{count} brani con modifiche non salvate andranno persi',
    },
    leaveUnpushed: {
      one: '{count} salvataggio non ha raggiunto il libro e non lo raggiungerà mai',
      other: '{count} salvataggi non hanno raggiunto il libro e non lo raggiungeranno mai',
    },
    leaveUnpushedHelp: 'Rendilo tuo per tenerli come un tuo libro, con la sua cronologia; oppure scarica il libro com\'è su questo dispositivo.',
    leaveForkFirst: 'Rendilo mio prima',
    leaveDownloadFirst: 'Scarica prima',
    leaveConfirm: 'Esci dal libro',
    leaveFailed: 'Non sei uscito da {name}. Sei ancora un membro.',
    share: 'Condividi',
    // Le schede della copia propria nel dettaglio (books.fork, workflow 11).
    cannotSaveTitle: 'Non puoi salvare qui',
    cannotSaveBody: {
      one: '{count} modifica non può più andare a {book}: puoi leggerlo, ma non salvarci più.',
      other: '{count} modifiche non possono più andare a {book}: puoi leggerlo, ma non salvarci più.',
    },
    fork: 'Fai una copia',
    forkBody: 'La tua copia di {book}, con la sua storia, che continua a seguirlo.',
  },

  sharing: {
    shareTitle: 'Condividi {name}',
    close: 'Chiudi',
    back: 'Indietro',
    intro: 'Solo chi inviti può aprire questo libro, ognuno con il proprio account.',
    limitHint: 'Invita persone a leggere o modificare questo libro — fino a 50 persone.',
    memberIntroReader:
      'Condiviso con te da {owner}. Puoi leggere questo libro e tenerlo sullo scaffale; per modificarlo, rendilo tuo. Solo {owner} invita le persone. Gli altri lettori non sono elencati.',
    memberIntroEditor:
      'Condiviso con te da {owner}. Puoi leggere questo libro e salvarvi. Solo {owner} invita le persone. Gli altri lettori non sono elencati.',
    itsOwner: 'chi lo possiede',
    loading: 'Caricamento…',
    retry: 'Riprova',
    people: 'Persone',
    peopleTitle: '{book} · Persone',
    sharingTitle: '{book} · Condivisione',
    countOfLimit: '{count} di {limit}',
    peopleOfLimit: {
      one: '{count} di {limit} persone',
      other: '{count} di {limit} persone',
    },
    besidesYou: {
      one: 'oltre a te · spazio per {count} in più',
      other: 'oltre a te · spazio per {count} in più',
    },
    noRoomLeft: 'nessuno spazio rimasto',
    peopleExplainer: 'Solo le persone elencate qui possono aprire {book}. Quando arriva a 50, gli inviti smettono di far entrare qualcuno.',
    roomForMore: {
      one: 'Spazio per {count} in più.',
      other: 'Spazio per {count} in più.',
    },
    full: '{name} è al completo. Gli inviti non ammettono più nessuno; rimuovi qualcuno per fare spazio.',
    stateFull: 'Al completo',
    reviewMembers: 'Rivedi i membri',
    members: 'Membri',
    invitations: 'Inviti',
    you: 'Tu',
    youNamed: '{name} (tu)',
    unnamedOwner: 'Chi possiede il libro',
    unnamedEditor: 'Editore senza nome',
    unnamedReader: 'Lettore senza nome',
    someoneUnnamed: 'Qualcuno senza nome',
    nobodyYet: 'Ancora nessuno',
    editorsCount: {
      one: '{count} editore',
      other: '{count} editori',
    },
    readersCount: {
      one: '{count} lettore',
      other: '{count} lettori',
    },
    invitationsCount: {
      one: '{count} invito',
      other: '{count} inviti',
    },
    ownerMeta: 'possiede questo libro',
    sharesMeta: 'condivide questo libro',
    editorMeta: 'salva in questo libro',
    readerMeta: 'legge questo libro',
    throughReader: 'tramite l’invito da lettore del {date}',
    throughEditor: 'tramite l’invito da editore del {date}',
    showMoreReaders: {
      one: 'Mostra altro {count} lettore',
      other: 'Mostra altri {count} lettori',
    },
    showFewerReaders: 'Mostra meno lettori',
    roleOwner: 'Proprietario',
    roleEditor: 'Editore',
    roleReader: 'Lettore',
    changeRole: 'Cambia il ruolo di {name}',
    changeRoleEditor: 'Cambia il ruolo di questo editore',
    changeRoleReader: 'Cambia il ruolo di questo lettore',
    makeEditor: 'Rendi editore',
    makeReader: 'Rendi lettore',
    remove: 'Rimuovi',
    removeTitle: 'Rimuovere {name}?',
    removeTitleEditor: 'Rimuovere questo editore?',
    removeTitleReader: 'Rimuovere questo lettore?',
    thisPerson: 'Questa persona',
    removeJoinedReader: '{name} fa parte del libro tramite il tuo invito da lettore del {date}.',
    removeJoinedEditor: '{name} fa parte del libro tramite il tuo invito da editore del {date}.',
    removeEffect:
      'La rimozione ha effetto la prossima volta che la sua app raggiunge Estante; gli altri membri non ne risentono.',
    removeStays: {
      one: 'Ciò che è già sul suo dispositivo resta lì. Non può essere richiamato. Il libro avrà spazio per {count} in più.',
      other: 'Ciò che è già sul suo dispositivo resta lì. Non può essere richiamato. Il libro avrà spazio per {count} in più.',
    },
    removeConfirm: 'Rimuovi {name}',
    removeConfirmUnnamed: 'Rimuovi',
    cancel: 'Annulla',
    invitePeople: 'Invita persone',
    newInvitation: 'Nuovo invito',
    songInvite: 'Invita qualcuno a questo brano',
    inviteIntro:
      'Un link, per quante persone vuoi inviarlo. Ognuna accede, o crea un account, e il libro va sul suo scaffale.',
    songShareIntro:
      'Un brano si condivide con il suo libro, {book}. Solo chi inviti può aprirlo, ognuno con il proprio account.',
    needsOnline: '{book} è solo su questo dispositivo. Mettilo online per invitare altre persone.',
    needsOnlineSignIn: 'Accedi per metterlo online',
    needsOnlinePutting: 'Lo sto mettendo online…',
    songInviteBody: 'L’invito la porta in {book} e apre su {song} una volta che ha effettuato l’accesso.',
    setlistShareIntro:
      'Una scaletta si condivide con il suo libro, {book}. Chiunque inviti entra in {book}; il link apre su {setlist}.',
    setlistInvite: 'Invita qualcuno a questa scaletta',
    setlistInviteBody: 'L’invito la porta in {book} e apre su {setlist} una volta che ha effettuato l’accesso.',
    role: 'Ruolo',
    roleHelp: 'I lettori leggono il libro e lo tengono sullo scaffale. Gli editori vi salvano anche.',
    expires: 'Scade',
    expiryDay: 'Un giorno',
    expiryWeek: 'Una settimana',
    expiryMonth: 'Un mese',
    expiryUntilWithdrawn: 'Finché non viene ritirato',
    limitToggle: 'Limita quante persone possono usarlo',
    limitHelp: 'Facoltativo. Imposta 1 per una sola persona.',
    limitField: 'Numero di usi',
    change: 'Cambia',
    changeTerms: 'Cambia la scadenza e gli usi',
    roomCallout: {
      one: '{book} ha spazio per {count} persona in più. Quando arriva a 50, questo link smette di far entrare qualcuno.',
      other: '{book} ha spazio per {count} persone in più. Quando arriva a 50, questo link smette di far entrare qualcuno.',
    },
    fullCallout: '{book} è al completo. Questo link non farà entrare nessuno finché non rimuovi qualcuno.',
    seeWhoJoins: 'Vedrai chi entra tramite esso, e puoi ritirarlo in qualsiasi momento.',
    createLink: 'Crea link',
    linkReady: 'Ecco il link. Invialo come preferisci; puoi copiarlo di nuovo finché può ancora far entrare qualcuno.',
    linkLabel: 'Link dell’invito',
    copy: 'Copia',
    copyLink: 'Copia link',
    copied: 'Copiato',
    couldNotCopy: 'Impossibile copiare',
    copyByHand: 'Seleziona il link e copialo.',
    done: 'Fatto',
    inviteRowTitle: 'Invito da {role}',
    stateOpen: 'aperto',
    stateWithdrawn: 'ritirato',
    stateUsedUp: 'esaurito',
    stateExpired: 'scaduto',
    openUntil: 'aperto fino al {date}',
    usesUsed: {
      one: '{count} uso, usato',
      other: '{count} usi, usati',
    },
    nobodyJoined: 'ancora nessuno è entrato',
    nameJoined: '{name} è nel libro',
    countJoined: {
      one: '{count} entrato',
      other: '{count} entrati',
    },
    termsDay: 'Scade tra un giorno',
    termsWeek: 'Scade tra una settimana',
    termsMonth: 'Scade tra un mese',
    termsUntilWithdrawn: 'Finché non viene ritirato',
    usesNoLimit: 'nessun limite di usi',
    usesLeft: {
      one: '{count} uso rimasto',
      other: '{count} usi rimasti',
    },
    withdraw: 'Ritira',
    withdrawNote:
      'Ritirare un invito impedisce a nuove persone di entrare tramite esso. Chi è già entrato resta membro.',
    joinedThrough: 'Entrati tramite esso:',
    joinedPeople: {
      one: '{count} persona: {names}',
      other: '{count} persone: {names}',
    },
    namesAndMore: {
      one: '{names} e altri {count}',
      other: '{names} e altri {count}',
    },
    joinedNobody: 'ancora nessuno',
    noInvitations: 'Ancora nessun invito.',
    songForMembers: 'Per chi è già nel libro',
    songForMembersBody: 'I membri aprono {name} al suo indirizzo.',
    songAddressLabel: 'Indirizzo del brano',
    setlistAddressLabel: 'Indirizzo della scaletta',
    manage: 'Gestisci',
    seePeople: 'Vedi chi',
    youAreEditor: 'Sei un editore',
    youAreReader: 'Sei un lettore',
    errNetwork: 'Sei offline, o Estante è irraggiungibile. Connettiti e riprova.',
    errForbidden: 'Solo il proprietario può farlo.',
    errNotFound: 'Questo libro non è disponibile.',
    errGeneric: 'Qualcosa è andato storto. Riprova.',
  },

  search: {
    label: 'Cerca brani, parole e accordi',
    placeholder: 'Brani, parole, accordi…',
    clearQuery: 'Cancella ricerca',
    clearFilter: 'Rimuovi filtro',
    scopeToBook: 'Cerca solo in {book}',
    instrument: 'strumento',
    explore: 'Esplora {query} sul tuo {instrument}',
    exploreMeta: 'tutti i modi di suonarlo, dal più facile',
    matching: 'Brani con “{query}”',
    recent: 'Recenti',
    books: 'Libri',
    empty: 'Nessun brano corrisponde a “{query}”.',
    // The no-match state (songs.editor_chrome; W03#1 L40-46; workflow 3 §Ways in):
    // `{books}` is the books searched, as a list in the active locale.
    noMatch: 'Nessun brano corrisponde',
    searchedIn: 'Cercato tra titoli, artisti, sezioni, parole e accordi in {books}.',
    pasteHint: 'Oppure incolla un brano intero, copiato da qualsiasi parte, in uno nuovo.',
    songCount: { one: '{count} brano', other: '{count} brani' },
    // The line under a book's section header when songs in it have unsaved
    // changes, Save all at its end (songs.search_book_head_narrow; workflow 2).
    unsavedCount: {
      one: '{count} brano con modifiche non salvate',
      other: '{count} brani con modifiche non salvate',
    },
    stillLoading: 'ancora in caricamento',
    voicedFor: 'con diteggiature per {instrument}',
    unsaved: 'non salvato',
    conflict: 'conflitto',
    where: '{book} · {folder}/',
    addToSetlist: 'Aggiungi {title} a una scaletta',
    setlist: 'Scaletta',
  },

  setlists: {
    title: 'Scalette',
    empty: 'Ancora nessuna scaletta. Aggiungi un brano a una scaletta dalla ricerca o dalla vista di lettura.',
    loading: 'Caricamento scalette…',
    failed: 'Non è stato possibile leggere le scalette su questo dispositivo.',
    retry: 'Riprova',
    songCount: { one: '{count} brano', other: '{count} brani' },
    back: 'Indietro',
    play: 'Riproduci',
    edit: 'Modifica',
    more: 'Altro',
    share: 'Condividi',
    done: 'Fatto',
    inKey: 'in {key}',
    missing: 'mancante',
    missingNotice: '{title} è mancante.',
    missingDetail: 'Non c’è più nulla in {path}, quindi viene saltato durante la riproduzione.',
    pointItAtASong: 'Puntala a un brano',
    addSong: 'Aggiungi brano',
    save: 'Salva',
    saveMessage: 'Modifica scaletta',
    discard: 'Annulla',
    unsaved: 'modifiche non salvate',
    notSavedYet: 'non ancora salvata',
    songsLabel: 'Brani · trascina per riordinare',
    keyNoteHint: 'La tonalità e la nota valgono solo in questa scaletta',
    dragToReorder: 'Trascina per riordinare',
    removeFromSetlist: 'Rimuovi {title} dalla scaletta',
    keyLabel: 'Tonalità di {title}',
    keyPlaceholder: 'Tonalità',
    noteLabel: 'Nota di {title}',
    notePlaceholder: 'Nota',
    notInBook: '{path} non è nel libro',
    pointHereTitle: 'Puntala a un brano in {book}',
    searchLabel: 'Cerca un brano',
    cancel: 'Annulla',
    pointHere: 'Punta qui',
    noResults: 'Nessun brano trovato.',
    alreadyIn: 'Già in questa scaletta · {places}',
    relativeNote: 'I link partono da {folder}, così continuano a funzionare ovunque vengano copiati i file del libro.',
    addToSetlistTitle: 'Aggiungi alla scaletta',
    newSetlist: 'Nuova scaletta…',
    pickerMeta: '{book} · {count}',
    copyNotice: 'Questo brano verrà prima copiato in {book}.',
    copyDetail: '{title} è in {other}, e una scaletta punta solo ai brani del proprio libro.',
    copyThenUnsaved: 'La copia e la modifica della scaletta restano come modifiche non salvate in {book}, salvate come qualsiasi altra.',
    thenUnsaved: 'La modifica della scaletta resta come modifica non salvata in {book}, salvata come qualsiasi altra.',
    add: 'Aggiungi',
    copyAndAdd: 'Copia e aggiungi',
    newSetlistTitle: 'Nuova scaletta',
    newSetlistNameLabel: 'Nome della scaletta',
    newSetlistNamePlaceholder: 'Nome della scaletta',
    newSetlistNoBook: 'Il libro di questa canzone è in sola lettura e I miei brani non è su questo dispositivo, quindi non c’è un libro in cui tenere una nuova scaletta.',
    create: 'Crea',
  },

  play: {
    stop: 'Interrompi',
    previous: 'Brano precedente',
    next: 'Brano successivo',
    position: '{i} di {n}',
    positionAwake: '{i} di {n} · schermo sempre acceso',
    inKey: 'In {key}',
    setlistKey: 'Tonalità della scaletta {key} · scritto in {songKey}',
    setlistKeyNote: 'Tonalità della scaletta {key}',
    nextHeading: 'Prossimo',
    nextItem: '{number}. {title}',
    note: 'Nota: {note}',
    hint: 'Scorri, tocca un bordo o usa un pedale',
    announce: '{title}, {i} di {n}',
    announceNext: 'Prossimo: {title}',
    empty: 'Questa scaletta non ha ancora brani da suonare.',
  },

  explorer: {
    title: 'Esplora un accordo',
    back: 'Torna alla ricerca',
    chord: 'Accordo',
    unreadable: '“{text}” non è un accordo che l’app sappia leggere.',
    group: {
      open: 'Vuote',
      fret: 'Tasto {position}',
      count: { one: '{count} forma', other: '{count} forme' },
    },
    showMore: 'Mostra altre {count}',
    showFewer: 'Mostra meno',
    star: 'Salva {chord}, {shorthand} come tua forma',
    unstar: 'La tua forma di {chord}, {shorthand} — rimuovi',
    notice: {
      readAs: 'Letto come {chord} — {reading}.',
      flip: 'Leggere come {chord}?',
      about: {
        sevenPlus:
          'Nella notazione brasiliana 7+ è la settima maggiore; nell’americana e nel Real Book è la quinta aumentata.',
        bareNine:
          'Nella notazione brasiliana un 9 da solo aggiunge la nona senza settima; nell’americana e nel Real Book include la settima minore.',
        degreeSign:
          'Un ° da solo si legge come la settima diminuita; la triade pura è l’altra lettura.',
        sevenFour:
          'Nella notazione brasiliana 7(4) sospende la terza; nell’americana e nel Real Book aggiunge la quarta sopra di essa.',
      },
    },
    empty: {
      title: 'Nessuna forma rispetta le regole',
      body:
        '{chord} chiede più note di quante {instrument} possa farne suonare con le tue regole di esecuzione. La ricerca non ha allentato le regole per forzarne una.',
      rules: 'Regole di esecuzione',
      hint: 'Consenti note omesse lì, oppure prova un accordo più semplice.',
    },
    enter: {
      name: 'Inserisci una forma',
      meta: 'posiziona le dita a mano e salvala',
      title: 'Inserisci una forma',
      nut: 'Lascia vuota o soffoca la corda {n}',
      muteString: 'Soffoca la corda {n}',
      openString: 'Lascia vuota la corda {n}',
      setFret: 'Corda {n}, tasto {fret}',
      help: 'Tocca una corda su un tasto per mettere un dito; tocca sopra il capotasto per soffocarla o lasciarla vuota.',
      readout: 'Note che contiene',
      fretMuted: 'soffocata',
      fretOpen: 'vuota',
      fretAt: 'tasto {fret}',
      notIn: 'non in {chord}',
      lowString: '{note} grave',
      highString: '{note} acuta',
      stringQualified: '{pitch} · {qualifier}',
      onString: 'la corda {name}',
      noteOnString: '{note} sul{string}',
      foreignOne: 'Il {which} non è in {chord}, che è {tones}. Puoi comunque scegliere questa forma.',
      foreignMany: 'Queste note non sono in {chord}, che è {tones}: {which}. Puoi comunque scegliere questa forma.',
      roles: {
        root: 'fondamentale',
        second: 'seconda',
        minorThird: 'terza minore',
        majorThird: 'terza maggiore',
        fourth: 'quarta',
        flatFifth: 'quinta diminuita',
        fifth: 'quinta',
        sharpFifth: 'quinta aumentata',
        sixth: 'sesta',
        diminishedSeventh: 'settima diminuita',
        minorSeventh: 'settima minore',
        majorSeventh: 'settima maggiore',
        flatNinth: 'nona minore',
        ninth: 'nona',
        sharpNinth: 'nona aumentata',
        eleventh: 'undicesima',
        sharpEleventh: 'undicesima aumentata',
        flatThirteenth: 'tredicesima minore',
        thirteenth: 'tredicesima',
      },
      degrees: {
        1: 'prima',
        2: 'seconda',
        3: 'terza',
        4: 'quarta',
        5: 'quinta',
        6: 'sesta',
        7: 'settima',
        8: 'ottava',
        9: 'nona',
        10: 'decima',
        11: 'undicesima',
        12: 'dodicesima',
        13: 'tredicesima',
      },
      alter: {
        flat: '{degree} bemolle',
        sharp: '{degree} diesis',
        doubleFlat: '{degree} doppio bemolle',
        doubleSharp: '{degree} doppio diesis',
      },
      unplayable: 'Questa forma non è suonabile così com’è, ma è conservata come disegnata.',
      star: 'Salva questa forma',
      cancel: 'Annulla',
    },
  },

  // Un nuovo dispositivo (account.new_device, workflow 13).
  newDevice: {
    kind: {
      iphone: 'iPhone',
      ipad: 'iPad',
      'android-phone': 'telefono Android',
      'android-tablet': 'tablet Android',
      mac: 'Mac',
      windows: 'computer Windows',
      linux: 'computer Linux',
      chromebook: 'Chromebook',
    },
    thisKind: {
      iphone: 'Questo iPhone',
      ipad: 'Questo iPad',
      'android-phone': 'Questo telefono',
      'android-tablet': 'Questo tablet',
      mac: 'Questo Mac',
      windows: 'Questo computer',
      linux: 'Questo computer',
      chromebook: 'Questo Chromebook',
      other: 'Questo dispositivo',
    },
    notation: {
      brazilian: 'Notazione brasiliana',
      american: 'Notazione americana',
      realbook: 'Notazione Real Book',
    },
    title: 'I tuoi due I miei brani',
    later: 'Più tardi',
    merged: '{device}: preferenze e diteggiature sono state unite a quelle del tuo account, impostazione per impostazione.',
    heading: '{device} ha i suoi I miei brani',
    body: 'Anche il tuo account ha I miei brani. Uniscili, oppure tienili separati.',
    merge: 'Unisci',
    mergeBody: '{device}: i brani vanno in I miei brani del tuo account. Prima un’anteprima, brano per brano.',
    mergeWaiting: 'I miei brani del tuo account stanno ancora arrivando su questo dispositivo.',
    keepBoth: 'Tienili entrambi',
    keepBothBody: 'Questo resta sullo scaffale come I miei brani (questo dispositivo).',
    keepBothTitle: 'I miei brani (questo dispositivo)',
    previewTitle: 'Cosa farebbe l’unione',
    previewNote: 'Non viene scritto nulla finché non confermi',
    previewLoading: 'Leggo I miei brani di questo dispositivo…',
    unrelated: 'I due non hanno storia in comune, quindi ogni brano presente in entrambi è mostrato come un conflitto da scegliere.',
    keepBothInstead: 'Tienili entrambi',
    mergeAndSave: 'Unisci e salva',
    failed: 'Non è stato possibile preparare l’unione. Non è stato scritto nulla.',
  },

  // Lo stato iniziale a libreria vuota sulla porta d'ingresso della ricerca
  // (account.first_run, flusso 1).
  firstRun: {
    heading: 'La tua libreria è vuota',
    body: 'Un libro è una raccolta di brani: tuoi, di un insegnante, della tua band. La ricerca cerca in tutti i libri della tua libreria.',
    writeSong: 'Scrivi un brano',
    writeSongMeta: 'Va in I miei brani',
    addByLink: 'Aggiungi un libro dal suo link',
    addByLinkMeta: 'Da un insegnante o da un compagno di band',
    signIn: 'Accedi o crea un account',
    signInMeta: 'Riporta la tua libreria, o iniziane una su Estante.',
    openExample: 'Apri il libro di esempio',
    openExampleMeta: 'Brani che arrivano con l’app, messi nella tua libreria; rimuovilo quando vuoi',
    mySongs: 'I miei brani',
    mySongsMeta: 'Ancora nessun brano · tuoi, su questo dispositivo',
    exampleLabel: 'Libro di esempio',
  },

  // La porta dell’invito a un libro condiviso (books.add_by_link, flusso 1
  // §Invitato; mockup W01). Generica prima dell’accesso — non nomina il libro.
  // shell.routing — un indirizzo per qualcosa che non è su questo dispositivo.
  notHere: {
    back: 'Indietro',
    brand: 'Estante',
    bookTitle: 'Questo link non apre un libro',
    bookBody:
      'Non è su questo dispositivo. Se sei stato invitato, chiedi a chi te l’ha mandato un nuovo invito; se è tuo su Estante, aggiungilo da Libri.',
    goToBooks: 'Vai a Libri',
    songTitle: 'Questa canzone non è in {book}',
    setlistTitle: 'Questa scaletta non è in {book}',
    itemBody: 'Potrebbe essere stata rinominata, spostata o eliminata.',
    openBook: 'Apri le canzoni di {book}',
  },
  invited: {
    brand: 'Estante',
    close: 'Chiudi',
    working: 'Apertura…',
    workingHeading: 'Apertura dell’invito',
    promptHeading: 'Sei stato invitato a un libro su Estante',
    promptBody:
      'Per aprirlo, accedi o crea prima un account — nessun libro si può leggere senza.',
    passkeyTitle: 'Un account è una passkey',
    passkeyBody: 'Nessuna password da scegliere. Il tuo telefono la crea, in pochi secondi.',
    promptFooter: 'Poi il libro va sul tuo scaffale e si apre sulle sue canzoni.',
    deadTitle: 'Questo link non apre un libro',
    deadBody:
      'L’invito potrebbe essere scaduto o ritirato, o questo account non è nel libro. Chiedi a chi te l’ha mandato di inviartene uno nuovo.',
    addByLink: 'Aggiungi un libro dal suo link',
    fullTitle: 'Questo libro è pieno',
    fullBody:
      'Ha raggiunto il limite di persone, quindi l’invito non può far entrare nessun altro. Chiedi al proprietario del libro di fare spazio e riapri il link.',
    errorTitle: 'Non è stato possibile aprire questo link',
    errorBody:
      'Qualcosa è andato storto nel raggiungere Estante. Controlla la connessione e riapri il link.',
    ok: 'OK',
  },
  // La schermata di accesso (account.sign_in, flussi 7 e 13; mockup W13).
  signIn: {
    brand: 'Estante',
    close: 'Chiudi',
    heading: 'Accedi o crea un account',
    usePasskey: 'Usa una passkey',
    emailLink: 'Inviami un link via email',
    note: 'Nessuna passkey qui? Il link ti fa accedere su questo telefono e recupera il tuo account se perdi tutti i dispositivi con una passkey.',
    // The two sections (workflow 13 §Signing in, or making an account; W13 #1).
    haveAccount: 'Hai già un account?',
    newHere: 'Sei nuovo?',
    makeAccount: 'Crea un account',
    newHereNote: 'Crea un nuovo account con una passkey. Ne hai già uno? Accedi qui sopra. Sarebbe un secondo account, separato.',
    noPasskeyHint: 'Nessuna passkey per Estante su questo dispositivo? Se hai già un account, Inviami un link via email ti fa accedere. Altrimenti, Crea un account sotto Sei nuovo? ne crea uno.',
    // Asked right after Make an account (workflow 13 §Asked when the account is made).
    recoveryHeading: 'Aggiungi un’email di recupero',
    recoverySend: 'Invia link',
    emailHeading: 'Inviami un link via email',
    emailBody: 'Invieremo un link di accesso alla tua email. Aprilo su questo dispositivo per accedere.',
    emailLabel: 'La tua email',
    emailSend: 'Invia il link',
    usePasskeyInstead: 'Usa invece una passkey',
    checkHeading: 'Controlla la tua email',
    checkBody: 'Se quell’indirizzo ha un account, un link di accesso è in arrivo. Aprilo su questo dispositivo per accedere.',
    checkBack: 'Torna all’accesso',
    redeeming: 'Accesso in corso…',
    working: 'Elaborazione…',
    offerHeading: 'Rendi l’accesso più rapido',
    offerBody: 'Aggiungi una passkey a questo dispositivo, così la prossima volta basta un tocco.',
    offerAdd: 'Aggiungi una passkey',
    offerSkip: 'Non ora',
    errorPasskey: 'Quella passkey non ha funzionato — riprova o usa un link via email.',
    errorExpired: 'Questo link è scaduto o è già stato usato — richiedine uno nuovo.',
    errorOffline: 'Impossibile raggiungere Estante. Controlla la connessione e riprova.',
    requestNewLink: 'Richiedi un nuovo link',
  },

  account: {
    open: 'Account',
    title: 'Account',
    back: 'Indietro',
    preferences: 'Preferenze',
    theme: 'Tema',
    language: 'Lingua',
    themeAutomatic: 'Automatico',
    themeAutomaticMeta: 'Segue questo dispositivo',
    themeEstante: 'Estante',
    themeEstanteMeta: 'Neutro, accordi blu inchiostro',
    themeCaderno: 'Caderno',
    themeCadernoMeta: 'Carta, accordi a penna rossa, grazie',
    themePalco: 'Palco',
    themePalcoMeta: 'Palco scuro, ambra, leggibile da lontano',
    selected: 'Selezionato',
    themeNote:
      'L’automatico segue questo dispositivo: chiaro → Estante, scuro → Palco. Scegliere un tema con un nome lo sostituisce. La tua scelta ti segue su ogni dispositivo; l’automatico rilegge la modalità chiara o scura di ciascuno.',
    // Density and chord diagrams (shell.display_preferences).
    density: 'Densità',
    densityCompact: 'Compatta',
    densityCompactMeta: 'Più piccola, più in vista',
    densityCompactMetaLong: 'Spaziatura più stretta, accordi più piccoli — più canzone in vista',
    densityComfortable: 'Comoda',
    densityComfortableMeta: 'Predefinita',
    densityRoomy: 'Ampia',
    densityRoomyMeta: 'Più grande, da leggere da lontano',
    densityRoomyMetaLong: 'Spaziatura più larga, accordi più grandi — da leggere più da lontano',
    diagrams: 'Diagrammi degli accordi',
    diagramHand: 'Mano',
    diagramHandRight: 'Destrorso',
    diagramHandRightMeta: 'Predefinito · la corda più grave a sinistra',
    diagramHandLeft: 'Mancino',
    diagramHandLeftMeta: 'Specchiato · la corda più grave a destra',
    diagramNeck: 'Manico',
    diagramNeckVertical: 'Verticale',
    diagramNeckVerticalMeta: 'Predefinito · il capotasto in alto',
    diagramNeckHorizontal: 'Orizzontale',
    diagramNeckHorizontalMeta: 'Il capotasto a sinistra, i tasti verso destra',
    diagramsNote:
      'Cambia come si disegna una posizione, mai quali posizioni si trovano. Ogni diagramma la segue.',
    languageNote: 'Usa la lingua del tuo browser finché non ne scegli una.',
    // Il tuo nome (account.author_name). Proposto 2026-10-19, in attesa di revisione.
    yourName: 'Il tuo nome',
    yourNameNote:
      'Appare sulle modifiche che salvi da ora in poi. Le modifiche già salvate mantengono il nome con cui sono state fatte.',
    yourNameNotSet: 'Non ancora impostato',
    yourNameChange: 'Cambia',
    yourNameChangeLabel: 'Cambia il tuo nome',
    yourNameEmpty: 'Il tuo nome non può essere vuoto.',
    save: 'Salva',
    notSignedIn: 'Accesso non effettuato',
    notSignedInBody: 'Porta i tuoi libri su questo dispositivo, o inizia a conservarli su Estante.',
    signInOrMake: 'Accedi o crea un account',
    // The banner while the account has no confirmed recovery email (workflow 13 §The banner).
    bannerTitle: 'Ancora nessuna email di recupero.',
    bannerBody: 'Se perdi le tue passkey, perdi questo account e i tuoi libri su Estante.',
    bannerAdd: 'Aggiungine una',
    signedIn: 'Accesso effettuato',
    signedInStatus: 'Accesso effettuato su questo dispositivo',
    loading: 'Caricamento…',
    retry: 'Riprova',
    devices: 'Dispositivi con accesso',
    thisDevice: 'Questo dispositivo',
    unknownDevice: 'Un dispositivo con accesso',
    inUseNow: '{device} · in uso ora',
    lastUsed: 'usato l’ultima volta {time}',
    offlineManage:
      'Sei offline. Puoi comunque uscire da questo dispositivo; gli altri dispositivi e le passkey non possono essere gestiti finché non ti riconnetti.',
    signOut: 'Esci',
    signOutLabel: 'Esci da {device}',
    signOutThis: 'Esci da questo dispositivo',
    signOutTitle: 'Uscire da {device}?',
    signOutBody:
      'Smetterà di funzionare su quel dispositivo alla sua prossima connessione a Estante. Nulla al suo interno viene rimosso.',
    signOutConfirm: 'Esci',
    cancel: 'Annulla',
    signOutThisTitle: 'Uscire da questo dispositivo?',
    signOutChoice: 'Cosa fare con i libri di questo account su questo dispositivo',
    signOutRemove: 'Rimuovi i libri di questo account da questo dispositivo',
    signOutRemoveMeta: 'Per un dispositivo prestato o condiviso.',
    signOutKeep: 'Tienili qui',
    signOutKeepMeta: 'Come libri locali, non più sincronizzati.',
    signOutNotYet: 'Non ancora su Estante:',
    signOutUnsavedSongs: {
      one: '{title} · modifiche non salvate in {count} canzone',
      other: '{title} · modifiche non salvate in {count} canzoni',
    },
    signOutUnpushed: {
      one: '{title} · {count} salvataggio non ancora inviato',
      other: '{title} · {count} salvataggi non ancora inviati',
    },
    signOutOnlyHere: '{title} è solo su questo dispositivo. Scaricalo prima di rimuoverlo.',
    signOutDownload: 'Scarica',
    signOutDownloadLabel: 'Scarica {title}',
    signOutConfirmRemove: 'Esci e rimuovi',
    signOutConfirmKeep: 'Esci e mantieni',
    signOutLeftOffline:
      'Sei uscito su questo dispositivo. Estante chiuderà la sessione quando il dispositivo si riconnetterà.',
    passkeys: 'Passkey',
    passkeyUnnamed: 'Passkey',
    passkeyAdded: 'Aggiunta il {date}',
    addPasskey: 'Aggiungi una passkey a questo dispositivo',
    removePasskey: 'Rimuovi',
    removePasskeyLabel: 'Rimuovi {name}',
    removePasskeyTitle: 'Rimuovere {name}?',
    removePasskeyBody:
      'Questa passkey non effettuerà più l’accesso. Le altre passkey continuano a funzionare; puoi aggiungerne un’altra quando vuoi.',
    removePasskeyConfirm: 'Rimuovi',
    leaving: 'Lasciare Estante',
    leavingBody: 'Fai una copia di tutto ciò che conservi qui, poi chiudi il tuo account se vuoi.',
    leaveTakeData: 'Esporta i tuoi dati',
    leaveDelete: 'Elimina il mio account',
    leaveTakeTitle: 'Esporta i tuoi dati',
    leaveOffline: 'Offline',
    leaveOfflineNote:
      'I tuoi libri sono su questo dispositivo, quindi i download funzionano qui. Eliminare il tuo account richiede una connessione.',
    leaveDataBody:
      'Ogni libro viene salvato così com’è su questo dispositivo — tutta la cronologia e le tue modifiche non salvate — proprio come fa Scarica su qualsiasi libro.',
    leaveDownloadAll: 'Scarica tutto',
    leaveDownload: 'Scarica',
    leaveDownloadLabel: 'Scarica {title}',
    leaveHomeBook: 'Il tuo libro personale',
    leaveClose: 'Fatto',
    leaveTitle: 'Eliminare il tuo account?',
    leaveWhen: 'Quando elimini il tuo account:',
    leaveWillAccount: 'Il tuo account, ogni sessione e ogni passkey vengono rimossi.',
    leaveWillBooks: 'I libri che possiedi vengono eliminati per tutti coloro che li condividono.',
    leaveWillAccess: 'Il tuo accesso ai libri di altre persone termina.',
    leaveWillDevice: 'I tuoi libri e il tuo libro personale vengono rimossi da questo dispositivo.',
    leaveOwnHead: 'Libri che possiedi — eliminati per tutti:',
    leaveSharedWith: {
      one: '{title} · condiviso con {count} persona — perderà l’accesso',
      other: '{title} · condiviso con {count} persone — perderanno l’accesso',
    },
    leaveOnlyYou: '{title} · solo tu — eliminato',
    leaveLocalHead: 'Solo su questo dispositivo — esportalo prima:',
    leaveTakeFirst: 'Esporta prima i tuoi dati',
    leaveConfirmLabel: 'Digita il tuo indirizzo email per confermare:',
    leaveMismatch: 'Questa non è l’email di questo account. Controllala e riprova.',
    leaveNeedsConnection: 'Serve una connessione — disponibile quando sarai di nuovo online.',
    leaveCannotUndo: 'Questa operazione non può essere annullata.',
    errNetwork: 'Sei offline, o Estante non è raggiungibile. Connettiti e riprova.',
    errGeneric: 'Qualcosa è andato storto. Riprova.',
    // The Recovery email region, the last way in, and the passkey-confirmed
    // delete (account.recovery_email; workflow 13, workflow 17).
    recoveryHeading: 'Email di recupero',
    recoveryNone: 'Nessuna email di recupero',
    recoveryNoneWarn: 'Se perdi tutti i dispositivi con una passkey, non c’è modo di rientrare.',
    recoveryLabel: 'Email di recupero',
    recoveryHint: 'Usata solo per inviarti un link di accesso. Mostrata qui, a te, e da nessun’altra parte.',
    recoverySend: 'Invia un link di verifica',
    recoveryWaiting: 'In attesa della tua conferma',
    recoverySent: 'Abbiamo inviato un link di verifica a {address}. Controlla la posta e aprilo.',
    recoveryOnceNone: 'Il link funziona una volta, per quindici minuti. Finché non viene aperto, non cambia nulla e l’account resta senza email di recupero.',
    recoveryOnceKept: 'Il link funziona una volta, per quindici minuti. Finché non viene aperto, non cambia nulla e {address} resta la tua email di recupero.',
    recoverySendAgain: 'Invia di nuovo',
    recoveryDifferent: 'Usa un altro indirizzo',
    recoveryConfirmed: 'Confermata',
    recoveryConfirmedBody: 'Riceve un link di accesso quando lo chiedi. Mostrata solo a te.',
    recoveryChange: 'Cambia',
    recoveryChangeHint: 'Cambiarla mantiene valido questo indirizzo finché il nuovo non è confermato; questo indirizzo riceve poi un breve avviso del cambio.',
    recoveryInvalid: 'Non sembra un indirizzo email.',
    recoveryOfflineHead: 'Offline',
    recoveryOffline: 'L’email di recupero ha bisogno di una connessione, come l’accesso. I suoi pulsanti aspettano che torni online; i tuoi brani no.',
    rateLimited: 'Troppi tentativi — riprova tra poco.',
    lastWayIn: 'ultimo accesso',
    lastWayInBody: 'Il tuo unico modo per accedere — aggiungi prima un’email di recupero o un’altra passkey.',
    leaveByPasskey: 'Questo account non ha un’email. Conferma con una delle tue passkey per eliminarlo.',
    leaveNotConfirmed: 'Non eliminato — la passkey non è stata confermata.',
    leaveNotConfirmedBody: 'Non è cambiato nulla. Riprova quando sei pronto.',
    leaveRefused: 'Quella passkey non ha confermato questo account. Riprova.',
    leaveNowEmail: 'Questo account ora ha un’email — digitala per confermare.',
  },

  // The recovery email's confirm page, opened by the emailed link
  // (account.recovery_email; workflow 13 §Confirming it).
  recoveryConfirm: {
    brand: 'Estante',
    heading: 'Email di recupero',
    working: 'Conferma della tua email di recupero…',
    confirmed: 'La tua email di recupero è confermata',
    body: 'La tua email di recupero è ora dove Estante invia un link di accesso se perdi tutti i dispositivi con una passkey.',
    notice: 'Questo link conferma solo l’indirizzo — non ti fa accedere su questo dispositivo e non apre nessun libro.',
    expired: 'Questo link è scaduto o è già stato usato — inviane uno nuovo dalla schermata dell’account.',
    taken: 'Questo indirizzo è l’email di recupero di un altro account Estante — accedi con quello.',
    rateLimited: 'Troppi tentativi — riprova tra poco.',
    errNetwork: 'Sei offline, o Estante non è raggiungibile. Connettiti e riprova.',
    retry: 'Riprova',
    open: 'Apri Estante',
  },

  newSong: {
    create: 'Crea “{query}”',
    createMeta: 'Un nuovo brano in {book}',
    inThisBook: 'Nuovo brano in {book}',
    inBook: 'In {book}',
    changeable: 'puoi cambiarlo fino al primo salvataggio',
    changeBook: 'Cambia libro',
    back: 'Indietro',
    unsaved: 'non salvato',
    untitled: 'Brano senza titolo',
    notationNote:
      'La notazione viene dalla tua preferenza, così il brano si legge uguale per tutti.',
  },

  // Il foglio per rendere tuo il libro (books.fork, workflow 11; W11 #1).
  fork: {
    title: '{book} è di qualcun altro — renderlo tuo?',
    body: 'Puoi leggere {book}, ma non salvarci. Renderlo tuo ti dà:',
    pointCopy: 'La tua copia del libro, con tutta la sua storia. Le tue modifiche ci passano e si salvano lì.',
    pointFollow: 'Continua a seguire {book}: quando ha modifiche nuove, scegli tu quando portarle dentro.',
    pointShelf: 'Prende il posto di {book} sul tuo scaffale, così niente compare due volte.',
    smallPrint: 'La tua copia va su Estante, privata per te. Puoi condividerla, con il suo limite di 50 persone.',
    confirm: 'Rendilo mio',
    notNow: 'Non ora',
    busy: 'Lo sto rendendo tuo…',
    offline: 'Rendere tuo il libro richiede la rete. Non è cambiato nulla: connettiti e riprova.',
    quota: 'Questo ti porterebbe oltre il tuo limite su Estante.',
    signedOut: 'Accedi per renderlo tuo.',
    error: 'Non è stato possibile renderlo tuo. Non è cambiato nulla: riprova.',
  },

  saveSheet: {
    title: 'Salva {title}',
    titleAll: { one: 'Salva {count} canzone', other: 'Salva {count} canzoni' },
    whatChanged: 'Cosa è cambiato',
    note: 'Nota',
    pushCaption:
      'Salvare condivide questa versione con chi condivide il libro; senza rete, alla prossima sincronizzazione.',
    localCaption:
      'Salvato su questo dispositivo. Solo tu puoi vederlo finché il libro non viene messo online.',
    cancel: 'Annulla',
    save: 'Salva',
    // The words a save adds that the reader does not read as chords
    // (songs.unknown_tokens_loud; workflow 4 §Saving): shown as written.
    unknownWords: 'Non letti come accordi, tenuti come scritti: {words}',
    saveAnyway: 'Salva comunque',
    close: 'Chiudi',
    saveAll: 'Salva tutto',
    saveAllLabel: 'Salva tutte le modifiche in {book}',
    songNameLabel: 'Dai un nome alla canzone',
    songNameHelp: 'Usato come titolo e nome del file.',
    bookLabel: 'Libro',
    fileNameLabel: 'Nome del file',
    fileNameHelp:
      'Nominato una volta sola, dal titolo. Cambiare il titolo in seguito ne modifica l’intestazione, non il file.',
    nameLabel: 'Il tuo nome, come apparirà nella cronologia di una canzone',
    nameHelp: 'Chiesto una volta. Dopo l’accesso, viene offerto il nome del tuo account al suo posto.',
    nameMissing: 'Inserisci il tuo nome per salvare.',
    songNameMissing: 'Dai un nome al brano per salvare.',
    saving: 'Salvataggio…',
    refused: 'Non salvato. La riga {line} non è leggibile. Correggila nell’editor e salva di nuovo.',
    refusedMerge:
      'Non salvato. Risolvi prima i conflitti di questo libro — un salvataggio ora verrebbe fuso nell’unione.',
    failed: 'Non salvato. Qualcosa è andato storto scrivendolo su questo dispositivo. Le tue modifiche sono ancora qui — salva di nuovo.',
    discardTitle: 'Scartare le modifiche a {title}?',
    discardBody: 'La canzone torna com’era all’ultimo salvataggio. Questo andrebbe perso:',
    keepEditing: 'Continua a modificare',
    discard: 'Scarta modifiche',
    makeYourOwn: 'Rendi tuo questo libro',
    notNow: 'Non ora',
    change: {
      untitledSection: '(senza titolo)',
      titleWhere: 'Titolo',
      sectionsWhere: 'Sezioni',
      voicingsWhere: 'Voicing',
      sectionBar: '{section} battuta {bar}',
      added: '{value} aggiunto',
      removed: '{value} rimosso',
      changed: '{before} → {after}',
      sectionAdded: 'sezione aggiunta',
      sectionRemoved: 'sezione rimossa',
      sectionRenamed: 'rinominata in {name}',
      sectionReordered: 'riordinate',
      wordsChanged: 'testo cambiato',
      voicingBlockAdded: 'aggiunti per {tuning}',
      voicingBlockRemoved: 'rimossi per {tuning}',
      voicingAdded: 'per {tuning}: {chord} aggiunto',
      voicingRemoved: 'per {tuning}: {chord} rimosso',
      voicingChanged: 'per {tuning}: {chord} cambiato',
    },
  },

  history: {
    title: 'Cronologia',
    newestFirst: '{book} · prima le più recenti',
    songInBook: '{title} · {book}',
    listLabel: 'Versioni di {title}',
    you: 'tu',
    unsaved: 'Non salvato, su questo dispositivo',
    unsavedBadge: 'non salvato',
    unsavedChanges: 'modifiche non salvate',
    mergedWithResolution: 'Unito, con la tua risoluzione',
    backToSong: 'Torna alla canzone',
    backToHistory: 'Torna alla cronologia',
    whatChanged: 'Cosa è cambiato rispetto alla versione precedente',
    whatChangedToNow: 'Cosa è cambiato da questa versione a ora',
    songAsItWas: 'La canzone com’era',
    asItWasThen: '{title} com’era allora',
    compareNow: 'Confronta con ora',
    compareBefore: 'Confronta con la versione precedente',
    restore: 'Ripristina questa versione',
    showText: 'Mostra il testo',
    lineDiffCaption: 'la differenza per righe di {file} rispetto alla versione precedente',
    empty: 'Ancora nessuna versione.',
    restoreTitle: 'Ripristinare la versione del {date}?',
    restoreBody:
      '{title} ha modifiche non salvate su questo dispositivo. Il ripristino le sostituisce, e questo andrebbe perso:',
    restoreCaption:
      'Viene ripristinata l’intera versione. Resta poi non salvata, e salvarla crea una nuova versione; nulla nella cronologia viene modificato.',
    keepChanges: 'Mantieni le mie modifiche',
    loseAndRestore: 'Scartale e ripristina',
    restoreBlock: 'Ripristina questo blocco',
    restoreBlockNamed: 'Ripristina questo blocco: {block}',
    voicingBlock: 'Posizioni per {tuning}',
    restorePartTitle: 'Ripristinare {block}?',
    restorePartBody:
      '{block} ha modifiche non salvate su questo dispositivo. Ripristinare questo blocco le sostituisce, e questo andrebbe perso:',
    restorePartCaption:
      'Viene ripristinato solo questo blocco; il resto della canzone resta com’è. Resta poi non salvato, e salvare crea una nuova versione; nulla nella cronologia viene modificato.',
    nothingToRestore: 'Ripristinare questo blocco non recupera nulla.',
    noBlockRestore:
      'Questa versione è troppo vecchia per ripristinarla blocco per blocco. Puoi comunque ripristinare l’intera versione.',
  },

  // Il risolutore di conflitti per canzone (sync.conflicts, workflow 9).
  songConflict: {
    back: 'Indietro',
    stepOf: 'Conflitto {n} di {total}',
    prev: 'Conflitto precedente',
    next: 'Conflitto successivo',
    yours: 'Il tuo',
    theirs: 'di {author}',
    theirsFallback: 'Il loro',
    chartTitle: '{section}',
    chartTitleFallback: 'Una battuta che avete cambiato entrambi',
    // The bar or bars a chart conflict is in (sync.conflicts_editing; W09#1 L42).
    chartTitleBar: '{section}, battuta {bar}',
    chartTitleBars: '{section}, battute {first} e {second}',
    chartTitleBarRange: '{section}, battute {first}–{last}',
    chartBody: 'Tu e {author} avete cambiato questo.',
    chartBodyFallback: 'Lo avete cambiato entrambi.',
    voicingTitle: 'La forma per {chord}',
    voicingBody: '{tuning} · {variation}. Tu e {author} avete scelto forme diverse.',
    voicingBodyFallback: '{tuning} · {variation}. Avete scelto forme diverse.',
    mainVariation: 'variazione principale',
    propertyTitle: 'Il campo {key}',
    propertyBody: 'Tu e {author} avete cambiato questo.',
    propertyBodyFallback: 'Lo avete cambiato entrambi.',
    titleTitle: 'Il titolo',
    titleBody: 'Tu e {author} avete dato titoli diversi.',
    titleBodyFallback: 'Avete dato titoli diversi.',
    genericTitle: 'Una modifica fatta da entrambi',
    genericBody: 'Tu e {author} avete cambiato questo.',
    genericBodyFallback: 'Lo avete cambiato entrambi.',
    absent: '(rimosso)',
    keepMine: 'Tieni il mio',
    takeTheirs: 'Tieni il loro',
    keepBoth: 'Tieni entrambi',
    edit: 'Modifica',
    readsAsYours:
      'Finché non lo risolvi, {title} appare nella tua versione, con i punti in conflitto segnati.',
    keepBothSongTitle: 'Due canzoni?',
    keepBothSongBody:
      'Tieni la tua così com’è e salva la versione di {author} accanto, come una canzone a sé, per quando avete davvero fatto due canzoni.',
    keepBothSongBodyFallback:
      'Tieni la tua così com’è e salva la versione arrivata accanto, come una canzone a sé, per quando due persone hanno davvero fatto due canzoni.',
    keepBothSong: 'Tieni entrambe, come due canzoni',
    previewLabel: '{title}, la tua versione',
    spoken: {
      chartLine: 'conflitto nella riga dello spartito',
      line: 'conflitto in questa riga',
    },
    settledSoFar: 'Risolto finora',
    settledMine: 'Tenuto il tuo',
    settledTheirs: 'Tenuto quello di {author}',
    settledKeepBoth: 'Tenuti entrambi — quello di {author} in una variazione',
    settledEdit: 'Testo modificato',
    allSettled: 'Tutti i conflitti di {title} sono risolti.',
    editTitle: 'Modifica il testo di {title}',
    editHelp: 'Tieni le righe che vuoi, di un lato o di entrambi, ed elimina le tre righe di marcatura.',
    editTextLabel: 'Il testo della canzone, con i marcatori di conflitto',
    editSave: 'Salva',
    editCancel: 'Annulla',
    editRefused:
      'Non salvato. La riga {line} è ancora un marcatore di conflitto. Togli tutte le righe di marcatura dopo aver scelto cosa resta e salva di nuovo.',
    editGoToLine: 'Vai alla riga {line}',
    markersTitle: 'Leggere i marcatori',
    markerStart: 'inizia la tua versione',
    markerMid: 'finisce la tua, inizia quella di {author}',
    markerEnd: 'finisce la versione di {author}',
    // The labels on the marker lines in the edit view, named as the side cards
    // name the two versions (W09#3 L284-308).
    markerYours: 'il tuo',
    markerTheirs: 'di {author}',
    markerTheirsFallback: 'il loro',
  },

  // Il pannello del libro in pausa (sync.conflicts, workflow 9).
  bookConflicts: {
    needsYou: { one: '{count} canzone ha bisogno di te.', other: '{count} canzoni hanno bisogno di te.' },
    needsYouBody:
      'Le ultime modifiche arrivate e le tue hanno toccato gli stessi punti. Tutto il resto è già qui, e puoi leggere e modificare come sempre; questo libro non riceve nulla di nuovo dalla sincronizzazione finché non è tutto risolto.',
    inConflict: 'In conflitto',
    conflictsCount: { one: '{count} conflitto', other: '{count} conflitti' },
    conflictBadge: 'conflitto',
    settle: 'Risolvi',
    settleSong: 'Risolvi {title}',
    keepBothSong: 'Tieni entrambe',
    keepBothSongFor: 'Tieni entrambe le versioni di {title} come due canzoni',
    deletedBody: '{author} ha eliminato questa canzone. Tu l’avevi modificata.',
    keepSong: 'Tieni la canzone, con le modifiche',
    deleteSong: 'Eliminala',
    cameIn: 'Arrivata, già qui',
    addedBy: 'aggiunta da {author}',
    changedBy: 'aggiornata da {author}',
    savingTitle: 'Salvare in questo libro',
    savingBody: {
      one: 'Risolvi prima la canzone. Un salvataggio ora verrebbe fuso nell’unione.',
      other: 'Risolvi prima le {count} canzoni. Un salvataggio ora verrebbe fuso nell’unione.',
    },
    savingSafe: 'Le tue modifiche non salvate restano come sono fino ad allora.',
    notNowTitle: 'Non ora',
    notNowBody:
      'I conflitti possono aspettare quanto vuoi. Abbandonare riporta il libro com’era prima di questa sincronizzazione; le modifiche arrivate aspettano di essere unite alla prossima.',
    abandon: 'Abbandona l’unione',
  },

  fileView: {
    filesEntry: 'File',
    filesFor: 'File di {name}',
    title: 'File',
    titleIn: '{book} · File',
    back: 'Indietro',
    backToFiles: 'Torna ai file',
    backToHistory: 'Torna alla cronologia',
    historyTab: 'Cronologia',
    filesTab: 'File',
    historyTitle: '{book} · Cronologia',
    new: 'Nuovo',
    createSong: 'Brano',
    createSongMeta: '*.cifra.md',
    createSetlist: 'Scaletta',
    createSetlistMeta: '*.setlist.md',
    createFolder: 'Cartella',
    createFolderMeta: 'esiste quando contiene un file',
    createReadme: 'README.md',
    readmeExists: 'README.md esiste già',
    newSetlistTitle: 'Nuova scaletta',
    newFolderTitle: 'Nuova cartella',
    createNameLabel: 'Nome, in {folder}/',
    createNameLabelRoot: 'Nome, nel libro',
    createConfirm: 'Crea',
    createCancel: 'Annulla',
    folderProblem: {
      blank: 'Dai un nome alla cartella.',
      slash: 'Il nome di una cartella non può contenere /.',
      dots: '. e .. non sono nomi di cartella.',
      hidden: 'Il nome di una cartella non può iniziare con un punto.',
      taken: 'Qui c’è già qualcosa con questo nome.',
    },
    more: 'Altro',
    delete: 'Elimina',
    fileMeta: '{book} · {folder}/',
    tree: 'File di {book}',
    holds:
      'Un libro contiene brani (*.cifra.md), scalette (*.setlist.md), README.md e .gitattributes, e nient’altro.',
    status: {
      unsaved: 'modifiche non salvate',
      new: 'nuovo',
      deleted: 'eliminato',
      conflict: 'conflitto',
      empty: 'vuota',
    },
    filesChanged: { one: '{count} file modificato', other: '{count} file modificati' },
    save: 'Salva…',
    saveFiles: { one: 'Salva {count} file…', other: 'Salva {count} file…' },
    rename: 'Rinomina',
    renameLabel: 'Rinomina {name}',
    renameSong: 'Rinomina brano',
    renameSetlist: 'Rinomina scaletta',
    renameNameLabel: 'Nome, in {folder}/',
    renameNameLabelRoot: 'Nome',
    renameHintSong: 'Un brano mantiene .cifra.md, quindi resta un brano. Il titolo al suo interno non cambia.',
    renameHintSetlist: 'Una scaletta mantiene .setlist.md, quindi resta una scaletta.',
    linkNotice: 'I collegamenti ad esso vengono aggiornati nello stesso salvataggio',
    linkItem: '{path} · voce {item}',
    renameCancel: 'Annulla',
    renameConfirm: 'Rinomina',
    deleteLabel: 'Elimina {name}',
    deleteTitle: 'Eliminare {name}?',
    deleteBody:
      'Viene rimosso dal libro quando salvi. Una scaletta che punta ad esso mostrerà un elemento mancante.',
    deleteCancel: 'Mantieni',
    deleteConfirm: 'Elimina',
    changesTitle: 'Modifiche non salvate',
    changesCaption: 'Un salvataggio, un commit',
    noChanges: 'Niente da salvare.',
    historyHeading: 'Cronologia',
    merge: 'merge',
    commits: 'Versioni di {book}',
    commitFiles: { one: '{count} file', other: '{count} file' },
    commitMeta: '{author} · {date} · {hash} · {files}',
    restore: 'Ripristina questa versione',
    restoreCaption:
      'Il ripristino scrive quel file com’era dopo questo commit nella copia di lavoro, per salvarlo come nuova versione.',
    diffCaption: 'le differenze di riga di {file} in questo commit',
    emptyEditor: 'Scegli un file per aprirlo.',
    emptyCommit: 'Scegli un commit per vedere cosa ha cambiato.',
  },

  nav: {
    label: 'Sezioni',
    explore: 'Accordi',
    instrument: 'Strumento',
    library: 'Salvati',
    sheets: 'Canzoni',
    backup: 'Backup',
  },

  chip: {
    summary: 'Strumento: {label}. Cambia strumento.',
    add: '+ Aggiungi strumento',
  },

  viewAs: {
    fromSheet: 'da questa canzone',
    fromLink: 'dal link',
    viewing: ' Visualizzato come {label} ({source})',
    back: 'Torna al mio {label}',
    keep: 'Imposta come predefinito',
  },

  input: {
    label: 'Accordo',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Mostra',
    readAs: ' “{text}” letto come {reading}. ',
    use: 'Usa {reading}',
    build: 'Costruisci l’accordo',
    root: 'Fondamentale',
    quality: 'Qualità',
    seventh: 'Settima',
    bass: 'Basso',
    bassRoot: 'Fondamentale',
    extensions: 'Estensioni',
  },

  quality: {
    major: 'Maggiore',
    minor: 'Minore',
    dim: 'Diminuito',
    aug: 'Aumentato',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'Senza settima',
    dominant: 'Settima dominante',
    major: 'Settima maggiore',
    diminished: 'Settima diminuita',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'settima maggiore',
      dominantSharpFive: 'settima dominante con quinta aumentata',
    },
    bareNine: {
      add: 'nona aggiunta, senza settima',
      dominant: 'nona dominante, con la settima minore',
    },
    degreeSign: {
      diminishedSeventh: 'settima diminuita',
      diminishedTriad: 'triade diminuita, senza settima',
    },
    sevenFour: {
      suspendedFourth: 'quarta sospesa',
      addedFourth: 'quarta aggiunta',
    },
  },

  errors: {
    empty: 'Scrivi un accordo.',
    unexpected: 'Non mi aspettavo "{text}".',
    needsNumber: '"{text}" deve essere seguito da un numero.',
    bassNeeded: 'Dopo "/" ci va una nota di basso o un numero.',
    badNote: 'Non capisco la nota: {text}',
    badPitch: 'Non capisco l’altezza: {text}',
    emptyTuning: 'Un’accordatura ha bisogno di almeno una corda.',
    unknownQuality: 'Qualità dell’accordo sconosciuta: {quality}',
    badDegree: 'Grado dell’estensione non valido: {degree}',
    badAlteration: 'Alterazione dell’estensione non valida: {alter}',
    unknownDialect: 'Sistema di notazione sconosciuto: {dialect}',
    noRoot: '"{text}" non comincia con il nome di una nota.',
    badRoot: 'Non capisco la fondamentale "{text}".',
    badBass: 'Non capisco la nota di basso "{text}".',
    unreadable: 'Non capisco "{text}" in "{whole}".',
    noSheetInLink: 'Quel link non contiene nessuna canzone.',
    cannotDecompress: 'Questo browser non riesce a leggere i link compressi delle canzoni.',
    unknownLinkFormat: 'Quel link non è in un formato che l’app capisca.',
    notASheet: 'Quel link non contiene una canzone.',
  },

  toggles: {
    label: 'Vista del diagramma',
    neck: 'Vista manico',
    left: 'Mancino',
  },

  results: {
    announceNone: 'Nessuna diteggiatura trovata.',
    announceCount: '{count} diteggiature in {positions} posizioni.',
    empty: 'Scrivi un accordo per vedere come si suona.',
    none: 'Nessuna diteggiatura per questo accordo su {label}.',
    noneHelp:
      'Forse servono più corde di quante ne abbia lo strumento, o le tue regole di voicing sono troppo rigide.',
    adjustRules: 'Modifica le regole di voicing',
    save: ' Salva',
    saved: ' Salvato',
    saveLabel: 'Salva {shorthand} nella tua libreria',
    removeLabel: 'Togli {shorthand} dalla tua libreria',
  },

  groups: {
    open: 'Posizione aperta',
    fret: 'Tasto {position}',
    list: 'Diteggiature: {position}',
    showFewer: 'Mostra meno',
    showAll: 'Mostra tutte le {count}',
  },

  difficulty: { easy: 'facile', medium: 'media', hard: 'difficile' },

  diagram: {
    open: 'posizione aperta',
    startingAt: 'dal tasto {position}',
    barre: 'barré su {count} corde al tasto {fret}',
    fingers: 'dita {fingers}',
    muted: { one: '{count} corda non suonata', other: '{count} corde non suonate' },
    rootOn: 'fondamentale sulla {ordinal} corda',
    noRoot: 'senza fondamentale',
    voicedAs: 'suona come {chord}',
    toPlay: 'difficoltà {difficulty}',
    yourShape: 'la tua forma',
    default: 'predefinita',
  },

  chart: {
    label: 'Spartito',
    verbatim: 'Blocco {info}',
    spoken: {
      noChord: 'nessun accordo',
      bar: 'battuta {n}:',
      needsYou: 'serve te',
      conflict: 'un conflitto',
      endOfConflict: 'fine del conflitto',
      default: 'predefinito',
      endOfDefaults: 'fine dei predefiniti',
    },
  },

  chord: {
    spoken: {
      doubleFlat: 'doppio bemolle',
      flat: 'bemolle',
      sharp: 'diesis',
      doubleSharp: 'doppio diesis',
      minor: 'minore',
      major: 'maggiore',
      diminished: 'diminuito',
      augmented: 'aumentato',
      suspendedTwo: 'con seconda sospesa',
      suspendedFour: 'con quarta sospesa',
      fifth: 'quinta',
      over: 'su',
      add: 'con',
      footnote: 'nota a piè di pagina',
      interval: { 2: 'seconda', 4: 'quarta', 5: 'quinta', 6: 'sesta', 7: 'settima', 9: 'nona', 11: 'undicesima', 13: 'tredicesima' },
    },
  },

  reading: {
    emptySong: 'Ancora niente di scritto in questa canzone.',
    emptySection: 'Ancora niente di scritto qui.',
    back: 'Indietro',
    byline: '{artist} · {book}',
    keyOf: 'Tonalità di {key}',
    shapes: 'Forme',
    shapesInKey: 'Forme in {key}',
    shapesFor: 'Forme · {instrument}',
    shapesCaption:
      'In inchiostro: la forma propria della canzone. A colori: una forma che hai scelto. A contorno, marcata predefinita: il suggerimento dell’app.',
    transposedCaptionKey:
      'Le forme proprie della canzone sono per {key}, quindi gli accordi trasposti usano le tue forme e poi quelle predefinite.',
    transposedCaption:
      'Una canzone trasposta non ha forme scelte, quindi ogni accordo usa la tua forma e poi quella predefinita.',
    unvoiced: 'Nessuna forma suonabile per {list}.',
    variationLabel: 'Variazione',
    variationDefault: 'Predefinita',
    transpose: 'Trasponi',
    transposeTitle: 'Trasponi la vista',
    down: 'Un semitono più in basso',
    up: 'Un semitono più in alto',
    writtenKey: 'Tonalità scritta',
    transposedToKey: 'Trasposta in {key} ({offset})',
    transposedBy: 'Trasposta ({offset})',
    backToKey: 'Torna a {key}',
    backToWritten: 'Torna alla tonalità scritta',
    arrangingOff: 'L’arrangiamento è disattivato mentre è trasposta',
    noVoicings:
      'Questa canzone non dice ancora come suonare i suoi accordi su {instrument}, quindi ogni accordo mostra la sua forma più facile.',
    arrangeFor: 'Arrangia per {instrument}',
    // La domanda una tantum alla prima apertura (workflow 1 §The instrument;
    // W01 L108-112; songs.first_song, songs.shape_words): un'affermazione e due
    // risposte. Il testo è fisso su "chitarra".
    instrumentPrompt: 'Forme degli accordi mostrate per chitarra.',
    instrumentPromptChange: 'Cambia strumento',
    instrumentPromptKeep: 'Mantieni chitarra',
    arrange: 'Arrangia',
    edit: 'Modifica',
    history: 'Cronologia',
    addToSetlist: 'Aggiungi alla scaletta',
    print: 'Stampa',
    share: 'Condividi',
    showFile: 'Mostra il file',
    more: 'Altro',
    fullScreen: 'Schermo intero',
    leaveFullScreen: 'Esci da schermo intero',
    // I titoli dei gruppi del menu ⋯ (songs.menu_grouping; flusso 2): ogni
    // titolo è il nome che lo screen reader dà al gruppo.
    menuThisSong: 'Questo brano',
    menuTakeAlong: 'Da portare',
    menuView: 'Vista',
    // Una sincronizzazione in background ha portato una nuova versione con il
    // brano aperto (sync.read_in_place, flusso 8; W08). `{name}` è chi l'ha
    // cambiato.
    updatedBy: 'Aggiornato da {name}',
    seeWhatChanged: 'Vedi cosa è cambiato',
    updateDismiss: 'Chiudi avviso di aggiornamento',
    // The footnote under the full-screen chart while a merge waits (sync.in_place_notices;
    // W08#4 L153-156). `{name}` is the most recent incoming author.
    updateWaiting: 'Un aggiornamento di {name} è in attesa. Apparirà quando esci da schermo intero.',
  },

  arrange: {
    back: 'Indietro',
    done: 'Fatto',
    modeChip: 'Arrangiando · {instrument}',
    modeHint: 'Tocca un accordo per scegliere la sua forma',
    chordButton: 'Scegli una forma per {chord}',
    shapes: 'Forme',
    shapesCaption:
      'Le forme scelte appaiono in inchiostro. Un accordo che non hai scelto mostra la tua forma o quella predefinita dell’app, ciascuna segnata.',
    chooseEveryUnchosen: 'Scegli queste per ogni accordo non scelto',
    runWizard: 'Usa la procedura guidata',
    variations: 'Variazioni',
    pickerLabel: 'Forme di {chord}',
    scopeLabel: 'Quali accordi cambia',
    everyChord: 'Ogni {chord}',
    onlyHere: 'Solo qui',
    onlyHereWarning:
      'Solo qui segna questa battuta nella cifra, per tutti quelli che suonano il brano. Sui loro strumenti appare quella predefinita finché qualcuno non sceglie.',
    choose: 'Scegli',
    chooseShape: 'Scegli questa forma',
    chooseShapeLabel: 'Scegli {chord}, {shorthand}',
    enterShape: 'Inserisci una forma',
    enterShapeTitle: 'Inserisci una forma per {chord}',
    enterContext: '{song} · {section}, battuta {bar} · {scope}',
    enterContextNoSection: '{song} · battuta {bar} · {scope}',
    scopeHere: 'solo qui',
    scopeKey: 'ogni {chord}',
    noShapes: 'Nessuna forma suonabile per {chord} su {instrument}.',
    variationLabel: 'Variazione',
    variationDefault: 'Predefinita',
    newVariation: '+ Nuova variazione',
    selectorCaption: 'Il selettore appare solo quando {instrument} ha più di una variazione in questo brano.',
    addVariationTitle: 'Aggiungi una variazione',
    variationName: 'Nome di questa variazione',
    variationPlaceholder: 'Più su sul manico',
    variationCopy: 'Parti dalle forme di “{name}”',
    variationNeedsName: 'Dai un nome alla variazione.',
    variationTaken: 'Esiste già una variazione chiamata “{name}” per questo strumento.',
    addVariationCancel: 'Annulla',
    addVariationConfirm: 'Aggiungi',
  },

  library: {
    title: 'Forme salvate',
    empty:
      'Niente di salvato per {label}, per ora. Metti una stella a una forma nella schermata degli accordi per tenerla qui.',
    count: '{count} salvate per {label}.',
    list: 'Forme salvate per {label}',
    open: 'Apri',
    openLabel: 'Mostra {chord} nella schermata degli accordi',
    remove: 'Togli',
    removeLabel: 'Togli {chord} {shorthand} dalle forme salvate',
  },

  catalog: {
    '6guitar': 'Chitarra (6 corde)',
    '7guitar': 'Chitarra (7 corde)',
    '4bass': 'Basso (4 corde)',
    '5bass': 'Basso (5 corde)',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolino',
    tenorbanjo: 'Banjo tenore',
  },

  // Il nome breve del chip dell'intestazione (shell.header_chrome, flusso 15):
  // il nome del catalogo senza il numero di corde dello strumento standard.
  catalogShort: {
    '6guitar': 'Chitarra',
    '7guitar': 'Chitarra a 7 corde',
    '4bass': 'Basso',
    '5bass': 'Basso a 5 corde',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolino',
    tenorbanjo: 'Banjo tenore',
  },

  tuning: {
    Standard: 'Standard',
    'Drop D': 'Drop D',
    'Open G': 'Sol aperto',
    'Open D': 'Re aperto',
    DADGAD: 'DADGAD',
    'Open C': 'Do aperto',
    Brazilian: 'Brasiliana',
    'Standard (re-entrant)': 'Standard (rientrante)',
    'Low G': 'Sol basso',
    Baritone: 'Baritono',
    'Standard (Brazil)': 'Standard (Brasile)',
    Irish: 'Irlandese',
    custom: 'Personalizzata',
    customOption: 'Accordatura personalizzata',
  },

  form: {
    edit: 'Modifica strumento',
    choose: 'Scegli il tuo strumento',
    add: 'Aggiungi uno strumento',
    firstRunHelp: 'Tutto viene mostrato per questo strumento. Puoi aggiungerne altri e cambiare quando vuoi.',
    addHelp: 'Si aggiunge alla tua lista; il selettore nell’intestazione passa dall’uno all’altro.',
    instrument: 'Strumento',
    fallbackName: 'Strumento',
    tuning: 'Accordatura',
    strings: 'Corde',
    stringsHelp:
      'Dalla corda più grave alla più acuta. Va bene qualsiasi elenco di note separate da virgole, comprese le accordature rientranti.',
    style: 'Come suoni',
    styleHelp:
      'Decide quali forme ti vengono proposte: con il fingerstyle una corda stoppata in mezzo all\'accordo è ammessa, con lo strumming no. La schermata dello strumento lo cambia in seguito.',
    name: 'Nome',
    nameHelp: 'Compare nel selettore. Dai alle accordature personalizzate nomi che riconosci.',
    frets: 'Tasti',
    save: 'Salva le modifiche',
    start: 'Inizia a suonare',
    addButton: 'Aggiungi strumento',
    cancel: 'Annulla',
    needName: 'Dai un nome allo strumento.',
    badTuning: 'Non capisco quell’accordatura: {reason}',
  },

  backup: {
    title: 'Backup',
    help:
      'Tutto quello che hai è tenuto in questo browser, che va bene finché non va bene il ' +
      'dispositivo. Un backup è un solo zip con i tuoi strumenti e le impostazioni, le forme ' +
      'salvate e ogni canzone come file di testo che puoi leggere e modificare dove vuoi.',
    save: 'Salva un backup',
    insideTitle: 'Cosa c’è dentro',
    inside:
      'Uno zip, con i tuoi strumenti e le loro regole e le impostazioni in un file, le forme ' +
      'salvate in un altro, e ogni canzone come file di testo col suo nome. Metti un’altra ' +
      'canzone nella cartella songs con qualunque programma di zip e torna con le altre.',
    restore: 'Ripristina un backup',
    confirmTitle: 'Ripristinare da “{name}”?',
    confirmBody:
      'Tutto su questo dispositivo viene sostituito da ciò che contiene il file: {instruments} e {songs}.',
    instruments: { one: '{count} strumento', other: '{count} strumenti' },
    songs: { one: '{count} canzone', other: '{count} canzoni' },
    confirmButton: 'Sostituisci tutto',
    nudgeTitle: 'Le tue canzoni esistono solo su questo dispositivo',
    nudgeText: {
      one:
        'La canzone qui non è in nessun backup. Su Android un telefono nuovo non la ' +
        'riceve, e un browser che cancella i dati se la porta via.',
      other:
        'Le {count} canzoni qui non sono in nessun backup. Su Android un telefono nuovo ' +
        'non le riceve, e un browser che cancella i dati se le porta via.',
    },
    notNow: 'Non ora',
    failed: 'Non riesco a leggere questo backup: {reason}',
  },
  instruments: {
    title: 'Strumenti',
    help:
      'Tutto ciò che è sullo schermo è per lo strumento in uso. Ognuno conserva la sua accordatura, le sue regole di voicing, le sue forme salvate e le sue canzoni.',
    inUse: 'In uso',
    reentrant: 'Rientrante',
    meta: '{tuning} · {count} tasti',
    use: 'Usa',
    useLabel: 'Usa {label}',
    edit: 'Modifica',
    editLabel: 'Modifica {label}',
    delete: 'Elimina',
    deleteLabel: 'Elimina {label}',
    add: 'Aggiungi strumento',
    back: '← Tutti gli strumenti',
    deleteThis: 'Elimina questo strumento',
    confirmTitle: 'Eliminare {label}?',
    confirmShapes: {
      one: 'La sua {count} forma salvata se ne va con lui. ',
      other: 'Le sue {count} forme salvate se ne vanno con lui. ',
    },
    confirmSongs: 'Le canzoni restano, perché portano con sé la propria accordatura. Non si può annullare.',
    confirmButton: 'Elimina strumento',
  },

  rules: {
    title: 'Regole di voicing',
    help: 'Come vengono costruiti gli accordi su {label}.',
    preset: 'Impostazione',
    custom: 'Personalizzata',
    presets: {
      beginner: 'Principiante',
      strumming: 'Strumming',
      fingerstyle: 'Fingerstyle',
      jazz: 'Jazz',
      bassFriendly: 'Per basso',
    },
    rules: 'Regole',
    rootInBass: 'La fondamentale deve essere la nota più grave',
    requireThird: 'Richiedi la terza',
    omitFifth: 'La quinta può essere omessa',
    allowRootless: 'Consenti voicing senza fondamentale',
    requireExtensions: 'Richiedi tutte le estensioni scritte',
    allowBarre: 'Consenti il barré',
    allowInnerMutes: 'Consenti una corda stoppata tra corde che suonano',
    allowDoubling: 'Consenti la stessa nota su più di una corda',
    allowDuplicatePitch: 'Consenti la stessa altezza due volte',
    limits: 'Limiti',
    maxSpan: 'Apertura massima (tasti)',
    minSoundingStrings: 'Minimo di corde che suonano',
    maxResultsPerGroup: 'Forme mostrate per posizione',
    weights: 'Pesi della difficoltà',
    weightsHelp:
      'Quanto pesa ogni cosa nel rendere difficile una forma. I valori negativi rendono la forma più facile.',
    weight: {
      spanPerFret: 'Apertura, per tasto',
      barre: 'Barré',
      fullBarre: 'Barré completo, extra',
      perFinger: 'Ogni dito',
      innerMute: 'Corda stoppata in mezzo',
      mutedString: 'Ogni corda stoppata',
      positionPerFret: 'Posizione, per tasto',
      omittedFifth: 'Omettere la quinta',
      rootless: 'Omettere la fondamentale',
      nonRootBass: 'Rivolto non richiesto',
      openString: 'Ogni corda a vuoto (un bonus)',
      nonAdjacentStretch: 'Apertura ampia',
    },
  },

  sheets: {
    title: 'Canzoni',
    help: 'Gli accordi di una canzone su {label}, ognuno fissato alla diteggiatura che vuoi insegnare.',
    titlePlaceholder: 'Titolo della canzone',
    newTitleLabel: 'Titolo della nuova canzone',
    create: 'Nuova canzone',
    untitled: 'Canzone senza titolo',
    shared: 'Canzone condivisa',
    sharedInstrument: 'Strumento condiviso',
    empty: 'Ancora nessuna canzone.',
    measures: { one: '{count} battuta', other: '{count} battute' },
    chords: { one: '{count} accordo', other: '{count} accordi' },
    chosenHere: { one: ' · {count} voicing scelto qui', other: ' · {count} voicing scelti qui' },
    voicedFor: 'Con voicing per {list}',
    view: 'Vedi',
    viewLabel: 'Vedi {title}',
    edit: 'Modifica',
    editLabel: 'Modifica {title}',
    duplicate: 'Duplica',
    duplicateLabel: 'Duplica {title}',
    delete: 'Elimina',
    deleteLabel: 'Elimina {title}',
    imported: 'Canzone "{title}" importata.',
  },

  editor: {
    // L’editor del codice sorgente CodeMirror (songs.editor, flussi 3 e 4).
    source: {
      sourceLabel: 'Codice della canzone',
      viewToggle: 'Cosa mostrare',
      text: 'Testo',
      preview: 'Anteprima',
      previewLabel: 'Anteprima della canzone come verrà letta',
      addSection: 'Aggiungi sezione',
      save: 'Salva',
      undo: 'Annulla',
      pasteFenced: 'La canzone incollata ora è dentro un recinto, quindi viene letta come musica.',
      pasteTitleAdded: 'La sua prima riga è diventata il titolo.',
      // A word the reader keeps but does not read as a chord, and a bracket
      // heading named by a chord (songs.unknown_tokens_loud; workflow 3, 4).
      unknownMark: 'Non letto come accordo',
      bracketChords: 'La riga {line} sembra avere accordi tra parentesi quadre. Qui un accordo va su una riga a sé, sopra le sue parole.',
      dismissNotice: 'Chiudi l’avviso',
      notSaved: 'Non salvato.',
      voicingStop:
        'La riga {line} è un diteggiatura che non può essere letta, e salvando andrebbe persa. Correggila o eliminala, poi salva di nuovo.',
      markerStop: 'La riga {line} è un marcatore di conflitto. Risolvilo prima di poter salvare la canzone.',
      afterRuleStop:
        'La riga {line} viene dopo la riga ---, dove si conservano solo blocchi di diteggiature, e salvando andrebbe persa. Se fa parte della canzone, sposta la riga --- sotto di essa; un titolo di diteggiature ha bisogno di un’accordatura, come ## Voicings: E2 A2 D3 G3 B3 E4.',
      // Il *Fammi vedere* dell’avviso e il suo secondo caso, accordi fuori dalla
      // musica (songs.format_help; workflow 3).
      showMeHow: 'Fammi vedere',
      unfencedChords:
        'La riga {line} sembra avere accordi, ma è fuori dalla musica, quindi resta una nota. La musica va tra due righe di tre apici inversi.',
      // Le parole sotto una riga rossa e l’offerta dell’avviso di mettere
      // nella musica una riga di accordi fuori da essa (songs.editor_errors_in_words).
      lineNote: 'Riga {line}: {words}',
      putInMusic: 'Mettila nella musica',
      lineFenced: 'La riga {line} ora è dentro la musica, quindi si legge come accordi.',
    },
    // Che cosa non va in una riga che il lettore segnala, dal codice della
    // diagnostica (cifra.md §0); `other` per un codice che l’app non conosce.
    diagnostic: {
      'duplicate-property': 'questa proprietà compare di nuovo; il valore precedente non resta.',
      'bad-property': 'una proprietà è un nome, due punti, uno spazio e il suo valore; questa riga non resta.',
      'marker-line':
        'un marcatore di conflitto, lasciato dove due versioni si sono incontrate; risolvilo prima di salvare.',
      'bad-notation': 'una notazione che l’app non conosce; la canzone si legge come brasiliana.',
      'heading-looks-like-key':
        'questo si legge come una parte col nome di un accordo; se è la tonalità della canzone, scrivi - key: nelle proprietà.',
      'unclosed-fence': 'la musica aperta qui non viene mai chiusa con una riga di tre apici inversi.',
      'extra-rule': 'una seconda riga ---; solo la prima divide la canzone, e questa non resta.',
      'bad-block-heading':
        'dopo la riga --- un titolo è un blocco di diteggiature e ha bisogno di un’accordatura; le righe sotto non vengono lette.',
      'duplicate-block': 'un secondo blocco di diteggiature per la stessa accordatura; i due vengono uniti.',
      'item-outside-block': 'dopo la riga ---, restano solo blocchi di diteggiature.',
      'bad-voicing': 'una diteggiatura che non si può leggere.',
      'bad-fingering': 'le dita di questa diteggiatura non si possono leggere, quindi restano fuori.',
      'notes-outside-block': 'dopo la riga ---, restano solo blocchi di diteggiature.',
      'unfenced-music': 'questo si legge come accordi, ma è fuori dalla musica, quindi resta una nota.',
      'stray-mark': 'un segno di ripetizione senza gruppo da aprire o chiudere.',
      'ending-outside-group': 'un finale fuori da un gruppo di ripetizione.',
      'count-out-of-place': 'un conteggio di ripetizioni che non segue un gruppo e non chiude la riga.',
      'unclosed-group': 'un gruppo di ripetizione aperto qui non viene mai chiuso.',
      'bad-ending-sequence': 'i finali vanno numerati 1., 2. e così via, in ordine.',
      'count-with-endings': 'un gruppo con finali si conta da essi, quindi questo conteggio è di troppo.',
      'repeat-without-previous': 'una ripetizione senza una battuta prima da ripetere.',
      'repeat-beside-items': 'un segno di ripetizione divide la battuta con altri accordi, il che non ha senso.',
      'other': 'il formato non riesce a leggere questa riga così com’è scritta.',
    },
    // L’aiuto sul formato, *Scrivere una canzone* (songs.format_help;
    // workflow 3). Frasi, nomi delle parti e parole cantate tradotte; mai i
    // segni, gli accordi, l’accordatura o `Voicings` (cifra.md §7.3).
    formatHelp: {
      open: 'Aiuto',
      title: 'Scrivere una canzone',
      intro: 'Qui una canzone è testo semplice. Pochi segni dicono all’app che cosa è musica.',
      close: 'Chiudi',
      insert: 'Inserisci',
      insertLabel: 'Inserisci l’esempio di {topic}',
      copy: 'Copia',
      copyLabel: 'Copia l’esempio di {topic}',
      copied: 'Copiato',
      copyFailed: 'Impossibile copiare — seleziona l’esempio',
      topics: {
        title: {
          heading: '1. Il titolo e i dettagli',
          text: 'La prima riga è il titolo, dopo #. Sotto, i dettagli in un elenco: di chi è, la tonalità.',
          example: '# Strada di Luna\n- artist: La Banda del Portico\n- key: G',
        },
        parts: {
          heading: '2. Le parti e il recinto della musica',
          text:
            'Ogni parte della canzone comincia con ## e il suo nome. La sua musica va tra due righe di tre apici inversi, così l’app la legge come accordi e parole. Anche ~~~ funziona, su una tastiera dove l’apice inverso è difficile da scrivere.',
          example: '## Strofa\n```\nG              C\nCammina sulla strada\n```',
        },
        chords: {
          heading: '3. Accordi sopra le parole',
          text:
            'Metti gli accordi su una riga a sé, proprio sopra le parole, ognuno sopra la sillaba dove cambia. Nessuna riga vuota tra le due. Gli accordi dentro le parole, come [G]Cammina, non vengono letti.',
          example: '## Ritornello\n```\nC          G\nCantala piano\nD             G\nFino a casa nostra\n```',
        },
        bars: {
          heading: '4. Battute',
          text: 'Una | separa le battute. % suona di nuovo la battuta precedente.',
          example: '## Introduzione\n```\nG | % | C | D\n```',
        },
        repeats: {
          heading: '5. Ripetizioni',
          text:
            '|: e :| attorno alle battute le fanno suonare due volte; x3 dopo di esse, tre volte. 1. e 2. iniziano il finale di ogni giro.',
          example: '## Ponte\n```\n|: Em | C :| x3\n|: G | C |1. D | G :|2. D | D |\n```',
        },
        bracketNames: {
          heading: '6. Nomi delle parti dentro la musica',
          text:
            '[Ritornello] su una riga a sé, dentro la musica, comincia anche lui una parte: è così che lo scrivono i siti di accordi. Tra le parentesi quadre va un nome, non un accordo.',
          example: '```\n[Ritornello]\nG | C | D | G\n```',
        },
        notes: {
          heading: '7. Note',
          text:
            'Le righe fuori dagli apici inversi sono note: mostrate come sono scritte, mai lette come accordi. Dentro la musica, una riga che comincia con // è una nota al suo posto.',
          example: '## Strofa 2\nPiù piano la seconda volta.\n```\n// chitarra sola\nG | C | D | G\n```',
        },
        voicings: {
          heading: '8. Come suonare un accordo',
          text:
            'Sotto una riga di ---, un titolo con le corde dello strumento, poi ogni accordo con i suoi tasti dalla corda più grave; x per una corda che non si suona. Arrangiare per uno strumento li scrive per te.',
          example: '---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n- C: x32010',
        },
      },
    },
    // Una sincronizzazione in background ha unito una nuova versione sotto le
    // modifiche non salvate dell'editor aperto (songs.edit_in_place, workflow 8;
    // W08). L'avviso non modale indica da chi proviene e apre la cronologia della
    // canzone. `{name}` è il nome di chi ha fatto la modifica. Riusa il testo
    // della lettura (reading.updatedBy).
    mergedUnderLead: 'Il salvataggio di {name} è arrivato mentre modificavi',
    mergedUnderRest: ', ed è stato unito sotto le tue modifiche. Le tue sono ancora qui, non salvate, sopra.',
    cameIn: 'Arrivato',
    seeWhatCameIn: 'Vedi cosa è arrivato',
    updateDismiss: 'Chiudi avviso di aggiornamento',
    // The editor app bar's word mark while the working text differs from the last
    // saved version (sync.in_place_notices; W08#3 L96, W04 L107/L158).
    unsaved: 'modifiche non salvate',
    // The phone's unsaved strip and the computer's Unsaved pane (songs.editor_chrome;
    // W04#1 L35-38, W04#4 L163-168).
    keptOnDevice: 'Conservate su questo dispositivo',
    unsavedList: 'Non salvati',
    variationInUse: 'Variazione:',
    variationLabel: 'Quale variazione usare',
    variationDefault: 'Predefinito',
    variationAdd: 'Aggiungi una variazione',
    variationHelp:
      'Uno strumento può avere più variazioni in un brano: una facile e una più piena, ' +
      'per esempio. Stanno tutte nel testo, ognuna sotto il proprio titolo; quella in cui ' +
      'stai lavorando è ricordata per brano.',
    variationName: 'Nome di questa variazione',
    variationPlaceholder: 'Più su sul manico',
    variationCopy: 'Partire dalle forme di “{name}”',
    variationNeedsName: 'Dai un nome alla variazione.',
    variationTaken: 'C’è già una variazione chiamata “{name}” per questo strumento.',
    variationCancel: 'Annulla',
    variationConfirm: 'Aggiungi',
    chartBarNumbers: 'Mostrare i numeri di battuta',
    chartVoicedAs: 'Chiamare gli accordi della cifra come suonano le forme',
    back: '← Tutte le canzoni',
    titleLabel: 'Titolo della canzone',
    title: 'Titolo',
    song: 'La canzone',
    placeholder: '# Strofa\nA | Cm | A | Cm',
    notAChord: 'Non è un accordo: {list}',
    badVoicingLines: 'Non riesco a leggere queste righe di voicing: {list}',
    chart: 'Lo schema',
    chartHelp: 'Clicca un accordo per scegliere come si suona lì.',
    nothingYet: 'Ancora niente di scritto.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', con la forma predefinita',
    chordUnvoiced: ', senza diteggiatura possibile',
    chordChoose: '. Scegli un voicing.',
    voicings: 'Voicing',
    voicingsHelp: 'Clicca una forma per cambiarla ovunque sia usata.',
    voicingsDefaults:
      ' Le forme segnate come predefinite sono ciò che la schermata degli accordi mostrerebbe per prima; scegli solo quelle che ne hanno bisogno.',
    voicingsEmpty: 'Scrivi la canzone qui sopra e i suoi accordi compaiono qui.',
    voicingsList: 'Voicing usati in questa canzone',
    choose: 'Scegli',
    change: 'Cambia',
    everywhere: '{verb} {key} ovunque. ',
    usingDefault: 'Con la forma predefinita. ',
    usedIn: { one: 'Usato in {count} punto.', other: 'Usato in {count} punti.' },
    default: 'predefinita',
    missing: 'Nessuna forma suonabile su {label} per: {list}. Le sue regole di voicing potrebbero essere troppo rigide.',
    share: 'Condividi link',
    snapPage: 'Allinea questa pagina',
    previousPage: 'Pagina precedente',
    nextPage: 'Pagina successiva',
    pageOf: 'Pagina {current} di {total}',
    print: 'Stampa',
    shareLabel: 'Link per condividere questa canzone',
    shareHelp: 'Chi apre questo link vede la canzone così com’è scritta.',
  },

  picker: {
    enter: 'Comporre una forma',
    editCurrent: 'Modificare questa forma',
    changeEverywhere: 'Cambia {label} ovunque',
    howPlayed: 'Come si suona {chord} qui?',
    noParse: 'Quell’accordo non si capisce.',
    none: 'Nessuna diteggiatura per {chord} su {label}. Le sue regole di voicing potrebbero essere troppo rigide.',
    replaces: { one: 'Sostituisce questa forma in {count} punto. ', other: 'Sostituisce questa forma in {count} punti. ' },
    ways: '{count} modi di suonarlo, raggruppati per posizione e dal più facile al più difficile.',
    changesOne: 'Cambia solo questo accordo. ',
    chosen: ', scelta al momento',
    clearEverywhere: 'Rimuovi ovunque',
    clearChoice: 'Rimuovi la scelta',
    cancel: 'Annulla',
  },

  wizard: {
    open: 'Assistente delle forme',
    previewOfPlan: 'Anteprima del piano',
    shapesFor: 'Forme · {variation}',
    barHelp: 'Scegli le forme per tutto il brano in una volta.',
    title: 'Scegliere le forme per tutto il brano',
    help:
      'Ognuno di questi scegli una forma per ogni accordo del brano, tenendo conto del ' +
      'percorso della mano lungo la cifra invece di giudicare ogni accordo da solo. Vedi ' +
      'cosa farebbe prima che cambi qualcosa.',
    planners: {
      smoothest: {
        name: 'Il percorso più scorrevole',
        text:
          'Lascia la mano dov’è ed evita salti nella voce più acuta. Due forme facili ai due ' +
          'capi del manico costano più in sequenza di due intermedie vicine.',
        how: [
          'Ogni forma che la ricerca offre per l’accordo è una candidata.',
          'Ognuna è valutata per quanto è difficile da tenere, più quanto dovrebbero muoversi ' +
            'la mano e la voce più acuta rispetto alla forma precedente.',
          'La cifra è percorsa nell’ordine di lettura, così ogni scelta risponde a quella prima.',
        ],
      },
      openPosition: {
        name: 'Vicino al capotasto',
        text:
          'La forma più bassa di ogni accordo, con le corde a vuoto dove aiutano. Le forme ' +
          'che un principiante già conosce.',
        how: [
          'Ogni forma che la ricerca offre per l’accordo è una candidata.',
          'Ognuna è valutata per quanto è difficile da tenere, più quanto sale sul manico, ' +
            'meno un credito per ogni corda a vuoto.',
          'La cifra è percorsa nell’ordine di lettura, così ogni scelta risponde a quella prima.',
        ],
      },
      choroCentro: {
        name: 'Choro, accanto a una sette corde',
        text:
          'La parte della chitarra a sei corde in un regional: basso col pollice e tre dita, ' +
          'nel primo quarto del manico, col basso una terza sopra quello che suona la sette ' +
          'corde, così che le due non si raddoppino.',
        how: [
          'Le forme sono enumerate, non cercate. La ricerca ordinaria scarta una forma con ' +
            'corde smorzate quando ce n’è una più piena e altrettanto facile, cosa giusta per ' +
            'chi suona da solo e sbagliata qui, dove le corde basse tacciono perché le ha la ' +
            'sette corde.',
          'Quattro corde che suonano, o cinque. Quattro è la norma in questo idioma e cinque ' +
            'l’eccezione occasionale: un basso col pollice e il resto con tre dita.',
          'Oppure tre note, col pollice sulla quarta corda e la corda bassa soppressa, che ' +
            'una fonte dà come l’altra tessitura dell’idioma. Solo per un accordo con settima: ' +
            'quel che esce è una fondamentale o una quinta, ed è permesso perché il tritono — ' +
            'la terza e la settima — continua a suonare. Offerta, non preferita: le ' +
            'trascrizioni mostrano quattro voci in quella posizione.',
          'Le corde che suonano sono vicine, col pollice sulla più bassa, sulla seconda più ' +
            'bassa o sulla quarta, e la presa che arriva almeno alla seconda corda dall’alto. ' +
            'Un buco in mezzo è una decisione che puoi ancora prendere; una forma che ne ha ' +
            'bisogno non si disfa.',
          'Niente sopra il settimo tasto, corde a vuoto benvenute, e il basso della presa fra ' +
            'il mi grave e il re sopra di esso. È il tratto di manico che le fonti nominano e ' +
            'il registro in cui le trascrizioni dell’Época de Ouro stanno davvero.',
          'La nota più bassa sta una terza sopra quello che suona la sette corde — la nota ' +
            'dopo la barra quando la cifra ne scrive una, la fondamentale altrimenti — ' +
            'nell’ottava in cui si trova quella chitarra. È tutto qui: le due chitarre ' +
            'prendono rivolti diversi per non raddoppiarsi.',
          'Dove una terza sopra quel basso non appartiene all’accordo, un’altra relazione ne ' +
            'prende il posto — quale, lo decide la scelta qui sotto. Il caso è nominato nella ' +
            'letteratura, non è una lacuna di qui: una terza sopra la settima di una ' +
            'dominante che risolve su un accordo maggiore cade su una nota che lo stile non ' +
            'usa.',
          'Ogni nota dell’accordo è mantenuta tranne la quinta, che è quella che questo ' +
            'idioma lascia — a meno che quella quinta sia diminuita o aumentata, perché una ' +
            '5b o una 5# è ciò che rende l’accordo quell’accordo.',
          'La cifra è percorsa nell’ordine di lettura, preferendo forme che tengano le stesse ' +
            'corde in vibrazione, ed è questo che trasforma una serie come Gm, Gm6, Gm7 in una ' +
            'sola presa con un dito che si muove.',
          'Dove due forme costano uguale, vince quella più in basso sul manico, e un accordo ' +
            'più pieno batte uno che spende una corda a raddoppiare una nota.',
        ],
        options: {
          whenNoThirdAbove: {
            label: 'Quando nessuna terza sopra l’altra chitarra è nell’accordo',
            values: {
              sixth: 'Una sesta, poi un’ottava',
              thirdBelow: 'Una terza sotto',
            },
            rules: {
              sixth:
                'Dove una terza sopra il basso dell’altra chitarra non appartiene ' +
                'all’accordo, si usa una sesta sopra di esso, e in mancanza di quella ' +
                'un’ottava. Sono i primi rimedi che la letteratura dà per quel caso.',
              thirdBelow:
                'Dove una terza sopra il basso dell’altra chitarra non appartiene ' +
                'all’accordo, la presa scende a una terza SOTTO di esso, posandosi sulla ' +
                'quinta — il secondo rivolto. La letteratura lo dà per lo stesso caso, lo ' +
                'descrive come in perfetto accordo con lo stile e nomina la registrazione da ' +
                'cui viene.',
            },
          },
        },
      },
    },
    summary: {
      one: '{count} accordo su {total} cambierebbe.',
      other: '{count} accordi su {total} cambierebbero.',
    },
    covers: {
      one: '{count} battuta',
      other: '{count} battute',
    },
    nothing: 'Ogni accordo ha già la forma che questo scegliereb­be.',
    missing: 'Nessuna forma per {list}.',
    how: 'Come funziona',
    howTitle: 'Come sceglie',
    sources: 'Da dove viene',
    noSources: 'Nessuna fonte: è una regola pratica sulle mani, non un’affermazione su come si suona la musica di qualcuno.',
    apply: 'Usa queste forme',
    back: 'Indietro',
    cancel: 'Annulla',
    preview: 'Vedi il piano',
    policyLabel: 'Scegli un approccio',
    previewTitle: 'Le forme che sceglierebbe',
    planReady: 'Il piano è pronto',
    planReadyPrompt:
      '{variation} ha già forme scelte in questo brano. Mettere il piano accanto a esse, o sopra di esse?',
    choiceLabel: 'Dove mettere il piano',
    newVariation: 'In una nuova variazione',
    newVariationHint: '{variation} resta com’è',
    over: 'Sopra {variation}',
    overHint: 'Sostituisce ciò che è scelto lì',
    defaultName: 'Nuove forme',
    editNote:
      'In entrambi i casi è una modifica nella copia di lavoro: il foglio di salvataggio mostra cosa ha scelto, e annullare la disfa.',
    write: 'Scrivi il piano',
  },

  shape: {
    foreign: '{note}, fuori dall’accordo',
    title: 'Comporre una forma',
    titleFor: 'Comporre una forma per {chord}',
    help:
      'Clicca su un tasto per metterci un dito, e di nuovo per toglierlo. La fila sopra il ' +
      'capotasto alterna la corda fra a vuoto e non suonata.',
    frets: 'Tasti da {from} a {to}',
    towardsNut: 'Sposta la finestra verso il capotasto',
    upTheNeck: 'Sposta la finestra su per il manico',
    sketch: 'Forma in composizione: {shorthand}',
    unplayable: 'Nessuna mano per questo',
    empty: 'Ancora niente su nessuna corda.',
    clear: 'Pulisci',
    cancel: 'Annulla',
    save: 'Usa questa forma',
  },

  print: { legend: 'Forme degli accordi usate' },

  confirm: { cancel: 'Annulla', confirm: 'Elimina' },

  install: {
    title: 'Aggiungi Explore Chords alla schermata iniziale',
    label: 'Installa questa app',
    promptHelp: 'Si apre come un’app e continua a funzionare senza rete — comodo a lezione.',
    iosHelp:
      'Tocca Condividi, poi "Aggiungi alla schermata Home". Da lì si apre come un’app e funziona senza rete.',
    install: 'Installa',
    notNow: 'Non ora',
    gotIt: 'Capito',
    never: 'Non chiedere più',
  },

  update: {
    ready: 'È pronta una nuova versione.',
    reload: 'Ricarica ora',
    dismiss: 'Ignora',
  },

  announce: {
    whatsNew: 'Novità',
    showTutorial: 'Mostra il tutorial',
    letsGo: 'Andiamo',
    close: 'Chiudi',
    sinceLast: 'Cosa è cambiato dalla tua ultima visita',
  },

  announcements: {
    welcome: {
      title: 'Benvenuto in Explore Chords',
      sections: [
        {
          heading: 'Trova un accordo',
          text:
            'Scrivilo come lo scrivi tu — C7M, Cmaj7 o C∆7 vanno tutti bene — e compaiono tutti i ' +
            'modi di suonarlo sul tuo strumento, raggruppati per dove si trova la mano e dal più ' +
            'facile al più difficile. Quando un simbolo può voler dire due cose, un avviso dice ' +
            'quale lettura è stata scelta e ti lascia cambiarla.',
        },
        {
          heading: 'Prima viene il tuo strumento',
          text:
            'Il selettore nell’intestazione passa tra gli strumenti che hai impostato. Ognuno ' +
            'conserva la sua accordatura e le sue regole di voicing; la schermata Strumento è dove ' +
            'le modifichi, e dove a un basso e a un ukulele è permesso volere cose diverse.',
        },
        {
          heading: 'Salva le forme che ti piacciono',
          text:
            'Metti una stella a una forma e va tra i Salvati. Poi, un accordo per cui hai una forma ' +
            'salvata prende quella forma da solo la prima volta che compare in una canzone.',
        },
        {
          heading: 'Scrivi le canzoni come testo',
          text:
            'In Canzoni, uno schema è testo semplice: una riga che comincia con # dà il nome a una ' +
            'sezione, una barra verticale apre una battuta, gli spazi separano gli accordi al suo ' +
            'interno. Clicca un accordo per scegliere come si suona; la scelta viene riscritta nel ' +
            'testo dopo una riga ---, un blocco per accordatura, così la stessa canzone serve per ' +
            'tutti gli strumenti.',
        },
        {
          heading: 'Funziona senza segnale',
          text:
            'Una volta caricata, tutto gira sul tuo dispositivo. Aggiungila alla schermata iniziale ' +
            'e portala a lezione senza nessuna rete.',
        },
      ],
    },
    '0.2.0': {
      title: 'Cosa è cambiato nella 0.2',
      sections: [
        {
          heading: 'Una canzone, tutti gli strumenti',
          text:
            'Una canzone non appartiene più a uno strumento. I suoi voicing sono conservati per ' +
            'accordatura, dopo una riga --- nel testo, così lo stesso schema si suona sulla tua ' +
            'chitarra e sul tuo ukulele, ognuno con le sue forme. Le canzoni salvate nel formato ' +
            'precedente si convertono da sole, e le copie separate per strumento di una stessa ' +
            'canzone si fondono in una.',
        },
        {
          heading: 'Gli accordi senza forma scelta ne hanno comunque una',
          text:
            'Prendono la forma che la schermata degli accordi mostrerebbe per prima, segnata come ' +
            'predefinita. Scegli solo quelli che ne hanno bisogno.',
        },
        {
          heading: 'Le forme salvate entrano nelle canzoni',
          text:
            'Una forma a cui hai messo la stella viene usata appena il suo accordo entra in una ' +
            'canzone, se è diversa da quella predefinita.',
        },
        {
          heading: 'B° è la settima',
          text:
            'Un ° da solo ora si legge come settima diminuita, che è ciò che il simbolo significa ' +
            'in pratica; la parola dim è la triade, e un avviso offre l’altra lettura.',
        },
      ],
    },
    '0.3.0': {
      title: 'Cosa è cambiato nella 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'L’app ora parla portoghese brasiliano, spagnolo latinoamericano e italiano, oltre ' +
            'all’inglese. Segue la lingua del browser; il selettore nell’intestazione la cambia, ' +
            'e la scelta viene ricordata su questo dispositivo.',
        },
        {
          heading: 'Schemi allineati',
          text:
            'Sullo schermo e in stampa, le battute di una sezione stanno in colonne, come in uno ' +
            'schema scritto a mano, e il foglio stampato comincia dallo schema e tiene le forme ' +
            'piccole sotto.',
        },
      ],
    },
    '0.4.0': {
      title: 'Cosa è cambiato nella 0.4',
      sections: [
        {
          heading: 'Strumming o fingerstyle',
          text:
            'Le regole che si chiamavano Standard ora si chiamano Strumming, e accanto a loro ' +
            'c’è Fingerstyle. Chi suona con le dita semplicemente non pizzica la corda in mezzo ' +
            'all’accordo, quindi il fingerstyle ammette forme che lo strumming non raggiunge. ' +
            'Quando configuri uno strumento la domanda te la fa, e la schermata dello strumento ' +
            'la cambia in seguito.',
        },
        {
          heading: 'Niente più corde stoppate per niente',
          text:
            'Una forma non viene più proposta quando esiste anche la stessa forma con una delle ' +
            'sue corde stoppate che suona, e le dita che la riempiono scendono senza fatica. Sol ' +
            'minore ti dà 3x0333, con il re che suona, invece di 3xx333, che lo stoppa senza ' +
            'motivo, e il do a corde vuote arriva intero invece che a pezzi. Un allungo o un ' +
            'barré contano ancora come lavoro, quindi le forme che ne hanno bisogno ci sono ' +
            'tutte. E una corda stoppata in mezzo ha smesso di pesare sulla difficoltà: con le ' +
            'dita, una corda che non pizzichi non costa nulla.',
        },
      ],
    },
    '0.5.0': {
      title: 'Cosa è cambiato nella 0.5',
      sections: [
        {
          heading: 'Canzoni con il testo',
          text:
            'Ora una canzone si può scrivere come una cifra: una riga di accordi sopra la riga ' +
            'su cui si canta, ogni accordo sopra la sillaba su cui cade. Incollane una e viene ' +
            'letta così, con [Intro] e Intro: che danno il nome alle sezioni come già fa #. Il ' +
            'testo la segue sul foglio stampato, che ora esce su due colonne quando la canzone è ' +
            'abbastanza stretta — di solito dimezzando le pagine. E sul telefono la strofa va a ' +
            'capo invece di scappare di lato.',
        },
        {
          heading: 'Gli schemi di sempre restano uguali',
          text:
            'Una canzone senza testo sotto gli accordi viene letta esattamente come prima. ' +
            'Quando una riga potrebbe essere entrambe le cose, una barra verticale la rende ' +
            'schema e un > iniziale la rende testo: l’unico modo di risolvere una strofa che ' +
            'dice davvero "A", contro l’accordo con lo stesso nome.',
        },
      ],
    },
    '0.6.0': {
      title: 'Cosa è cambiato nella 0.6',
      sections: [
        {
          heading: 'La canzone si apre per essere letta',
          text:
            'Ora ogni canzone ha una pagina propria che la mostra come uscirà sulla carta — il ' +
            'testo sotto gli accordi e le forme che suoni — invece di aprire l’editor. Il testo ' +
            'resta a un clic, e la lista offre entrambe le strade.',
        },
        {
          heading: 'Una pagina alla volta',
          text:
            'Quella pagina è divisa in pagine grandi come il tuo schermo, così si vede dove la ' +
            'canzone va oltre la fine di una. Le frecce nell’angolo le girano e mettono una ' +
            'pagina intera in chiaro, il che rende suonare guardando lo schermo un girare ' +
            'pagina invece che uno scorrere. Il loro centro riallinea la pagina dopo uno ' +
            'scorrimento a mano, e la barra in alto non si prende più una striscia di finestra.',
        },
        {
          heading: 'Le cifre si leggono meglio',
          text:
            'Le parentesi attorno a una sequenza di accordi segnano una ripetizione e non ' +
            'vengono più lette come accordi. Gli accordi che continuano oltre la fine del testo ' +
            'mantengono la spaziatura con cui sono stati scritti. E una strofa che va a capo su ' +
            'una riga di una parola viene letta come testo, non come un accordo che nessuno ' +
            'riconosce.',
        },
      ],
    },
    '0.7.0': {
      title: 'Cosa è cambiato nella 0.7',
      sections: [
        {
          heading: 'Salva tutto in un file',
          text:
            'Tutto quello che hai è tenuto in questo browser, che va bene finché non va bene ' +
            'il dispositivo. La schermata dello strumento ora salva tutto in uno zip — i tuoi ' +
            'strumenti e le loro regole, le impostazioni, le forme salvate e ogni canzone — e ' +
            'lo ripristina qui o su un altro dispositivo.',
        },
        {
          heading: 'Le tue canzoni sono file di testo',
          text:
            'Dentro lo zip ogni canzone è un file di testo che puoi leggere o modificare con ' +
            'qualsiasi cosa. Mettine un altro nella cartella songs con qualunque programma di ' +
            'zip e torna come canzone, col nome del suo file. Il backup è tuo da conservare, ' +
            'non un formato che capisce solo questa app.',
        },
      ],
    },
    '0.8.0': {
      title: 'Cosa è cambiato nella 0.8',
      sections: [
        {
          heading: 'Un promemoria per il backup',
          text:
            'Il backup ora ha una schermata sua, e la lista delle canzoni avvisa quando ci sono ' +
            'canzoni che non stanno in nessun backup — perché un Android nuovo non le porta ' +
            'con sé, e un browser che cancella i dati se le porta via. Sul telefono, salvare ' +
            'passa il file al menu di condivisione, dove stanno Drive, File e iCloud.',
        },
        {
          heading: 'Le pagine si riempiono in basso prima che di lato',
          text:
            'Leggendo una canzone, una colonna ora arriva in fondo alla pagina prima che ' +
            'qualcosa della canzone vada di lato. Prima, qualche strofa su uno schermo largo ' +
            'usciva come una riga in cima a una pagina vuota. Una seconda colonna è una pagina ' +
            'risparmiata, non larghezza da consumare.',
        },
        {
          heading: 'Gli accordi si tengono le loro parentesi',
          text:
            'Em7(b5), A7(b13) e C7(9) venivano letti come un accordo chiamato Em7(b5 con una ' +
            'parentesi spaiata accanto, perché le parentesi segnano anche una ripetizione. Ora ' +
            'è marca di ripetizione solo la parentesi che niente chiude, o che niente ha aperto.',
        },
      ],
    },
    '0.9.0': {
      title: 'Cosa è cambiato nella 0.9',
      sections: [
        {
          heading: 'Il segno di ripetizione',
          text:
            'Uno schema può usare % per una battuta che continua come la precedente, e viene ' +
            'letto così, non come un accordo che nessuno riconosce. Si vede come l’hai ' +
            'scritto, senza diventare l’accordo che rappresenta, e non c’è niente da ' +
            'scegliere: l’accordo che ripete ha già la sua forma dove è stato scritto.',
        },
      ],
    },
    '0.10.0': {
      title: 'Cosa è cambiato nella 0.10',
      sections: [
        {
          heading: 'Ogni diagramma della stessa misura',
          text:
            'Una forma più su sul manico porta il numero del tasto, e lo spazio per quel ' +
            'numero rendeva il diagramma più largo degli altri, lasciando la fila irregolare e ' +
            'ogni griglia fuori centro sotto il suo nome. Ora ogni diagramma riserva quello ' +
            'spazio, che serva o no. Anche il numero del tasto è più grande, e così i ' +
            'diagrammi sul foglio stampato: erano troppo piccoli da leggere dal leggio.',
        },
        {
          heading: 'Come suona davvero la forma',
          text:
            "Il nome dell'accordo dice qual è l'armonia. La forma decide quale delle sue note " +
            'finisce più in basso, e se la fondamentale suona. Dove le due cose divergono, il ' +
            'nome porta ora una nota discreta di quello che stai davvero tenendo: un Gm7 con ' +
            'la terza sotto si legge Gm7/Bb. Conta di più quando un altro strumento fa il ' +
            'basso, perché allora prendere un rivolto diverso è l\'arrangiamento e non un caso.',
        },
        {
          heading: 'L’assistente delle forme',
          text:
            'Un pulsante sopra la cifra scegli le forme per tutto il brano in una volta. Tre ' +
            'modi per ora: il percorso più scorrevole per la mano, vicino al capotasto, o la ' +
            'parte della chitarra a sei corde in un regional di choro accanto a una sette ' +
            'corde. Mostra cosa farebbe prima che cambi qualcosa, e ognuno spiega le proprie ' +
            'regole e cita le proprie fonti sotto “Come funziona”.',
        },
        {
          heading: 'O chiamare la cifra come suoni davvero',
          text:
            'Una casella nella pagina di lettura chiama gli accordi della cifra come suonano ' +
            'le forme scelte, così Gm si legge Gm/Bb quando la sua forma mette la terza ' +
            'sotto. Spento per impostazione predefinita, dato che una cifra nomina ' +
            'l’armonia. Vale anche per il foglio stampato, perché è lo stesso renderizzatore.',
        },
      ],
    },
    '0.11.0': {
      title: 'Cosa è cambiato nella 0.11',
      sections: [
        {
          heading: 'Comporre una forma cliccando',
          text:
            'L’elenco delle forme di un accordo è quello che ha trovato la ricerca, che non ' +
            'serve quando sai già cosa vuoi suonare e non c’è. I due modi di scegliere una ' +
            'forma ora offrono anche un diagramma grande da cliccare: un tasto per metterci un ' +
            'dito, di nuovo per toglierlo, la fila sopra il capotasto per alternare la corda ' +
            'fra a vuoto e non suonata. Parte dalla forma in uso, o da zero, e ti lascia ' +
            'salvare un’apertura per cui non trova le dita: una forma può essere giusta e ' +
            'scomoda. Sotto ci sono le note che tiene, con qualsiasi nota fuori dall’accordo ' +
            'segnata.',
        },
        {
          heading: 'Le forme scendono lungo la pagina sul telefono',
          text:
            'Le forme di un brano e quelle salvate stavano su una sola fila che scorreva di ' +
            'lato, lasciando sette forme su otto fuori dallo schermo con tutta l’altezza della ' +
            'pagina libera. Ora vanno a capo. I risultati degli accordi scorrono ancora di ' +
            'lato, perché là c’è un ordine e il primo della fila è la risposta.',
        },
        {
          heading: 'Meno pagine quando si legge un brano',
          text:
            'Un brano con righe di cifra più larghe dello schermo del telefono usciva con una ' +
            'pagina per ogni titolo di sezione e le forme tagliate di lato. Ora la cifra ' +
            'occupa l’unica pagina che le serve, e le forme continuano fra le pagine invece di ' +
            'essere tagliate.',
        },
      ],
    },
    '0.12.0': {
      title: 'Cosa è cambiato nella 0.12',
      sections: [
        {
          heading: 'Numeri di battuta',
          text:
            'Trascrivere da uno spartito vuol dire spesso riscriverne la struttura: una ' +
            'ripetizione si scrive per esteso, perché così si suona meglio. Allora le battute ' +
            'della cifra smettono di corrispondere ai numeri dello spartito, e “dalla battuta ' +
            '9” deve voler dire la battuta 9 dello spartito. Così le battute si contano da ' +
            'sole, e @9 all’inizio di una battuta dice qual è davvero il suo numero — anche su ' +
            'un titolo, come # A @9. I numeri vanno nel margine della pagina di lettura, e sul ' +
            'foglio stampato con essa. Spenti finché non li chiedi, e non offerti per un brano ' +
            'con il testo, dove un accordo può durare quattro battute o mezza e la cifra non ' +
            'dice quale.',
        },
        {
          heading: 'Si trova come comporre una forma',
          text:
            'Un accordo ha tante forme quante ne ha — quarantatré per un C sulla chitarra — e ' +
            'i pulsanti stavano sotto quell’elenco, cosa che sul telefono li portava tutti ' +
            'oltre il fondo dello schermo. Ora stanno sopra l’elenco, sotto il titolo.',
        },
      ],
    },
    '0.13.0': {
      title: 'Cosa è cambiato nella 0.13',
      sections: [
        {
          heading: 'Più di un modo di suonare lo stesso brano',
          text:
            'Un brano teneva un insieme di forme per strumento. Ora può tenerne più di uno: ' +
            'una versione facile e una più piena, o due passaggi dell’assistente affiancati ' +
            'per confrontarli. La parola prima dei due punti nel titolo delle forme dà il nome ' +
            'alla variazione, così “# Più su: E2, A2, …” è una variazione chiamata Più su. ' +
            'Aggiungine una sopra le forme, partendo da quella in cui sei o da zero, e passa ' +
            'fra loro lì o nella pagina di lettura. Un accordo di cui la variazione non dice ' +
            'niente resta sulla sua forma predefinita, come prima.',
        },
        {
          heading: 'Via un “null” di troppo',
          text:
            'La pagina di lettura di un brano con il testo mostrava la parola null sotto il ' +
            'titolo, e così il pannello delle forme di un brano senza accordi. Entrambi sono ' +
            'corretti, insieme al motivo per cui succedeva.',
        },
      ],
    },
    '0.14.0': {
      title: 'Cosa è cambiato nella 0.14',
      sections: [
        {
          heading: 'L’assistente choro chiede come vuoi suonarlo',
          text:
            'Alcune domande di questo stile non hanno una risposta giusta, solo una ' +
            'preferenza. Quando la sette corde sale di un semitono — fa a fa#, in una battuta ' +
            'di F e una di F#° — una terza sopra è la in entrambe, così la sei corde prende ' +
            'due volte la stessa nota al basso. Un chorão può fare esattamente questo, oppure ' +
            'scendere a una terza sotto. Entrambe sono nella letteratura. Quella scelta sta ora ' +
            'accanto alle forme: giralà e guarda rispondere tutto il brano. L’elenco “Come ' +
            'sceglie” gira con lei, così quel che dice è sempre quel che sta per fare.',
        },
        {
          heading: 'Accordi che lasciava in bianco',
          text:
            'Una dominante con la settima al basso — C7/Bb diretto a F — tornava senza alcuna ' +
            'forma. Una risposta documentata c’è: la sei corde va una terza SOTTO l’altra ' +
            'chitarra e si posa sulla quinta, C7/G. Ora suona quella. A Cm7 mancava la terza ' +
            'per un motivo simile. E una dominante può ora essere suonata con tre note e il ' +
            'pollice sulla quarta corda, che è l’altra tessitura dello stile e qui semplicemente ' +
            'non c’era.',
        },
        {
          heading: 'Gli accordi diminuiti tengono il loro tritono',
          text:
            'Chiedendo F#°, l’assistente dava quattro corde senza alcun tritono e una di esse ' +
            'spesa a raddoppiare una nota. La quinta è la nota che questo stile lascia — ma non ' +
            'quando è diminuita, che è proprio quella che rende diminuito l’accordo. Ora resta, ' +
            'e così la quinta aumentata dell’accordo aumentato.',
        },
        {
          heading: 'Un accordo, due forme, dove il brano le chiede',
          text:
            'L’assistente sceglieva una forma per accordo per tutto il brano. Ora può dare allo ' +
            'stesso accordo una forma diversa in un’altra battuta, dove la sua politica lo ' +
            'richiede, e scrive da sé il segno di rimando. L’anteprima mostra il brano come ' +
            'sarà — le forme che porterà e quante battute copre ciascuna — così un accordo ' +
            'diviso in due è qualcosa che vedi prima di accettare e non dopo.',
        },
      ],
    },
    '0.15.0': {
      title: 'Cosa è cambiato nella 0.15',
      sections: [
        {
          heading: 'Una tesi che non si trovava',
          text:
            'L’assistente choro segue fonti scritte, e l’unico lavoro dedicato interamente ' +
            'alla parte della chitarra a sei corde — José Paulo Becker sull’Época de Ouro, ' +
            '1996 — non si trovava da nessuna parte. È saltato fuori. Tutto quel che segue ' +
            'viene dal leggerlo, ed è per questo che questa versione corregge cose che la ' +
            '0.14 aveva solo a metà. Ora è elencato in “Da dove viene”, con le altre.',
        },
        {
          heading: 'La domanda che ti fa è migliore',
          text:
            'Prima chiedeva cosa fare quando la terza sopra l’altra chitarra ripeteva la nota ' +
            'appena suonata. Nessuna fonte lo chiede — e Becker, che documenta questa parte ' +
            'nel dettaglio, non mette mai la sei corde sotto la sette corde. Così la domanda ' +
            'è ora quella che la letteratura pone davvero: quando nessuna terza sopra ' +
            'l’altra chitarra è nell’accordo, vuoi una sesta e poi un’ottava, o la terza ' +
            'sotto? C7/Bb diretto a F è il caso, e si sentono entrambe.',
        },
        {
          heading: 'Arriva al cantino, e resta nel suo registro',
          text:
            'Due fonti non concordano su dove vadano le dita, e ha vinto quella che trascrive ' +
            'esecuzioni reali. La chitarra di Becker nell’Época de Ouro usa il cantino di ' +
            'continuo — un re minore col re sotto la, re e fa, di traverso sulle prime quattro ' +
            'corde — così l’assistente ora offre quelle forme. Misurare le sue trascrizioni ha ' +
            'dato anche il registro in cui la parte sta davvero, mai sotto il mi a vuoto e per ' +
            'lo più fra il sol e il re sopra, e l’assistente ora ci resta invece di salire sul ' +
            'manico.',
        },
        {
          heading: 'E una cosa lasciata apposta com’era',
          text:
            'La dominante di tre note col pollice sulla quarta corda, novità della 0.14, si ' +
            'regge su una fonte sola. Becker non parla mai di sopprimere una corda, e le sue ' +
            'trascrizioni mostrano quattro voci in quella posizione. Così la forma è ancora ' +
            'offerta e non è più preferita. Dove “Come sceglie” dipende da una fonte sola, o ' +
            'dalla nostra lettura e non dalla loro, ora lo dice.',
        },
      ],
    },
  },

  instr: {
    chip: {
      change: '{label}, cambia strumento',
      description: '{catalogue}, accordatura {tuning}: {pitches}',
      descriptionCustom: '{catalogue}, accordatura personalizzata: {pitches}',
    },
    roster: {
      title: 'Strumenti',
      inUse: 'in uso',
      reentrant: 'rientrante',
      strings: { one: '{count} corda', other: '{count} corde' },
      open: 'Apri {label}',
      add: 'Aggiungi strumento',
      addMeta: 'catalogo, un’accordatura, un nome',
      footer:
        'Quello in uso modella ogni accordo che l’app mostra. Cambiarlo ri-deriva tutto all’istante — un tocco. Uno strumento in uso per volta.',
      back: 'Indietro',
    },
    add: {
      title: 'Aggiungi strumento',
      cancel: 'Annulla',
      instrument: 'Strumento',
      tuning: 'Accordatura',
      tuningGroup: 'Scegli un’accordatura',
      custom: 'Personalizzata…',
      customOption: 'Accordatura personalizzata',
      customPlaceholder: 'E2 A2 D3 G3 B3 E4',
      tuningHelp:
        'L’accordatura è l’identità dello strumento — la stessa grafia che usa il blocco di voicing di una canzone (cifra.md §6). Un capotasto è un’accordatura; non c’è un campo capotasto.',
      name: 'Nome',
      howYouPlay: 'Come suoni',
      howYouPlayHelp: 'Il preset. Regola le singole regole dopo, nella schermata dello strumento.',
      submit: 'Aggiungi strumento',
      badTuning: 'Questa accordatura non si legge: {reason}',
    },
    detail: {
      use: 'Usa questo strumento',
      inUse: 'in uso',
      definition: 'Definizione',
      edit: 'Modifica',
      catalogue: 'Catalogo',
      tuning: 'Accordatura',
      frets: 'Tasti',
      voicingRules: 'Regole di voicing',
      editRules: 'Modifica le regole',
      remove: 'Rimuovi strumento',
    },
    rules: {
      title: 'Regole di voicing',
      preset: 'Preset',
      presetGroup: 'Preset di voicing',
      reset: 'Torna a {preset}',
      explainer:
        'Modificare una regola qualsiasi rende il preset Personalizzato e lo mantiene esattamente così. Uno strumento che nomina ancora un preset viene ricostruito da esso al caricamento; un insieme Personalizzato no.',
      rules: 'Regole',
      limits: 'Limiti',
      costs: 'Costi',
      noBass:
        'La fondamentale al basso è forzata off su uno strumento senza registro grave — un ukulele, un cavaquinho — così passare a Jazz non può romperla di nuovo.',
      on: 'attivo',
      off: 'disattivo',
      toggleLabel: '{label}, {state}',
      rule: {
        requireRoot: 'Fondamentale obbligatoria',
        rootInBass: 'Fondamentale al basso',
        requireThird: 'Terza obbligatoria',
        omitFifth: 'La quinta può essere omessa',
        allowRootless: 'Consenti senza fondamentale',
        requireExtensions: 'Estensioni obbligatorie',
        allowBarre: 'Consenti barré',
        allowInnerMutes: 'Consenti corde smorzate in mezzo',
        allowDoubling: 'Consenti raddoppio di note',
        allowDuplicatePitch: 'Consenti altezza identica ripetuta',
      },
      limit: {
        maxSpan: 'Estensione massima',
        maxSpanUnit: 'tasti',
        minSoundingStrings: 'Minimo di corde che suonano',
        maxResultsPerGroup: 'Forme per posizione',
      },
    },
    shapes: {
      heading: 'Le mie forme · {tuning}',
      saved: { one: '{count} salvata', other: '{count} salvate' },
      empty: 'Ancora nessuna forma salvata per questa accordatura. Segnane una nell’esploratore.',
      footer:
        'Segnate una alla volta nell’esploratore (flusso 16); riviste e rimosse qui. Mai scritte in una canzone.',
      remove: 'Rimuovi la tua forma di {chord}, {shorthand}',
    },
    remove: {
      title: 'Rimuovere {label}?',
      shapes: { one: 'La sua {count} forma salvata', other: 'Le sue {count} forme salvate' },
      body:
        '{shapes} e le variazioni in uso per {tuning} vengono rimosse con esso. Le tue canzoni mantengono i propri voicing — se ne vanno solo le impostazioni di questo strumento.',
      bodyNoShapes:
        'Le variazioni in uso per {tuning} vengono rimosse con esso. Le tue canzoni mantengono i propri voicing — se ne vanno solo le impostazioni di questo strumento.',
      cancel: 'Annulla',
      confirm: 'Rimuovi',
    },
  },
};
