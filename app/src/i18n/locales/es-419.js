/**
 * Español de Latinoamérica.
 *
 * Vocabulario de quien enseña guitarra: traste, cejilla, cuerda al aire,
 * digitación, cifrado. "Voicing" se queda en inglés, como se usa en la práctica.
 */
export default {
  app: { name: 'Estante de Cifras', wordmark: 'Estante' },

  ordinal: { other: '{n}ª' },

  locale: { label: 'Idioma' },

  header: {
    help: 'Ayuda',
    helpLabel: 'Ayuda y novedades',
  },

  shell: {
    nav: 'Destinos',
    search: 'Búsqueda',
    books: 'Libros',
    setlists: 'Repertorios',
  },

  // La pantalla de gestión de libros (books.shelf, flujo 7). `{name}` es el
  // título de un libro; `{count}` la cantidad de cambios esperando sincronizar.
  books: {
    back: 'Atrás',
    add: 'Agregar libro',
    addTitle: 'Agregar un libro',
    close: 'Cerrar',
    nameLabel: 'Nombre del libro',
    namePlaceholder: 'Ponle un nombre al libro',
    newBookHelp: 'Un nombre y un libro vacío. No se necesita cuenta.',
    create: 'Libro nuevo',
    byLink: 'Por enlace',
    byLinkMeta: 'Pega un enlace a un libro en Estante.',
    byLinkLabel: 'Enlace del libro',
    byLinkPlaceholder: 'https://…/i/…',
    byLinkOpen: 'Abrir',
    byLinkInvalid: 'Eso no es un enlace de libro.',
    mineOnEstante: 'Míos en Estante',
    mineMeta: 'Tus libros que aún no están en este estante.',
    mineSignedOut: 'Inicia sesión para verlos.',
    mineSignInPasskey: 'Iniciar sesión con una llave de acceso',
    mineEmailLink: '¿No tienes llave de acceso aquí? Envíame un enlace por correo',
    mineAdd: 'Agregar',
    mineAddLabel: 'Agregar {name}',
    mineLeave: 'Salir',
    mineLeaveLabel: 'Salir de {name}',
    mineEmpty: 'Todos tus libros ya están en este estante.',
    mineError: 'No pudimos conectar con Estante. Inténtalo de nuevo.',
    uploadRow: 'Subir',
    uploadRowMeta: 'Un zip de un libro, con o sin su historial.',
    uploadTitle: 'Subir {name}',
    uploadCancelSurface: 'Cancelar la subida',
    uploadWhatToDo: 'Qué hacer con esto',
    uploadWhatToDoLabel: 'Qué hacer con la subida',
    uploadAsNew: 'Importar como libro nuevo',
    uploadMerge: 'Combinar con un libro existente',
    uploadMergeInto: 'Combinar con',
    uploadNoTargets: 'Aún no tienes libros donde puedas guardar. Impórtalo como libro nuevo.',
    uploadBranch:
      'Desde la rama {branch} del zip. Las ediciones del zip que nunca se guardaron se leen como un guardado más: cambios de la subida, hechos por ti.',
    uploadSongs: 'Canción por canción',
    uploadAdded: 'agregada',
    uploadChanged: 'cambiada',
    uploadConflict: 'conflicto',
    uploadReplace: 'reemplazar',
    uploadUnresolved: 'sin resolver',
    uploadUnresolvedHelp: 'combinación sin resolver: arréglala antes de importar',
    uploadMarkerLine: 'primera marca en la línea {line}',
    uploadKeep: 'Reemplazar «{name}» con la versión subida',
    uploadLeftOutTitle: 'Quedan afuera',
    uploadLeftOutBody:
      'Un libro contiene canciones, repertorios, un README y .gitattributes, así que estos se quedan afuera.',
    uploadCanonTitle: 'Puesto en forma canónica',
    uploadCanonBody: 'Las digitaciones se ponen en orden canónico; la grilla se deja tal como está escrita.',
    uploadMarkersTitle: 'Una combinación sin terminar en el historial',
    uploadMarkersBody:
      'El commit {commit} dejó marcas de conflicto en {path}. Arréglalo en la computadora y vuelve a subir.',
    uploadMarkersLatest: 'Importar la última versión sin su historial',
    uploadConfirmCaption: 'No se escribe nada hasta que confirmes.',
    uploadConflictCaption: 'El conflicto va a la resolución.',
    uploadConfirmNew: 'Importar como libro nuevo',
    uploadConfirmMerge: 'Combinar y guardar',
    uploadBadZip: 'No se pudo leer ese archivo como un zip de libro.',
    uploadFailed: 'No se pudo completar la importación. No se escribió nada.',
    cancel: 'Cancelar',
    save: 'Guardar',
    onDevice: 'En este dispositivo',
    onEstante: 'En Estante',
    canSave: 'puede guardar',
    reader: 'lector',
    renameLabel: 'Cambiar el nombre de {name}',
    renameTitle: 'Cambiar el nombre de “{name}”',
    renameField: 'Nombre en tu estante',
    empty: 'Aún no hay libros. Agrega un libro para empezar.',
    syncing: 'sincronizando',
    savesWaiting: {
      one: '{count} cambio esperando para subir',
      other: '{count} cambios esperando para subir',
    },
    needsYou: 'te necesita',
    offline: 'sin conexión desde {time}',
    offlineUnknown: 'sin conexión',
    noLongerShared: 'ya no se comparte contigo',
    // books.fork (workflow 11): las líneas de copia propia en el estante.
    cannotSaveHere: 'no se puede guardar aquí',
    fromOriginal: 'de {original}',
    originalNewSaves: {
      one: '{original} tiene {count} cambio nuevo.',
      other: '{original} tiene {count} cambios nuevos.',
    },
    originalNoLongerShared: 'el original ya no se comparte',
    bringIn: 'Traerlos',
    bringInLabel: 'Traer los cambios de {original}',
    bringInTitle: 'Traer los cambios de {original}',
    bringInBody: {
      one: '{count} cambio nuevo en {original} desde la última vez que los trajiste. Nada se escribe en {book} hasta que confirmes.',
      other: '{count} cambios nuevos en {original} desde la última vez que los trajiste. Nada se escribe en {book} hasta que confirmes.',
    },
    bringInFetching: 'Buscando los cambios nuevos de {original}…',
    bringInNote: 'Nota',
    bringInNotePrefill: 'Trae los cambios de {original}: {titles}',
    bringInNotePrefillEmpty: 'Trae los cambios de {original}',
    bringInConflict: {
      one: '{songs} se cruza con tus propias ediciones. Después de confirmar lo resolverás un conflicto a la vez; el resto entra de una vez.',
      other: '{songs} se cruzan con tus propias ediciones. Después de confirmar los resolverás un conflicto a la vez; el resto entra de una vez.',
    },
    bringInCaption: 'Lo une a tu copia, lo guarda y lo envía a Estante.',
    bringInNotNow: 'Ahora no',
    bringInBusy: 'Trayendo los cambios…',
    bringInStale: 'Algo cambió desde esta vista previa, así que se volvió a hacer. Revísala y luego trae los cambios.',
    bringInOffline: 'Traer los cambios necesita la red. Nada cambió: conéctate y vuelve a intentarlo.',
    originalGoneTitle: 'El original ya no se comparte contigo.',
    originalGoneBody:
      'Este libro deja de seguir {original}; los cambios se trajeron por última vez el {date}. Nada más cambia: tu copia, su historial y sus canciones están aquí, y lo guardas, compartes y sincronizas como antes.',
    originalGoneBodyUndated:
      'Este libro deja de seguir {original}. Nada más cambia: tu copia, su historial y sus canciones están aquí, y lo guardas, compartes y sincronizas como antes.',
    forkedNote:
      '{book} ahora es tuyo: ocupó el lugar del original en tu estante, así que cada canción aparece una vez en la búsqueda.',
    syncNow: 'Sincronizar ahora',
    notInStep: 'Algunos libros no están al día',
    // La estantería llenándose en un dispositivo nuevo (account.new_device).
    restoredTitle: 'Libro de casa restaurado.',
    restoredBody: 'Tu instrumento, notación e idioma están configurados.',
    restoredDismiss: 'Descartar',
    restoredDismissLabel: 'Descartar el aviso del libro de casa',
    yourShelf: 'Tu estantería',
    yourShelfCount: { one: '{count} libro', other: '{count} libros' },
    fillReady: 'listo',
    fillCloning: 'descargando {percent}%',
    fillWaiting: 'en espera',
    fillReadyMeta: { one: '{count} canción · se puede buscar', other: '{count} canciones · se pueden buscar' },
    fillCloningMeta: 'canciones que se pueden buscar a medida que llegan',
    fillWaitingMeta: 'el siguiente en la fila',
    fillProgressLabel: 'Trayendo {name} a este dispositivo',
    onlyOn: 'Solo en tu {device}: {title}',
    onlyOnOther: 'Solo en otro dispositivo: {title}',
    onlyOnHelp: 'Ponlo en línea allí para tenerlo aquí.',
    // El detalle de cada libro (books.online, workflow 7 L46-63, L128-137; W07).
    detailBack: 'Volver a los libros',
    pickBook: 'Elige un libro para ver sus detalles.',
    private: 'privado',
    sharedBy: 'compartido por {owner}',
    shared: 'compartido',
    youOwn: 'Es tuyo',
    youCanSave: 'Puedes guardar',
    readOnly: 'Solo lectura',
    putOnline: 'Poner en línea',
    putOnlineBody:
      'Solo en este dispositivo. Ponerlo en línea crea el libro en Estante, privado: solo tú puedes abrirlo, hasta que invites a otras personas, como máximo 50.',
    putOnlineQuota: 'Tu cuenta está llena. Quita un libro o libera espacio y vuelve a intentarlo.',
    putOnlineSignedOut: 'Inicia sesión para poner un libro en línea.',
    putOnlineOffline: 'Estás sin conexión. Conéctate y ponlo en línea.',
    putOnlineError: 'No se pudo poner en línea. Vuelve a intentarlo.',
    lostAccessTitle: 'Ya no se comparte contigo',
    lostAccessBody:
      'Este libro ya no se comparte contigo, así que no volverá a sincronizarse. No se pierde nada: tu copia, su historial y sus canciones están todos aquí para leer, y los guardados que aún no están en Estante quedan en este dispositivo. Descárgalo, o hazlo tuyo para seguir guardando.',
    takenDownTitle: 'Este libro fue retirado',
    download: 'Descargar',
    downloadBody:
      'Un zip del repositorio tal como está en este dispositivo: todo el historial y los cambios sin guardar como archivos modificados. Cualquier herramienta git lo abre.',
    remove: 'Quitar de mi estante',
    removeBody: 'Borra solo la copia de este dispositivo. El libro sigue en Estante.',
    removeTitle: '¿Quitar “{name}” de este dispositivo?',
    removeLoss: {
      one: 'Este dispositivo tiene {count} cambio aún no enviado a Estante; quitar esta copia lo pierde. El libro sigue en Estante.',
      other:
        'Este dispositivo tiene {count} cambios aún no enviados a Estante; quitar esta copia los pierde. El libro sigue en Estante.',
    },
    removeUnsaved: {
      one: '{count} canción con cambios sin guardar se perderá',
      other: '{count} canciones con cambios sin guardar se perderán',
    },
    removeGone:
      'Este libro solo está en este dispositivo. Quitarlo lo borra para siempre — no hay copia en Estante. Descárgalo primero para conservar una copia.',
    removeConfirm: 'Quitar de mi estante',
    delete: 'Eliminar el libro',
    deleteBody: 'Lo elimina de Estante, para todos. Solo su dueño puede.',
    deleteTitle: '¿Eliminar {name} de Estante?',
    deleteModalBody:
      'Esto elimina el libro, con todo su historial, para todos los que lo comparten. No se puede deshacer.',
    deleteField: 'Escribe el nombre del libro para confirmar',
    deleteConfirm: 'Eliminar el libro',
    // Leaving one shared book (books.leave; workflow 10 §Leaving a book; Leave-book board).
    leave: 'Salir de este libro',
    leaveBody: 'Deja de seguirlo en todos tus dispositivos.',
    leaveOffline: 'Salir necesita conexión.',
    leaveOfflineBody: 'Nada cambió; sigues siendo miembro.',
    leaveTitle: '¿Salir de {name}?',
    leaveSentence: 'Ya no podrás abrirlo ni sincronizarlo, en ninguno de tus dispositivos, y se quita de este. El dueño puede invitarte de nuevo.',
    leaveSentenceRemote: 'Ya no podrás abrirlo ni sincronizarlo, en ninguno de tus dispositivos. El dueño puede invitarte de nuevo.',
    leaveSentenceNamed: 'Ya no podrás abrirlo ni sincronizarlo, en ninguno de tus dispositivos, y se quita de este. {owner} puede invitarte de nuevo.',
    leaveSentenceRemoteNamed: 'Ya no podrás abrirlo ni sincronizarlo, en ninguno de tus dispositivos. {owner} puede invitarte de nuevo.',
    leaveUnsaved: {
      one: '{count} canción con cambios sin guardar se perderá',
      other: '{count} canciones con cambios sin guardar se perderán',
    },
    leaveUnpushed: {
      one: '{count} cambio guardado no llegó al libro y nunca llegará',
      other: '{count} cambios guardados no llegaron al libro y nunca llegarán',
    },
    leaveUnpushedHelp: 'Hazlo tuyo para conservarlos como un libro tuyo, con su historial; o descarga el libro como está en este dispositivo.',
    leaveForkFirst: 'Hacerlo mío primero',
    leaveDownloadFirst: 'Descargar primero',
    leaveConfirm: 'Salir del libro',
    leaveFailed: 'No saliste de {name}. Sigues siendo miembro.',
    share: 'Compartir',
    shareBody: 'Invita a personas a leer o editar este libro — hasta cincuenta.',
    shareBodyMember: 'Mira quién comparte este libro contigo, y quién guarda en él.',
    // Las tarjetas de copia propia en el detalle (books.fork, workflow 11).
    cannotSaveTitle: 'No se puede guardar aquí',
    cannotSaveBody: {
      one: '{count} cambio ya no puede ir a {book}: puedes leerlo, pero ya no guardar en él.',
      other: '{count} cambios ya no pueden ir a {book}: puedes leerlo, pero ya no guardar en él.',
    },
    fork: 'Hacer una copia',
    forkBody: 'Tu propia copia de {book}, con su historial, que sigue al original.',
  },

  sharing: {
    shareTitle: 'Compartir {name}',
    close: 'Cerrar',
    back: 'Atrás',
    intro: 'Solo quienes invites pueden abrir este libro, cada uno con su propia cuenta.',
    memberIntroReader:
      'Compartido contigo por {owner}. Puedes leer este libro y conservarlo en tu estante; para cambiarlo, hazlo tuyo. Solo {owner} invita a personas. Los demás lectores no aparecen en la lista.',
    memberIntroEditor:
      'Compartido contigo por {owner}. Puedes leer este libro y guardar en él. Solo {owner} invita a personas. Los demás lectores no aparecen en la lista.',
    itsOwner: 'quien es dueño',
    loading: 'Cargando…',
    retry: 'Intentar de nuevo',
    people: 'Personas',
    peopleTitle: '{book} · Personas',
    sharingTitle: '{book} · Compartir',
    countOfLimit: '{count} de {limit}',
    peopleOfLimit: {
      one: '{count} de {limit} personas',
      other: '{count} de {limit} personas',
    },
    besidesYou: {
      one: 'además de ti · lugar para {count} más',
      other: 'además de ti · lugar para {count} más',
    },
    noRoomLeft: 'sin lugar',
    peopleExplainer: 'Solo las personas de esta lista pueden abrir {book}. Cuando llegue a 50, las invitaciones dejan de admitir a nadie.',
    roomForMore: {
      one: 'Lugar para {count} más.',
      other: 'Lugar para {count} más.',
    },
    full: '{name} está lleno. Las invitaciones ya no admiten a nadie; quita a alguien para hacer lugar.',
    stateFull: 'Lleno',
    reviewMembers: 'Revisar integrantes',
    members: 'Integrantes',
    invitations: 'Invitaciones',
    you: 'Tú',
    youNamed: '{name} (tú)',
    unnamedOwner: 'Quien es dueño del libro',
    unnamedEditor: 'Editor sin nombre',
    unnamedReader: 'Lector sin nombre',
    someoneUnnamed: 'Alguien sin nombre',
    nobodyYet: 'Nadie todavía',
    editorsCount: {
      one: '{count} editor',
      other: '{count} editores',
    },
    readersCount: {
      one: '{count} lector',
      other: '{count} lectores',
    },
    invitationsCount: {
      one: '{count} invitación',
      other: '{count} invitaciones',
    },
    ownerMeta: 'es dueño de este libro',
    sharesMeta: 'comparte este libro',
    editorMeta: 'guarda en este libro',
    readerMeta: 'lee este libro',
    throughReader: 'por la invitación de lector del {date}',
    throughEditor: 'por la invitación de editor del {date}',
    showMoreReaders: {
      one: 'Mostrar {count} lector más',
      other: 'Mostrar {count} lectores más',
    },
    showFewerReaders: 'Mostrar menos lectores',
    roleOwner: 'Dueño',
    roleEditor: 'Editor',
    roleReader: 'Lector',
    changeRole: 'Cambiar el rol de {name}',
    changeRoleEditor: 'Cambiar el rol de este editor',
    changeRoleReader: 'Cambiar el rol de este lector',
    makeEditor: 'Hacer editor',
    makeReader: 'Hacer lector',
    remove: 'Quitar',
    removeTitle: '¿Quitar a {name}?',
    removeTitleEditor: '¿Quitar a este editor?',
    removeTitleReader: '¿Quitar a este lector?',
    thisPerson: 'Esta persona',
    removeJoinedReader: '{name} entró por tu invitación de lector del {date}.',
    removeJoinedEditor: '{name} entró por tu invitación de editor del {date}.',
    removeEffect:
      'Quitar surte efecto la próxima vez que su app llegue a Estante; los demás integrantes no se ven afectados.',
    removeStays: {
      one: 'Lo que ya está en su dispositivo se queda ahí. No se puede recuperar. El libro tendrá lugar para {count} más.',
      other: 'Lo que ya está en su dispositivo se queda ahí. No se puede recuperar. El libro tendrá lugar para {count} más.',
    },
    removeConfirm: 'Quitar a {name}',
    removeConfirmUnnamed: 'Quitar',
    cancel: 'Cancelar',
    invitePeople: 'Invitar a personas',
    newInvitation: 'Nueva invitación',
    songInvite: 'Invitar a alguien a esta canción',
    inviteIntro:
      'Un enlace, para cuantas personas quieras enviárselo. Cada una inicia sesión, o crea una cuenta, y el libro va a su estante.',
    songShareIntro:
      'Una canción se comparte con su libro, {book}. Solo quienes invites pueden abrirla, cada uno con su propia cuenta.',
    songInviteBody: 'La invitación la lleva a {book} y abre en {song} en cuanto inicie sesión.',
    role: 'Rol',
    roleHelp: 'Los lectores leen el libro y lo conservan en su estante. Los editores también guardan en él.',
    expires: 'Vence',
    expiryDay: 'Un día',
    expiryWeek: 'Una semana',
    expiryMonth: 'Un mes',
    expiryUntilWithdrawn: 'Hasta que se retire',
    limitToggle: 'Limitar cuántas personas pueden usarlo',
    limitHelp: 'Opcional. Ponlo en 1 para una sola persona.',
    limitField: 'Número de usos',
    change: 'Cambiar',
    changeTerms: 'Cambiar el vencimiento y los usos',
    roomCallout: {
      one: '{book} tiene lugar para {count} persona más. Cuando llegue a 50, este enlace deja de admitir a nadie.',
      other: '{book} tiene lugar para {count} personas más. Cuando llegue a 50, este enlace deja de admitir a nadie.',
    },
    fullCallout: '{book} está lleno. Este enlace no admitirá a nadie hasta que quites a alguien.',
    seeWhoJoins: 'Verás quién entra por ella, y puedes retirarla en cualquier momento.',
    createLink: 'Crear enlace',
    linkReady: 'Aquí está el enlace. Envíalo como quieras; puedes copiarlo de nuevo mientras todavía admita a alguien.',
    linkLabel: 'Enlace de la invitación',
    copy: 'Copiar',
    copyLink: 'Copiar enlace',
    copied: 'Copiado',
    couldNotCopy: 'No se pudo copiar',
    copyByHand: 'Selecciona el enlace y cópialo.',
    done: 'Listo',
    inviteRowTitle: 'Invitación de {role}',
    stateOpen: 'abierta',
    stateWithdrawn: 'retirada',
    stateUsedUp: 'agotada',
    stateExpired: 'vencida',
    openUntil: 'abierta hasta el {date}',
    usesUsed: {
      one: '{count} uso, usado',
      other: '{count} usos, usados',
    },
    nobodyJoined: 'nadie entró todavía',
    nameJoined: '{name} entró',
    countJoined: {
      one: '{count} entró',
      other: '{count} entraron',
    },
    termsDay: 'Vence en un día',
    termsWeek: 'Vence en una semana',
    termsMonth: 'Vence en un mes',
    termsUntilWithdrawn: 'Hasta que se retire',
    usesNoLimit: 'sin límite de usos',
    usesLeft: {
      one: 'queda {count} uso',
      other: 'quedan {count} usos',
    },
    withdraw: 'Retirar',
    withdrawNote:
      'Retirar una invitación impide que entren personas nuevas por ella. Quienes ya entraron siguen siendo integrantes.',
    joinedThrough: 'Entraron por ella:',
    joinedPeople: {
      one: '{count} persona: {names}',
      other: '{count} personas: {names}',
    },
    namesAndMore: {
      one: '{names} y {count} más',
      other: '{names} y {count} más',
    },
    joinedNobody: 'nadie todavía',
    noInvitations: 'Aún no hay invitaciones.',
    songForMembers: 'Para quienes ya están en el libro',
    songForMembersBody: 'Los integrantes abren {name} en su dirección.',
    songAddressLabel: 'Dirección de la canción',
    manage: 'Administrar',
    seePeople: 'Ver quiénes',
    youAreEditor: 'Eres editor',
    youAreReader: 'Eres lector',
    errNetwork: 'Estás sin conexión, o no se puede llegar a Estante. Conéctate e intenta de nuevo.',
    errForbidden: 'Solo el dueño puede hacer eso.',
    errNotFound: 'Este libro no está disponible.',
    errGeneric: 'Algo salió mal. Intenta de nuevo.',
  },

  search: {
    label: 'Buscar canciones, palabras y acordes',
    placeholder: 'Canciones, palabras, acordes…',
    clearQuery: 'Limpiar búsqueda',
    clearFilter: 'Quitar filtro',
    scopeToBook: 'Buscar solo en {book}',
    instrument: 'instrumento',
    explore: 'Explorar {query} en tu {instrument}',
    exploreMeta: 'todas las formas de tocarlo, de la más fácil a la más difícil',
    matching: 'Canciones con “{query}”',
    recent: 'Recientes',
    books: 'Libros',
    empty: 'Ninguna canción coincide con “{query}”.',
    // The no-match state (songs.editor_chrome; W03#1 L40-46; workflow 3 §Ways in):
    // `{books}` is the books searched, as a list in the active locale.
    noMatch: 'Ninguna canción coincide',
    searchedIn: 'Se buscó en títulos, artistas, secciones, letras y acordes de {books}.',
    pasteHint: 'O pega una canción entera, copiada de cualquier lugar, en una nueva.',
    songCount: { one: '{count} canción', other: '{count} canciones' },
    stillLoading: 'cargando aún',
    voicedFor: 'con digitaciones para {instrument}',
    unsaved: 'sin guardar',
    conflict: 'conflicto',
    where: '{book} · {folder}/',
    addToSetlist: 'Agregar {title} a un repertorio',
    setlist: 'Repertorio',
  },

  setlists: {
    title: 'Repertorios',
    empty: 'Aún no hay repertorios. Agrega una canción a un repertorio desde la búsqueda o la vista de lectura.',
    loading: 'Cargando repertorios…',
    songCount: { one: '{count} canción', other: '{count} canciones' },
    back: 'Atrás',
    play: 'Reproducir',
    edit: 'Editar',
    more: 'Más',
    done: 'Listo',
    inKey: 'en {key}',
    missing: 'falta',
    missingNotice: 'Falta {title}.',
    missingDetail: 'Ya no hay nada en {path}, así que se omite al reproducir.',
    pointItAtASong: 'Apuntar a una canción',
    addSong: 'Agregar canción',
    save: 'Guardar',
    saveMessage: 'Editar repertorio',
    discard: 'Descartar',
    unsaved: 'cambios sin guardar',
    songsLabel: 'Canciones · arrastra para reordenar',
    keyNoteHint: 'El tono y la nota valen solo en este repertorio',
    dragToReorder: 'Arrastra para reordenar',
    removeFromSetlist: 'Quitar {title} del repertorio',
    keyLabel: 'Tono de {title}',
    keyPlaceholder: 'Tono',
    noteLabel: 'Nota de {title}',
    notePlaceholder: 'Nota',
    notInBook: '{path} no está en el libro',
    pointHereTitle: 'Apuntar a una canción en {book}',
    searchLabel: 'Buscar una canción',
    cancel: 'Cancelar',
    pointHere: 'Apuntar aquí',
    noResults: 'No se encontraron canciones.',
    relativeNote: 'Los enlaces son relativos a {folder}, así que el archivo abre las canciones en cualquier host git.',
    addToSetlistTitle: 'Agregar al repertorio',
    newSetlist: 'Nuevo repertorio…',
    pickerMeta: '{book} · {count}',
    copyNotice: 'Esta canción se copiará primero a {book}.',
    copyDetail: '{title} está en {other}, y un repertorio apunta solo a canciones de su propio libro.',
    copyThenUnsaved: 'La copia y el cambio del repertorio quedan como cambios sin guardar en {book}, guardados como cualquier otro.',
    thenUnsaved: 'El cambio del repertorio queda como cambio sin guardar en {book}, guardado como cualquier otro.',
    add: 'Agregar',
    copyAndAdd: 'Copiar y agregar',
    newSetlistTitle: 'Nuevo repertorio',
    newSetlistNameLabel: 'Nombre del repertorio',
    newSetlistNamePlaceholder: 'Nombre del repertorio',
    create: 'Crear',
  },

  play: {
    stop: 'Dejar de tocar',
    previous: 'Canción anterior',
    next: 'Canción siguiente',
    position: '{i} de {n}',
    positionAwake: '{i} de {n} · pantalla siempre encendida',
    inKey: 'En {key}',
    setlistKey: 'Tono del repertorio {key} · escrita en {songKey}',
    setlistKeyNote: 'Tono del repertorio {key}',
    nextHeading: 'Siguiente',
    nextItem: '{number}. {title}',
    note: 'Nota: {note}',
    hint: 'Desliza, toca un borde o usa un pedal',
    announce: '{title}, {i} de {n}',
    announceNext: 'Siguiente: {title}',
    empty: 'Este repertorio todavía no tiene canciones para tocar.',
  },

  explorer: {
    title: 'Explorar un acorde',
    back: 'Volver a la búsqueda',
    chord: 'Acorde',
    unreadable: '“{text}” no es un acorde que la app pueda leer.',
    group: {
      open: 'Al aire',
      fret: 'Traste {position}',
      count: { one: '{count} forma', other: '{count} formas' },
    },
    showMore: 'Mostrar {count} más',
    showFewer: 'Mostrar menos',
    star: 'Guardar {chord}, {shorthand} como tu forma',
    unstar: 'Tu forma de {chord}, {shorthand} — quitar',
    notice: {
      readAs: 'Leído como {chord} — {reading}.',
      flip: '¿Leer como {chord}?',
      about: {
        sevenPlus:
          'En la notación brasileña 7+ es la séptima mayor; en la americana y el Real Book es la quinta aumentada.',
        bareNine:
          'En la notación brasileña un 9 solo agrega la novena sin séptima; en la americana y el Real Book incluye la séptima menor.',
        degreeSign:
          'Un ° solo se lee como la séptima disminuida; la tríada pura es la otra lectura.',
        sevenFour:
          'En la notación brasileña 7(4) suspende la tercera; en la americana y el Real Book agrega la cuarta por encima.',
      },
    },
    empty: {
      title: 'Ninguna forma cumple las reglas',
      body:
        '{chord} pide más notas de las que {instrument} puede sonar con tus reglas de ejecución. La búsqueda no relajó las reglas para forzar una.',
      rules: 'Reglas de ejecución',
      hint: 'Permite notas omitidas allí, o prueba un acorde más simple.',
    },
    enter: {
      name: 'Ingresar una forma',
      meta: 'coloca los dedos a mano y guárdala',
      title: 'Ingresar una forma',
      help: 'Toca un traste para poner un dedo, tócalo de nuevo para quitarlo. Toca la cejilla para dejar al aire o apagar la cuerda.',
      nut: 'Dejar al aire o apagar la cuerda {n}',
      muteString: 'Apagar la cuerda {n}',
      openString: 'Dejar al aire la cuerda {n}',
      setFret: 'Cuerda {n}, traste {fret}',
      readout: 'Lo que suena',
      muted: 'Cuerda {n}: apagada',
      openNote: 'Cuerda {n}: al aire, {note}',
      frettedNote: 'Cuerda {n}: traste {fret}, {note}',
      foreign: 'fuera del acorde',
      unplayable: 'Esta forma no puede tocarse tal cual, pero se conserva como se dibujó.',
      star: 'Guardar esta forma',
      cancel: 'Cancelar',
    },
  },

  // Un dispositivo nuevo (account.new_device, workflow 13).
  newDevice: {
    kind: {
      iphone: 'iPhone',
      ipad: 'iPad',
      'android-phone': 'teléfono Android',
      'android-tablet': 'tableta Android',
      mac: 'Mac',
      windows: 'computadora Windows',
      linux: 'computadora Linux',
      chromebook: 'Chromebook',
    },
    thisKind: {
      iphone: 'Este iPhone',
      ipad: 'Este iPad',
      'android-phone': 'Este teléfono',
      'android-tablet': 'Esta tableta',
      mac: 'Esta Mac',
      windows: 'Esta computadora',
      linux: 'Esta computadora',
      chromebook: 'Esta Chromebook',
      other: 'Este dispositivo',
    },
    notation: {
      brazilian: 'Notación brasileña',
      american: 'Notación americana',
      realbook: 'Notación Real Book',
    },
    title: 'Tus dos Mis canciones',
    later: 'Más tarde',
    merged: '{device}: las preferencias y las posiciones se unieron a las de tu cuenta, ajuste por ajuste.',
    heading: '{device} tiene sus propias Mis canciones',
    body: 'Tu cuenta también tiene Mis canciones. Une las dos o mantenlas separadas.',
    merge: 'Unir',
    mergeBody: '{device}: sus canciones van a las Mis canciones de tu cuenta. Primero una vista previa, canción por canción.',
    mergeWaiting: 'Las Mis canciones de tu cuenta todavía están llegando a este dispositivo.',
    keepBoth: 'Conservar las dos',
    keepBothBody: 'Esta queda en la estantería como Mis canciones (este dispositivo).',
    keepBothTitle: 'Mis canciones (este dispositivo)',
    previewTitle: 'Lo que haría la unión',
    previewNote: 'No se escribe nada hasta que confirmes',
    previewLoading: 'Leyendo las Mis canciones de este dispositivo…',
    unrelated: 'Las dos no comparten historial, así que cada canción que está en ambas aparece como un conflicto para elegir.',
    keepBothInstead: 'Conservar las dos',
    mergeAndSave: 'Unir y guardar',
    failed: 'No se pudo preparar la unión. No se escribió nada.',
  },

  // El estado inicial de estante vacía en la puerta de entrada de la búsqueda
  // (account.first_run, flujo 1).
  firstRun: {
    heading: 'Tu estante está vacía',
    body: 'Un libro es una colección de canciones: tuyas, de un profesor, de tu banda. La búsqueda recorre todos los libros de tu estante.',
    writeSong: 'Escribir una canción',
    writeSongMeta: 'Va a Mis canciones',
    addByLink: 'Agregar un libro por su enlace',
    addByLinkMeta: 'De un profesor o de un compañero de banda',
    signIn: 'Iniciar sesión',
    signInMeta: 'Trae tu estante desde otro dispositivo',
    openExample: 'Abrir el libro de ejemplo',
    openExampleMeta: 'Canciones que vienen con la app, puestas en tu estante; quítalo cuando quieras',
    mySongs: 'Mis canciones',
    mySongsMeta: 'Aún no hay canciones · tuyas, en este dispositivo',
    exampleLabel: 'Libro de ejemplo',
  },

  // La puerta de la invitación a un libro compartido (books.add_by_link, flujo 1
  // §Invitado; mockup W01). Genérica antes de iniciar sesión — no nombra el libro.
  // shell.routing — una dirección de algo que no está en este dispositivo.
  notHere: {
    back: 'Volver',
    brand: 'Estante',
    bookTitle: 'Este enlace no abre un libro',
    bookBody:
      'No está en este dispositivo. Si te invitaron, pide a quien te lo envió una nueva invitación; si es tuyo en Estante, agrégalo desde Libros.',
    goToBooks: 'Ir a Libros',
    songTitle: 'Esta canción no está en {book}',
    setlistTitle: 'Este repertorio no está en {book}',
    itemBody: 'Puede que la hayan renombrado, movido o borrado.',
    openBook: 'Abrir las canciones de {book}',
  },
  invited: {
    brand: 'Estante',
    close: 'Cerrar',
    working: 'Abriendo…',
    workingHeading: 'Abriendo la invitación',
    promptHeading: 'Te invitaron a un libro en Estante',
    promptBody:
      'Para abrirlo, inicia sesión o crea una cuenta primero: ningún libro se puede leer sin una.',
    passkeyTitle: 'Una cuenta es una llave de acceso',
    passkeyBody: 'Sin contraseña que elegir. Tu teléfono la crea, en segundos.',
    makeAccount: 'Crear una cuenta',
    signIn: 'Ya tengo cuenta: iniciar sesión',
    promptFooter: 'Entonces el libro va a tu estante y se abre en sus canciones.',
    deadTitle: 'Este enlace no abre un libro',
    deadBody:
      'La invitación pudo expirar o ser retirada, o esta cuenta no está en el libro. Pide una nueva a quien te la envió.',
    addByLink: 'Agregar un libro por su enlace',
    fullTitle: 'Este libro está lleno',
    fullBody:
      'Alcanzó su límite de personas, así que la invitación no puede admitir a nadie más. Pide al dueño del libro que haga espacio y abre el enlace de nuevo.',
    errorTitle: 'No pudimos abrir este enlace',
    errorBody:
      'Algo salió mal al conectar con Estante. Revisa tu conexión y abre el enlace de nuevo.',
    ok: 'OK',
  },
  // La pantalla de inicio de sesión (account.sign_in, flujos 7 y 13; mockup W13).
  signIn: {
    brand: 'Estante',
    close: 'Cerrar',
    heading: 'Iniciar sesión',
    body: 'Trae tus libros, instrumentos y preferencias a este teléfono.',
    usePasskey: 'Usar una clave de acceso',
    emailLink: 'Enviarme un enlace por correo',
    note: '¿No tienes una clave de acceso aquí? El enlace te permite iniciar sesión en este teléfono y recupera tu cuenta si se pierden todos los dispositivos con una clave de acceso.',
    emailHeading: 'Enviarme un enlace por correo',
    emailBody: 'Enviaremos un enlace de acceso a tu correo. Ábrelo en este dispositivo para iniciar sesión.',
    emailLabel: 'Tu correo',
    emailSend: 'Enviar el enlace',
    usePasskeyInstead: 'Usar una clave de acceso en su lugar',
    checkHeading: 'Revisa tu correo',
    checkBody: 'Si esa dirección tiene una cuenta, un enlace de acceso está en camino. Ábrelo en este dispositivo para iniciar sesión.',
    checkBack: 'Volver a iniciar sesión',
    redeeming: 'Iniciando sesión…',
    working: 'Procesando…',
    offerHeading: 'Haz que iniciar sesión sea más rápido',
    offerBody: 'Agrega una clave de acceso a este dispositivo, para que la próxima vez sea un toque.',
    offerAdd: 'Agregar una clave de acceso',
    offerSkip: 'Ahora no',
    errorPasskey: 'Esa clave de acceso no funcionó: inténtalo de nuevo o usa un enlace por correo.',
    errorExpired: 'Este enlace expiró o ya se usó: solicita uno nuevo.',
    errorOffline: 'No se pudo conectar con Estante. Revisa tu conexión e inténtalo de nuevo.',
    requestNewLink: 'Solicitar un enlace nuevo',
  },

  account: {
    open: 'Cuenta',
    title: 'Cuenta',
    back: 'Atrás',
    preferences: 'Preferencias',
    theme: 'Tema',
    language: 'Idioma',
    themeAutomatic: 'Automático',
    themeAutomaticMeta: 'Sigue este dispositivo',
    themeEstante: 'Estante',
    themeEstanteMeta: 'Neutro, acordes azul tinta',
    themeCaderno: 'Caderno',
    themeCadernoMeta: 'Papel, acordes en rojo, con serifa',
    themePalco: 'Palco',
    themePalcoMeta: 'Escenario oscuro, ámbar, legible de lejos',
    selected: 'Seleccionado',
    themeNote:
      'El automático sigue este dispositivo: claro → Estante, oscuro → Palco. Elegir un tema con nombre lo reemplaza. Tu elección te acompaña en todos los dispositivos; el automático vuelve a leer el modo claro u oscuro de cada uno.',
    // Density and chord diagrams (shell.display_preferences).
    density: 'Densidad',
    densityCompact: 'Compacta',
    densityCompactMeta: 'Más pequeña, más a la vista',
    densityCompactMetaLong:
      'Espaciado más ajustado, cifrado más pequeño — más de la canción a la vista',
    densityComfortable: 'Cómoda',
    densityComfortableMeta: 'La predeterminada',
    densityRoomy: 'Amplia',
    densityRoomyMeta: 'Más grande, para leer de lejos',
    densityRoomyMetaLong: 'Espaciado más holgado, cifrado más grande — para leer desde más lejos',
    diagrams: 'Diagramas de acordes',
    diagramHand: 'Mano',
    diagramHandRight: 'Diestro',
    diagramHandRightMeta: 'Predeterminado · la cuerda más grave a la izquierda',
    diagramHandLeft: 'Zurdo',
    diagramHandLeftMeta: 'En espejo · la cuerda más grave a la derecha',
    diagramNeck: 'Mástil',
    diagramNeckVertical: 'Vertical',
    diagramNeckVerticalMeta: 'Predeterminado · la cejuela arriba',
    diagramNeckHorizontal: 'Horizontal',
    diagramNeckHorizontalMeta: 'La cejuela a la izquierda, los trastes hacia la derecha',
    diagramsNote:
      'Cambia cómo se dibuja una posición, nunca qué posiciones se encuentran. Todos los diagramas la siguen.',
    languageNote: 'Usa el idioma de tu navegador hasta que elijas uno.',
    notSignedIn: 'Sin sesión iniciada',
    notSignedInBody:
      'Estas preferencias se guardan en este dispositivo ahora. Inicia sesión para conservar tus libros y llevar el tema y el idioma a tus otros dispositivos.',
    usePasskey: 'Usar una llave de acceso',
    emailLink: 'Enviarme un enlace por correo',
    signedIn: 'Sesión iniciada',
    signedInStatus: 'Con sesión iniciada en este dispositivo',
    loading: 'Cargando…',
    retry: 'Reintentar',
    devices: 'Dispositivos con sesión',
    thisDevice: 'Este dispositivo',
    unknownDevice: 'Un dispositivo con sesión',
    inUseNow: '{device} · en uso ahora',
    lastUsed: 'usado por última vez {time}',
    offlineManage:
      'Estás sin conexión. Aún puedes cerrar la sesión de este dispositivo; tus otros dispositivos y llaves de acceso no se pueden administrar hasta que te vuelvas a conectar.',
    signOut: 'Cerrar sesión',
    signOutLabel: 'Cerrar la sesión de {device}',
    signOutThis: 'Cerrar la sesión de este dispositivo',
    signOutTitle: '¿Cerrar la sesión de {device}?',
    signOutBody:
      'Dejará de funcionar en ese dispositivo la próxima vez que llegue a Estante. No se elimina nada en él.',
    signOutConfirm: 'Cerrar sesión',
    cancel: 'Cancelar',
    signOutThisTitle: '¿Cerrar la sesión en este dispositivo?',
    signOutChoice: 'Qué hacer con los libros de esta cuenta en este dispositivo',
    signOutRemove: 'Quitar los libros de esta cuenta de este dispositivo',
    signOutRemoveMeta: 'Para un dispositivo prestado o compartido.',
    signOutKeep: 'Conservarlos aquí',
    signOutKeepMeta: 'Como libros locales, ya sin sincronizar.',
    signOutNotYet: 'Todavía no están en Estante:',
    signOutUnsavedSongs: {
      one: '{title} · cambios sin guardar en {count} canción',
      other: '{title} · cambios sin guardar en {count} canciones',
    },
    signOutUnpushed: {
      one: '{title} · {count} guardado aún sin enviar',
      other: '{title} · {count} guardados aún sin enviar',
    },
    signOutOnlyHere: '{title} solo está en este dispositivo. Descárgalo antes de quitarlo.',
    signOutDownload: 'Descargar',
    signOutDownloadLabel: 'Descargar {title}',
    signOutConfirmRemove: 'Cerrar sesión y quitar',
    signOutConfirmKeep: 'Cerrar sesión y conservar',
    signOutLeftOffline:
      'Cerraste la sesión en este dispositivo. Estante cerrará la sesión cuando este dispositivo vuelva a conectarse.',
    passkeys: 'Llaves de acceso',
    passkeyUnnamed: 'Llave de acceso',
    passkeyAdded: 'Agregada el {date}',
    addPasskey: 'Agregar una llave de acceso a este dispositivo',
    removePasskey: 'Quitar',
    removePasskeyLabel: 'Quitar {name}',
    removePasskeyTitle: '¿Quitar {name}?',
    removePasskeyBody:
      'Esta llave de acceso dejará de iniciar tu sesión. Tus otras llaves siguen funcionando; puedes agregar otra cuando quieras.',
    removePasskeyConfirm: 'Quitar',
    leaving: 'Salir de Estante',
    leavingBody: 'Toma una copia de todo lo que guardas aquí y luego cierra tu cuenta, si quieres.',
    leaveTakeData: 'Exportar tus datos',
    leaveDelete: 'Eliminar mi cuenta',
    leaveTakeTitle: 'Exportar tus datos',
    leaveOffline: 'Sin conexión',
    leaveOfflineNote:
      'Tus libros están en este dispositivo, así que las descargas funcionan aquí. Eliminar tu cuenta necesita conexión.',
    leaveDataBody:
      'Cada libro se guarda tal como está en este dispositivo — todo el historial y tus cambios sin guardar — igual que Descargar en cualquier libro.',
    leaveDownloadAll: 'Descargar todo',
    leaveDownload: 'Descargar',
    leaveDownloadLabel: 'Descargar {title}',
    leaveHomeBook: 'Tu libro personal',
    leaveClose: 'Listo',
    leaveTitle: '¿Eliminar tu cuenta?',
    leaveWhen: 'Cuando eliminas tu cuenta:',
    leaveWillAccount: 'Tu cuenta, todas las sesiones y todas las llaves de acceso se eliminan.',
    leaveWillBooks: 'Los libros que te pertenecen se eliminan para todos quienes los comparten.',
    leaveWillAccess: 'Tu acceso a los libros de otras personas termina.',
    leaveWillDevice: 'Tus libros y tu libro personal se eliminan de este dispositivo.',
    leaveOwnHead: 'Libros que te pertenecen — eliminados para todos:',
    leaveSharedWith: {
      one: '{title} · compartido con {count} persona — perderá el acceso',
      other: '{title} · compartido con {count} personas — perderán el acceso',
    },
    leaveOnlyYou: '{title} · solo tú — eliminado',
    leaveLocalHead: 'Solo en este dispositivo — expórtalo primero:',
    leaveTakeFirst: 'Exportar tus datos primero',
    leaveConfirmLabel: 'Escribe tu dirección de correo para confirmar:',
    leaveMismatch: 'Ese no es el correo de esta cuenta. Revísalo e inténtalo de nuevo.',
    leaveNeedsConnection: 'Necesita conexión — disponible cuando vuelvas a estar en línea.',
    leaveCannotUndo: 'Esto no se puede deshacer.',
    errNetwork: 'Estás sin conexión, o Estante no responde. Conéctate e inténtalo de nuevo.',
    errGeneric: 'Algo salió mal. Inténtalo de nuevo.',
    // The Recovery email region, the last way in, and the passkey-confirmed
    // delete (account.recovery_email; workflow 13, workflow 17).
    recoveryHeading: 'Correo de recuperación',
    recoveryNone: 'Sin correo de recuperación',
    recoveryNoneWarn: 'Si pierdes todos los dispositivos con una llave de acceso, no hay forma de volver a entrar.',
    recoveryLabel: 'Correo de recuperación',
    recoveryHint: 'Se usa solo para enviarte un enlace de inicio de sesión. Se muestra aquí, a ti, y en ningún otro lugar.',
    recoverySend: 'Enviar un enlace de verificación',
    recoveryWaiting: 'Esperando que confirmes',
    recoverySent: 'Enviamos un enlace de verificación a {address}. Revisa tu bandeja de entrada y ábrelo.',
    recoveryOnceNone: 'El enlace funciona una vez, durante quince minutos. Hasta que se abra, nada cambia y la cuenta sigue sin correo de recuperación.',
    recoveryOnceKept: 'El enlace funciona una vez, durante quince minutos. Hasta que se abra, nada cambia y {address} sigue siendo tu correo de recuperación.',
    recoverySendAgain: 'Enviar de nuevo',
    recoveryDifferent: 'Usar otra dirección',
    recoveryConfirmed: 'Confirmado',
    recoveryConfirmedBody: 'Recibe un enlace de inicio de sesión cuando lo pidas. Solo se te muestra a ti.',
    recoveryChange: 'Cambiar',
    recoveryChangeHint: 'Cambiarlo mantiene esta dirección vigente hasta que se confirme la nueva; esta dirección recibe entonces un breve aviso de que se cambió.',
    recoveryInvalid: 'Eso no parece una dirección de correo.',
    recoveryOfflineHead: 'Sin conexión',
    recoveryOffline: 'El correo de recuperación necesita conexión, como iniciar sesión. Sus botones esperan hasta que vuelvas a estar en línea; tus canciones no.',
    rateLimited: 'Demasiados intentos — inténtalo de nuevo en un momento.',
    lastWayIn: 'último acceso',
    lastWayInBody: 'Tu única forma de iniciar sesión — agrega un correo de recuperación u otra llave de acceso primero.',
    leaveByPasskey: 'Esta cuenta no tiene correo. Confirma con una de tus llaves de acceso para eliminarla.',
    leaveNotConfirmed: 'No se eliminó — la llave de acceso no se confirmó.',
    leaveNotConfirmedBody: 'Nada ha cambiado. Inténtalo de nuevo cuando estés listo.',
    leaveRefused: 'Esa llave de acceso no confirmó esta cuenta. Inténtalo de nuevo.',
    leaveNowEmail: 'Esta cuenta ahora tiene un correo — escríbelo para confirmar.',
  },

  // The recovery email's confirm page, opened by the emailed link
  // (account.recovery_email; workflow 13 §Confirming it).
  recoveryConfirm: {
    brand: 'Estante',
    heading: 'Correo de recuperación',
    working: 'Confirmando tu correo de recuperación…',
    confirmed: 'Tu correo de recuperación está confirmado',
    body: 'Tu correo de recuperación es ahora donde Estante envía un enlace de inicio de sesión si pierdes todos los dispositivos con una llave de acceso.',
    notice: 'Este enlace solo confirma la dirección — no inicia tu sesión en este dispositivo y no abre ningún libro.',
    expired: 'Este enlace expiró o ya se usó — envía uno nuevo desde la pantalla de la cuenta.',
    taken: 'Esta dirección es el correo de recuperación de otra cuenta de Estante — inicia sesión con ella.',
    rateLimited: 'Demasiados intentos — inténtalo de nuevo en un momento.',
    errNetwork: 'Estás sin conexión, o Estante no responde. Conéctate e inténtalo de nuevo.',
    retry: 'Intentar de nuevo',
    open: 'Abrir Estante',
  },

  newSong: {
    create: 'Crear “{query}”',
    createMeta: 'Una nueva canción en {book}',
    inThisBook: 'Nueva canción en {book}',
    inBook: 'En {book}',
    changeable: 'puedes cambiarlo hasta el primer guardado',
    changeBook: 'Cambiar de libro',
    back: 'Atrás',
    unsaved: 'sin guardar',
    untitled: 'Canción sin título',
    notationNote:
      'La notación viene de tu preferencia, así la canción se lee igual para todos.',
  },

  // La hoja de hacer tuyo el libro (books.fork, workflow 11; W11 #1).
  fork: {
    title: '{book} es de otra persona — ¿hacerlo tuyo?',
    body: 'Puedes leer {book}, pero no guardar en él. Hacerlo tuyo te da:',
    pointCopy: 'Tu propia copia del libro, con todo su historial. Tus ediciones pasan a ella y se guardan allí.',
    pointFollow: 'Sigue a {book}: cuando tenga cambios nuevos, tú eliges cuándo traerlos.',
    pointShelf: 'Ocupa el lugar de {book} en tu estante, así que nada aparece dos veces.',
    smallPrint: 'Tu copia queda en Estante, privada para ti. Puedes compartirla, con su propio límite de 50 personas.',
    confirm: 'Hacerlo mío',
    notNow: 'Ahora no',
    busy: 'Haciéndolo tuyo…',
    offline: 'Hacer tuyo el libro necesita red. Nada cambió: conéctate e inténtalo de nuevo.',
    quota: 'Esto superaría tu límite en Estante.',
    signedOut: 'Inicia sesión para hacerlo tuyo.',
    error: 'No se pudo hacerlo tuyo. Nada cambió: inténtalo de nuevo.',
  },

  saveSheet: {
    title: 'Guardar {title}',
    titleAll: { one: 'Guardar {count} canción', other: 'Guardar {count} canciones' },
    whatChanged: 'Qué cambió',
    note: 'Nota',
    pushCaption:
      'Guardar comparte esta versión con quien comparte el libro; sin red, en la próxima sincronización.',
    cancel: 'Cancelar',
    save: 'Guardar',
    close: 'Cerrar',
    saveAll: 'Guardar todo',
    saveAllLabel: 'Guardar todos los cambios en {book}',
    songNameLabel: 'Ponle nombre a la canción',
    songNameHelp: 'Se usa como título y nombre de archivo.',
    nameLabel: 'Tu nombre, tal como aparecerá en el historial de una canción',
    nameHelp: 'Se pregunta una vez. Al iniciar sesión, se ofrece el nombre de tu cuenta en su lugar.',
    refused: 'No guardado. La línea {line} no se pudo leer. Corrígela en el editor y guarda de nuevo.',
    refusedMerge:
      'No guardado. Resuelve primero los conflictos de este libro — guardar ahora se fundiría con la combinación.',
    failed: 'No guardado. Algo salió mal al escribirlo en este dispositivo. Tus cambios siguen aquí — guarda de nuevo.',
    discardTitle: '¿Descartar los cambios en {title}?',
    discardBody: 'La canción vuelve a como estaba al guardar por última vez. Esto se perdería:',
    keepEditing: 'Seguir editando',
    discard: 'Descartar cambios',
    makeYourOwn: 'Hacer tuyo este libro',
    notNow: 'Ahora no',
    change: {
      untitledSection: '(sin título)',
      titleWhere: 'Título',
      sectionsWhere: 'Secciones',
      voicingsWhere: 'Voicings',
      sectionBar: '{section} compás {bar}',
      added: '{value} añadido',
      removed: '{value} quitado',
      changed: '{before} → {after}',
      sectionAdded: 'sección añadida',
      sectionRemoved: 'sección quitada',
      sectionRenamed: 'renombrada a {name}',
      sectionReordered: 'reordenadas',
      wordsChanged: 'letra cambiada',
      voicingBlockAdded: 'añadidos para {tuning}',
      voicingBlockRemoved: 'quitados para {tuning}',
      voicingAdded: 'para {tuning}: {chord} añadido',
      voicingRemoved: 'para {tuning}: {chord} quitado',
      voicingChanged: 'para {tuning}: {chord} cambiado',
    },
  },

  history: {
    title: 'Historial',
    newestFirst: '{book} · más recientes primero',
    songInBook: '{title} · {book}',
    listLabel: 'Versiones de {title}',
    you: 'tú',
    unsaved: 'Sin guardar, en este dispositivo',
    unsavedBadge: 'sin guardar',
    unsavedChanges: 'cambios sin guardar',
    mergedWithResolution: 'Combinado, con tu resolución',
    backToSong: 'Volver a la canción',
    backToHistory: 'Volver al historial',
    whatChanged: 'Qué cambió respecto a la versión anterior',
    whatChangedToNow: 'Qué cambió de esta versión a ahora',
    songAsItWas: 'La canción como estaba',
    asItWasThen: '{title} como estaba entonces',
    compareNow: 'Comparar con ahora',
    compareBefore: 'Comparar con la versión anterior',
    restore: 'Restaurar esta versión',
    showText: 'Mostrar el texto',
    lineDiffCaption: 'la diferencia de líneas de {file} respecto a la versión anterior',
    empty: 'Aún no hay versiones.',
    restoreTitle: '¿Restaurar la versión del {date}?',
    restoreBody:
      '{title} tiene cambios sin guardar en este dispositivo. Restaurar los reemplaza, y esto se perdería:',
    restoreCaption:
      'Se restaura la versión completa. Queda entonces sin guardar, y guardarla crea una nueva versión; nada en el historial se modifica.',
    keepChanges: 'Mantener mis cambios',
    loseAndRestore: 'Descartarlos y restaurar',
    restoreBlock: 'Restaurar este bloque',
    restoreBlockNamed: 'Restaurar este bloque: {block}',
    voicingBlock: 'Posiciones para {tuning}',
    restorePartTitle: '¿Restaurar {block}?',
    restorePartBody:
      '{block} tiene cambios sin guardar en este dispositivo. Restaurar este bloque los reemplaza, y esto se perdería:',
    restorePartCaption:
      'Solo se restaura este bloque; el resto de la canción queda como está. Queda entonces sin guardar, y guardar crea una nueva versión; nada en el historial se modifica.',
    nothingToRestore: 'Restaurar este bloque no recupera nada.',
    noBlockRestore:
      'Esta versión es demasiado antigua para restaurar bloque por bloque. Aún puedes restaurar la versión completa.',
  },

  // El resolutor de conflictos por canción (sync.conflicts, workflow 9).
  songConflict: {
    back: 'Atrás',
    stepOf: 'Conflicto {n} de {total}',
    prev: 'Conflicto anterior',
    next: 'Conflicto siguiente',
    yours: 'El tuyo',
    theirs: 'de {author}',
    theirsFallback: 'El de la otra persona',
    chartTitle: '{section}',
    chartTitleFallback: 'Un compás que ambos cambiaron',
    // The bar or bars a chart conflict is in (sync.conflicts_editing; W09#1 L42).
    chartTitleBar: '{section}, compás {bar}',
    chartTitleBars: '{section}, compases {first} y {second}',
    chartTitleBarRange: '{section}, compases {first}–{last}',
    chartBody: 'Tú y {author} cambiaron esto.',
    chartBodyFallback: 'Ambos cambiaron esto.',
    voicingTitle: 'La forma de {chord}',
    voicingBody: '{tuning} · {variation}. Tú y {author} eligieron formas distintas.',
    voicingBodyFallback: '{tuning} · {variation}. Eligieron formas distintas.',
    mainVariation: 'variación principal',
    propertyTitle: 'El campo {key}',
    propertyBody: 'Tú y {author} cambiaron esto.',
    propertyBodyFallback: 'Ambos cambiaron esto.',
    titleTitle: 'El título',
    titleBody: 'Tú y {author} le pusieron títulos distintos.',
    titleBodyFallback: 'Le pusieron títulos distintos.',
    genericTitle: 'Un cambio que ambos hicieron',
    genericBody: 'Tú y {author} cambiaron esto.',
    genericBodyFallback: 'Ambos cambiaron esto.',
    absent: '(eliminado)',
    keepMine: 'Quedarme con el mío',
    takeTheirs: 'Quedarme con el suyo',
    keepBoth: 'Quedarme con ambos',
    edit: 'Editar',
    readsAsYours:
      'Hasta que lo resuelvas, {title} se muestra en tu versión, con los lugares en conflicto marcados.',
    keepBothSongTitle: '¿Dos canciones?',
    keepBothSongBody:
      'Conserva la tuya tal como está y guarda la versión de {author} al lado, como su propia canción, para cuando de verdad hicieron dos canciones.',
    keepBothSongBodyFallback:
      'Conserva la tuya tal como está y guarda la versión que llegó al lado, como su propia canción, para cuando dos personas de verdad hicieron dos canciones.',
    keepBothSong: 'Quedarme con ambas, como dos canciones',
    previewLabel: '{title}, tu versión',
    spoken: {
      chartLine: 'conflicto en la línea del cifrado',
      line: 'conflicto en esta línea',
    },
    settledSoFar: 'Resuelto hasta ahora',
    settledMine: 'Quedó el tuyo',
    settledTheirs: 'Quedó el de {author}',
    settledKeepBoth: 'Quedaron ambos — el de {author} en una variación',
    settledEdit: 'Texto editado',
    allSettled: 'Todos los conflictos de {title} están resueltos.',
    editTitle: 'Editar el texto de {title}',
    editHelp: 'Conserva las líneas que quieras, de un lado o de ambos, y borra las tres líneas de marca.',
    editTextLabel: 'El texto de la canción, con las marcas de conflicto',
    editSave: 'Guardar',
    editCancel: 'Cancelar',
    editRefused:
      'No guardado. La línea {line} sigue siendo una marca de conflicto. Quita todas las líneas de marca cuando hayas elegido qué queda y guarda de nuevo.',
    editGoToLine: 'Ir a la línea {line}',
    markersTitle: 'Leer las marcas',
    markerStart: 'empieza tu versión',
    markerMid: 'termina la tuya, empieza la de {author}',
    markerEnd: 'termina la versión de {author}',
    // The labels on the marker lines in the edit view, named as the side cards
    // name the two versions (W09#3 L284-308).
    markerYours: 'el tuyo',
    markerTheirs: 'de {author}',
    markerTheirsFallback: 'el de la otra persona',
  },

  // El panel del libro en pausa (sync.conflicts, workflow 9).
  bookConflicts: {
    needsYou: { one: '{count} canción te necesita.', other: '{count} canciones te necesitan.' },
    needsYouBody:
      'Los últimos cambios que llegaron y los tuyos tocaron los mismos lugares. Todo lo demás ya está aquí, y puedes leer y editar como siempre; este libro no recibe nada nuevo de la sincronización hasta que esto se resuelva.',
    inConflict: 'En conflicto',
    conflictsCount: { one: '{count} conflicto', other: '{count} conflictos' },
    conflictBadge: 'conflicto',
    settle: 'Resolver',
    settleSong: 'Resolver {title}',
    keepBothSong: 'Quedarme con ambas',
    keepBothSongFor: 'Quedarme con ambas versiones de {title} como dos canciones',
    deletedBody: '{author} eliminó esta canción. Tú la habías editado.',
    keepSong: 'Conservar la canción, con los cambios',
    deleteSong: 'Eliminarla',
    cameIn: 'Llegó, ya está aquí',
    addedBy: 'agregada por {author}',
    changedBy: 'actualizada por {author}',
    savingTitle: 'Guardar en este libro',
    savingBody: {
      one: 'Resuelve la canción primero. Guardar ahora se fundiría con la combinación.',
      other: 'Resuelve las {count} canciones primero. Guardar ahora se fundiría con la combinación.',
    },
    savingSafe: 'Tus cambios sin guardar quedan como están hasta entonces.',
    notNowTitle: 'Ahora no',
    notNowBody:
      'Los conflictos pueden esperar todo lo que quieras. Abandonar deja el libro como estaba antes de esta sincronización; los cambios que llegaron esperan para combinarse en la próxima.',
    abandon: 'Abandonar la combinación',
  },

  fileView: {
    filesEntry: 'Archivos',
    filesFor: 'Archivos de {name}',
    title: 'Archivos',
    titleIn: '{book} · Archivos',
    back: 'Volver',
    backToFiles: 'Volver a los archivos',
    backToHistory: 'Volver al historial',
    historyTab: 'Historial',
    filesTab: 'Archivos',
    historyTitle: '{book} · Historial',
    new: 'Nuevo',
    createSong: 'Canción',
    createSongMeta: '*.cifra.md',
    createSetlist: 'Repertorio',
    createSetlistMeta: '*.setlist.md',
    createFolder: 'Carpeta',
    createFolderMeta: 'existe cuando tiene un archivo',
    createReadme: 'README.md',
    readmeExists: 'README.md ya existe',
    newSetlistTitle: 'Nuevo repertorio',
    newFolderTitle: 'Nueva carpeta',
    createNameLabel: 'Nombre, en {folder}/',
    createNameLabelRoot: 'Nombre, en el libro',
    createConfirm: 'Crear',
    createCancel: 'Cancelar',
    folderProblem: {
      blank: 'Ponle un nombre a la carpeta.',
      slash: 'El nombre de una carpeta no puede tener /.',
      dots: '. y .. no son nombres de carpeta.',
      hidden: 'El nombre de una carpeta no puede empezar con punto.',
      taken: 'Ya hay algo aquí con ese nombre.',
    },
    more: 'Más',
    delete: 'Eliminar',
    fileMeta: '{book} · {folder}/',
    tree: 'Archivos de {book}',
    holds:
      'Un libro guarda canciones (*.cifra.md), repertorios (*.setlist.md), README.md y .gitattributes, y nada más.',
    status: {
      unsaved: 'cambios sin guardar',
      new: 'nuevo',
      deleted: 'eliminado',
      conflict: 'conflicto',
      empty: 'vacía',
    },
    filesChanged: { one: '{count} archivo cambiado', other: '{count} archivos cambiados' },
    save: 'Guardar…',
    saveFiles: { one: 'Guardar {count} archivo…', other: 'Guardar {count} archivos…' },
    rename: 'Renombrar',
    renameLabel: 'Renombrar {name}',
    renameSong: 'Renombrar canción',
    renameSetlist: 'Renombrar repertorio',
    renameNameLabel: 'Nombre, en {folder}/',
    renameNameLabelRoot: 'Nombre',
    renameHintSong: 'Una canción conserva .cifra.md, así que sigue siendo una canción. El título dentro de ella no cambia.',
    renameHintSetlist: 'Un repertorio conserva .setlist.md, así que sigue siendo un repertorio.',
    linkNotice: 'Los enlaces a ella se actualizan en el mismo guardado',
    linkItem: '{path} · elemento {item}',
    renameCancel: 'Cancelar',
    renameConfirm: 'Renombrar',
    deleteLabel: 'Eliminar {name}',
    deleteTitle: '¿Eliminar {name}?',
    deleteBody:
      'Se quita del libro cuando guardes. Un repertorio que apunte a ella mostrará un elemento faltante.',
    deleteCancel: 'Conservar',
    deleteConfirm: 'Eliminar',
    changesTitle: 'Cambios sin guardar',
    changesCaption: 'Un guardado, un commit',
    noChanges: 'Nada que guardar.',
    historyHeading: 'Historial',
    merge: 'fusión',
    commits: 'Versiones de {book}',
    commitFiles: { one: '{count} archivo', other: '{count} archivos' },
    commitMeta: '{author} · {date} · {hash} · {files}',
    restore: 'Restaurar esta versión',
    restoreCaption:
      'Restaurar escribe ese archivo como estaba tras este commit en la copia de trabajo, para guardarlo como una nueva versión.',
    diffCaption: 'las diferencias de línea de {file} en este commit',
    emptyEditor: 'Elige un archivo para abrirlo.',
    emptyCommit: 'Elige un commit para ver qué cambió.',
  },

  nav: {
    label: 'Secciones',
    explore: 'Acordes',
    instrument: 'Instrumento',
    library: 'Guardados',
    sheets: 'Canciones',
    backup: 'Respaldo',
  },

  chip: {
    summary: 'Instrumento: {label}. Cambiar de instrumento.',
    add: '+ Agregar instrumento',
  },

  viewAs: {
    fromSheet: 'de este cifrado',
    fromLink: 'del enlace',
    viewing: ' Viendo como {label} ({source})',
    back: 'Volver a mi {label}',
    keep: 'Dejar como predeterminado',
  },

  input: {
    label: 'Acorde',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Mostrar',
    readAs: ' “{text}” leído como {reading}. ',
    use: 'Usar {reading}',
    build: 'Armar el acorde',
    root: 'Fundamental',
    quality: 'Cualidad',
    seventh: 'Séptima',
    bass: 'Bajo',
    bassRoot: 'Fundamental',
    extensions: 'Extensiones',
  },

  quality: {
    major: 'Mayor',
    minor: 'Menor',
    dim: 'Disminuido',
    aug: 'Aumentado',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'Sin séptima',
    dominant: 'Séptima dominante',
    major: 'Séptima mayor',
    diminished: 'Séptima disminuida',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'séptima mayor',
      dominantSharpFive: 'séptima dominante con quinta aumentada',
    },
    bareNine: {
      add: 'novena agregada, sin séptima',
      dominant: 'novena dominante, con la séptima menor',
    },
    degreeSign: {
      diminishedSeventh: 'séptima disminuida',
      diminishedTriad: 'tríada disminuida, sin séptima',
    },
    sevenFour: {
      suspendedFourth: 'cuarta suspendida',
      addedFourth: 'cuarta agregada',
    },
  },

  errors: {
    empty: 'Escribe un acorde.',
    unexpected: 'No esperaba "{text}".',
    needsNumber: '"{text}" debe ir seguido de un número.',
    bassNeeded: 'Después de "/" va una nota de bajo o un número.',
    badNote: 'No entiendo la nota: {text}',
    badPitch: 'No entiendo la altura: {text}',
    emptyTuning: 'Una afinación necesita al menos una cuerda.',
    unknownQuality: 'Cualidad de acorde desconocida: {quality}',
    badDegree: 'Grado de extensión inválido: {degree}',
    badAlteration: 'Alteración de extensión inválida: {alter}',
    unknownDialect: 'Sistema de cifrado desconocido: {dialect}',
    noRoot: '"{text}" no empieza con el nombre de una nota.',
    badRoot: 'No entiendo la fundamental "{text}".',
    badBass: 'No entiendo la nota de bajo "{text}".',
    unreadable: 'No entiendo "{text}" en "{whole}".',
    noSheetInLink: 'Ese enlace no trae ningún cifrado.',
    cannotDecompress: 'Este navegador no puede leer enlaces de cifrado comprimidos.',
    unknownLinkFormat: 'Ese enlace no está en un formato que la app entienda.',
    notASheet: 'Ese enlace no contiene un cifrado.',
  },

  toggles: {
    label: 'Vista del diagrama',
    neck: 'Vista del mástil',
    left: 'Zurdo',
  },

  results: {
    announceNone: 'No se encontraron digitaciones.',
    announceCount: '{count} digitaciones en {positions} posiciones.',
    empty: 'Escribe un acorde para ver cómo se toca.',
    none: 'No hay digitaciones para este acorde en {label}.',
    noneHelp:
      'Puede que necesite más cuerdas de las que tiene el instrumento, o que tus reglas de voicing sean demasiado estrictas.',
    adjustRules: 'Ajustar reglas de voicing',
    save: ' Guardar',
    saved: ' Guardado',
    saveLabel: 'Guardar {shorthand} en tu biblioteca',
    removeLabel: 'Quitar {shorthand} de tu biblioteca',
  },

  groups: {
    open: 'Posición abierta',
    fret: 'Traste {position}',
    list: 'Digitaciones: {position}',
    showFewer: 'Mostrar menos',
    showAll: 'Mostrar las {count}',
  },

  difficulty: { easy: 'fácil', medium: 'media', hard: 'difícil' },

  diagram: {
    open: 'posición abierta',
    startingAt: 'desde el traste {position}',
    barre: 'cejilla en {count} cuerdas en el traste {fret}',
    fingers: 'dedos {fingers}',
    muted: { one: '{count} cuerda sin tocar', other: '{count} cuerdas sin tocar' },
    rootOn: 'fundamental en la {ordinal} cuerda',
    noRoot: 'sin fundamental',
    voicedAs: 'suena como {chord}',
    toPlay: 'dificultad {difficulty}',
    yourShape: 'tu forma',
    default: 'predeterminada',
  },

  chart: {
    label: 'Cifrado',
    spoken: {
      noChord: 'sin acorde',
      bar: 'compás {n}:',
      needsYou: 'te necesita',
      conflict: 'un conflicto',
      endOfConflict: 'fin del conflicto',
      default: 'predeterminado',
      endOfDefaults: 'fin de los predeterminados',
    },
  },

  chord: {
    spoken: {
      doubleFlat: 'doble bemol',
      flat: 'bemol',
      sharp: 'sostenido',
      doubleSharp: 'doble sostenido',
      minor: 'menor',
      major: 'mayor',
      diminished: 'disminuido',
      augmented: 'aumentado',
      suspendedTwo: 'con segunda suspendida',
      suspendedFour: 'con cuarta suspendida',
      fifth: 'quinta',
      over: 'sobre',
      add: 'con',
      footnote: 'nota al pie',
      interval: { 2: 'segunda', 4: 'cuarta', 5: 'quinta', 6: 'sexta', 7: 'séptima', 9: 'novena', 11: 'oncena', 13: 'trecena' },
    },
  },

  reading: {
    back: 'Atrás',
    byline: '{artist} · {book}',
    keyOf: 'Tono de {key}',
    shapes: 'Formas',
    shapesInKey: 'Formas en {key}',
    shapesFor: 'Formas · {instrument}',
    shapesCaption: 'Hueca: la forma predeterminada del app. Rellena en color: tu forma para ese acorde.',
    transposedCaptionKey:
      'Las formas propias de la canción son para {key}, así que los acordes transpuestos usan tus formas y, luego, las predeterminadas.',
    transposedCaption:
      'Una canción transpuesta no tiene formas elegidas, así que cada acorde usa tu forma y, luego, la predeterminada.',
    unvoiced: 'Ninguna forma tocable para {list}.',
    variationLabel: 'Variación',
    variationDefault: 'Predeterminada',
    transpose: 'Transponer',
    transposeTitle: 'Transponer la vista',
    down: 'Un semitono abajo',
    up: 'Un semitono arriba',
    writtenKey: 'Tono escrito',
    transposedToKey: 'Transpuesta a {key} ({offset})',
    transposedBy: 'Transpuesta ({offset})',
    backToKey: 'Volver a {key}',
    backToWritten: 'Volver al tono escrito',
    arrangingOff: 'Arreglar está desactivado mientras está transpuesta',
    noVoicings:
      'Nadie ha elegido formas para {instrument} en esta canción todavía. Estas son las formas más fáciles para cada acorde.',
    arrangeFor: 'Arreglar para {instrument}',
    // La pregunta única en la primera apertura (workflow 1 §The instrument;
    // W01 L104-108; songs.first_song). El texto es fijo en "guitarra".
    instrumentPrompt: 'Tocando en guitarra — ¿cambiar?',
    instrumentPromptChange: 'Cambiar instrumento',
    instrumentPromptDismiss: 'Conservar la guitarra y descartar',
    arrange: 'Arreglar',
    edit: 'Editar',
    history: 'Historial',
    addToSetlist: 'Agregar al repertorio',
    print: 'Imprimir',
    share: 'Compartir',
    showFile: 'Mostrar el archivo',
    more: 'Más',
    fullScreen: 'Pantalla completa',
    leaveFullScreen: 'Salir de pantalla completa',
    // Una sincronización en segundo plano trajo una versión nueva con la canción
    // abierta (sync.read_in_place, flujo 8; W08). `{name}` es quien la cambió.
    updatedBy: 'Actualizado por {name}',
    seeWhatChanged: 'Ver qué cambió',
    updateDismiss: 'Descartar aviso de actualización',
    // The footnote under the full-screen chart while a merge waits (sync.in_place_notices;
    // W08#4 L153-156). `{name}` is the most recent incoming author.
    updateWaiting: 'Una actualización de {name} está esperando. Se mostrará cuando salgas de pantalla completa.',
  },

  arrange: {
    back: 'Atrás',
    done: 'Listo',
    modeChip: 'Arreglando · {instrument}',
    modeHint: 'Toca un acorde para elegir su forma',
    chordButton: 'Elegir una forma para {chord}',
    shapes: 'Formas',
    shapesCaption:
      'Las formas elegidas se ven en tinta. Un acorde que no elegiste muestra tu forma o la predeterminada de la app, cada una marcada.',
    chooseEveryUnchosen: 'Elegir estas para cada acorde sin elegir',
    runWizard: 'Usar el asistente',
    variations: 'Variaciones',
    pickerLabel: 'Formas de {chord}',
    scopeLabel: 'A qué acordes afecta esto',
    everyChord: 'Todo {chord}',
    onlyHere: 'Solo aquí',
    onlyHereWarning:
      'Solo aquí marca este compás en la cifra, para todos los que tocan la canción. En sus instrumentos se ve la predeterminada hasta que alguien elija.',
    choose: 'Elegir',
    chooseShape: 'Elegir esta forma',
    chooseShapeLabel: 'Elegir {chord}, {shorthand}',
    enterShape: 'Ingresar una forma',
    enterShapeTitle: 'Ingresar una forma para {chord}',
    noShapes: 'No hay forma tocable para {chord} en {instrument}.',
    variationLabel: 'Variación',
    variationDefault: 'Predeterminada',
    newVariation: '+ Nueva variación',
    selectorCaption: 'El selector aparece solo cuando {instrument} tiene más de una variación en esta canción.',
    addVariationTitle: 'Agregar una variación',
    variationName: 'Nombre de esta variación',
    variationPlaceholder: 'Más arriba en el mástil',
    variationCopy: 'Partir de las formas de “{name}”',
    variationNeedsName: 'Dale un nombre a la variación.',
    variationTaken: 'Ya existe una variación llamada “{name}” para este instrumento.',
    addVariationCancel: 'Cancelar',
    addVariationConfirm: 'Agregar',
  },

  library: {
    title: 'Formas guardadas',
    empty:
      'Nada guardado para {label} todavía. Marca una forma con estrella en la pantalla de acordes para tenerla aquí.',
    count: '{count} guardadas para {label}.',
    list: 'Formas guardadas para {label}',
    open: 'Abrir',
    openLabel: 'Mostrar {chord} en la pantalla de acordes',
    remove: 'Quitar',
    removeLabel: 'Quitar {chord} {shorthand} de tus formas guardadas',
  },

  catalog: {
    '6guitar': 'Guitarra (6 cuerdas)',
    '7guitar': 'Guitarra (7 cuerdas)',
    '4bass': 'Bajo (4 cuerdas)',
    '5bass': 'Bajo (5 cuerdas)',
    ukulele: 'Ukelele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolina',
    tenorbanjo: 'Banjo tenor',
  },

  // El nombre corto que muestra el chip del encabezado (shell.header_chrome,
  // flujo 15): el nombre del catálogo sin la cantidad de cuerdas del estándar.
  catalogShort: {
    '6guitar': 'Guitarra',
    '7guitar': 'Guitarra de 7 cuerdas',
    '4bass': 'Bajo',
    '5bass': 'Bajo de 5 cuerdas',
    ukulele: 'Ukelele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolina',
    tenorbanjo: 'Banjo tenor',
  },

  tuning: {
    Standard: 'Estándar',
    'Drop D': 'Drop D',
    'Open G': 'Sol abierto',
    'Open D': 'Re abierto',
    DADGAD: 'DADGAD',
    'Open C': 'Do abierto',
    Brazilian: 'Brasileña',
    'Standard (re-entrant)': 'Estándar (reentrante)',
    'Low G': 'Sol grave',
    Baritone: 'Barítono',
    'Standard (Brazil)': 'Estándar (Brasil)',
    Irish: 'Irlandesa',
    custom: 'Personalizada',
    customOption: 'Afinación personalizada',
  },

  form: {
    edit: 'Editar instrumento',
    choose: 'Elige tu instrumento',
    add: 'Agregar un instrumento',
    firstRunHelp: 'Todo se muestra para este instrumento. Puedes agregar otros y cambiar cuando quieras.',
    addHelp: 'Se suma a tu lista; el selector del encabezado cambia entre ellos.',
    instrument: 'Instrumento',
    fallbackName: 'Instrumento',
    tuning: 'Afinación',
    strings: 'Cuerdas',
    stringsHelp:
      'De la cuerda más grave a la más aguda. Sirve cualquier lista de notas separadas por comas, incluidas las afinaciones reentrantes.',
    style: 'Cómo tocas',
    styleHelp:
      'Define qué formas se ofrecen: con los dedos se permite una cuerda apagada en medio del acorde; al rasguear, no. La pantalla del instrumento lo cambia después.',
    name: 'Nombre',
    nameHelp: 'Aparece en el selector. Ponles a las afinaciones personalizadas nombres que reconozcas.',
    frets: 'Trastes',
    save: 'Guardar cambios',
    start: 'Empezar a tocar',
    addButton: 'Agregar instrumento',
    cancel: 'Cancelar',
    needName: 'Ponle un nombre al instrumento.',
    badTuning: 'No entiendo esa afinación: {reason}',
  },

  backup: {
    title: 'Respaldo',
    help:
      'Todo lo que tienes se guarda en este navegador, lo cual sirve hasta que el dispositivo ' +
      'no. Un respaldo es un solo zip con tus instrumentos y ajustes, tus formas guardadas y ' +
      'cada canción como un archivo de texto que puedes leer y editar en cualquier parte.',
    save: 'Guardar un respaldo',
    insideTitle: 'Qué trae dentro',
    inside:
      'Un zip, con tus instrumentos y sus reglas y tus ajustes en un archivo, tus formas ' +
      'guardadas en otro, y cada canción como un archivo de texto con su nombre. Pon otra ' +
      'canción en la carpeta songs con cualquier programa de zip y vuelve con el resto.',
    restore: 'Restaurar un respaldo',
    confirmTitle: '¿Restaurar desde “{name}”?',
    confirmBody:
      'Todo en este dispositivo se reemplaza por lo que trae el archivo: {instruments} y {songs}.',
    instruments: { one: '{count} instrumento', other: '{count} instrumentos' },
    songs: { one: '{count} canción', other: '{count} canciones' },
    confirmButton: 'Reemplazar todo',
    nudgeTitle: 'Tus canciones solo están en este dispositivo',
    nudgeText: {
      one:
        'La canción de aquí no está en ningún respaldo. En Android un teléfono nuevo no ' +
        'la recibe, y un navegador que borra sus datos se la lleva.',
      other:
        'Las {count} canciones de aquí no están en ningún respaldo. En Android un ' +
        'teléfono nuevo no las recibe, y un navegador que borra sus datos se las lleva.',
    },
    notNow: 'Ahora no',
    failed: 'No pude leer ese respaldo: {reason}',
  },
  instruments: {
    title: 'Instrumentos',
    help:
      'Todo lo que está en pantalla es para el instrumento en uso. Cada uno guarda su afinación, sus reglas de voicing, sus formas guardadas y sus canciones.',
    inUse: 'En uso',
    reentrant: 'Reentrante',
    meta: '{tuning} · {count} trastes',
    use: 'Usar',
    useLabel: 'Usar {label}',
    edit: 'Editar',
    editLabel: 'Editar {label}',
    delete: 'Eliminar',
    deleteLabel: 'Eliminar {label}',
    add: 'Agregar instrumento',
    back: '← Todos los instrumentos',
    deleteThis: 'Eliminar este instrumento',
    confirmTitle: '¿Eliminar {label}?',
    confirmShapes: {
      one: 'Su {count} forma guardada se va con él. ',
      other: 'Sus {count} formas guardadas se van con él. ',
    },
    confirmSongs: 'Las canciones se conservan, porque llevan su propia afinación. Esto no se puede deshacer.',
    confirmButton: 'Eliminar instrumento',
  },

  rules: {
    title: 'Reglas de voicing',
    help: 'Cómo se arman los acordes en {label}.',
    preset: 'Ajuste predefinido',
    custom: 'Personalizado',
    presets: {
      beginner: 'Principiante',
      strumming: 'Rasgueo',
      fingerstyle: 'Punteo',
      jazz: 'Jazz',
      bassFriendly: 'Para bajo',
    },
    rules: 'Reglas',
    rootInBass: 'La fundamental debe ser la nota más grave',
    requireThird: 'Exigir la tercera',
    omitFifth: 'La quinta se puede omitir',
    allowRootless: 'Permitir voicings sin fundamental',
    requireExtensions: 'Exigir todas las extensiones escritas',
    allowBarre: 'Permitir cejilla',
    allowInnerMutes: 'Permitir una cuerda apagada entre cuerdas que suenan',
    allowDoubling: 'Permitir la misma nota en más de una cuerda',
    allowDuplicatePitch: 'Permitir la misma altura dos veces',
    limits: 'Límites',
    maxSpan: 'Apertura máxima (trastes)',
    minSoundingStrings: 'Mínimo de cuerdas que suenan',
    maxResultsPerGroup: 'Formas mostradas por posición',
    weights: 'Pesos de dificultad',
    weightsHelp:
      'Cuánto pesa cada cosa para que una forma sea difícil. Los valores negativos hacen la forma más fácil.',
    weight: {
      spanPerFret: 'Apertura, por traste',
      barre: 'Cejilla',
      fullBarre: 'Cejilla completa, extra',
      perFinger: 'Cada dedo',
      innerMute: 'Cuerda apagada en medio',
      mutedString: 'Cada cuerda apagada',
      positionPerFret: 'Posición, por traste',
      omittedFifth: 'Omitir la quinta',
      rootless: 'Omitir la fundamental',
      nonRootBass: 'Inversión no pedida',
      openString: 'Cada cuerda al aire (una bonificación)',
      nonAdjacentStretch: 'Apertura amplia',
    },
  },

  sheets: {
    title: 'Cifrados',
    help: 'Los acordes de una canción en {label}, cada uno fijado a la digitación que quieres enseñar.',
    titlePlaceholder: 'Título de la canción',
    newTitleLabel: 'Título de la nueva canción',
    create: 'Nueva canción',
    untitled: 'Canción sin título',
    shared: 'Canción compartida',
    sharedInstrument: 'Instrumento compartido',
    empty: 'Todavía no hay canciones.',
    measures: { one: '{count} compás', other: '{count} compases' },
    chords: { one: '{count} acorde', other: '{count} acordes' },
    chosenHere: { one: ' · {count} voicing elegido aquí', other: ' · {count} voicings elegidos aquí' },
    voicedFor: 'Con voicings para {list}',
    view: 'Ver',
    viewLabel: 'Ver {title}',
    edit: 'Editar',
    editLabel: 'Editar {title}',
    duplicate: 'Duplicar',
    duplicateLabel: 'Duplicar {title}',
    delete: 'Eliminar',
    deleteLabel: 'Eliminar {title}',
    imported: 'Se importó la canción "{title}".',
  },

  editor: {
    // El editor de código fuente CodeMirror (songs.editor, flujos 3 y 4).
    source: {
      sourceLabel: 'Código de la canción',
      viewToggle: 'Qué mostrar',
      text: 'Texto',
      preview: 'Vista previa',
      previewLabel: 'Vista previa de la canción tal como se leerá',
      addSection: 'Agregar sección',
      save: 'Guardar',
      undo: 'Deshacer',
      pasteFenced: 'La canción pegada ahora está dentro de una cerca, así que se lee como música.',
      pasteTitleAdded: 'Su primera línea pasó a ser el título.',
      notSaved: 'No se guardó.',
      voicingStop:
        'La línea {line} es una digitación que no se puede leer, y al guardar se descartaría. Corrígela o bórrala y guarda de nuevo.',
      markerStop: 'La línea {line} es un marcador de conflicto. Resuélvelo antes de poder guardar la canción.',
      afterRuleStop:
        'La línea {line} viene después de la línea ---, donde solo se conservan bloques de digitaciones, y al guardar se descartaría. Si es parte de la canción, mueve la línea --- debajo de ella; un título de digitaciones necesita una afinación, como ## Voicings: E2 A2 D3 G3 B3 E4.',
    },
    // Una sincronización en segundo plano fusionó una nueva versión bajo las
    // ediciones sin guardar del editor abierto (songs.edit_in_place, workflow 8;
    // W08). El aviso no modal dice de quién vino y abre el historial de la
    // canción. `{name}` es el nombre de quien hizo el cambio. Reutiliza el texto
    // de la lectura (reading.updatedBy).
    mergedUnderLead: 'Lo que guardó {name} llegó mientras editabas',
    mergedUnderRest: ' y se combinó debajo de tus cambios. Los tuyos siguen aquí, sin guardar, encima.',
    cameIn: 'Llegó',
    seeWhatCameIn: 'Ver qué llegó',
    updateDismiss: 'Descartar aviso de actualización',
    // The editor app bar's word mark while the working text differs from the last
    // saved version (sync.in_place_notices; W08#3 L96, W04 L107/L158).
    unsaved: 'cambios sin guardar',
    // The phone's unsaved strip and the computer's Unsaved pane (songs.editor_chrome;
    // W04#1 L35-38, W04#4 L163-168).
    keptOnDevice: 'Guardado en este dispositivo',
    unsavedList: 'Sin guardar',
    variationInUse: 'Variación:',
    variationLabel: 'Qué variación usar',
    variationDefault: 'Predeterminado',
    variationAdd: 'Agregar variación',
    variationHelp:
      'Un instrumento puede tener varias variaciones en una canción: una fácil y una ' +
      'más llena, por ejemplo. Todas viven en el texto, cada una bajo su propio título; en ' +
      'cuál estás trabajando se recuerda por canción.',
    variationName: 'Nombre de esta variación',
    variationPlaceholder: 'Más arriba del mástil',
    variationCopy: 'Empezar desde las formas de «{name}»',
    variationNeedsName: 'Ponele un nombre a la variación.',
    variationTaken: 'Ya hay una variación llamada «{name}» para este instrumento.',
    variationCancel: 'Cancelar',
    variationConfirm: 'Agregar',
    chartBarNumbers: 'Mostrar los números de compás',
    chartVoicedAs: 'Nombrar los acordes de la cifra por lo que suenan las formas',
    back: '← Todas las canciones',
    titleLabel: 'Título de la canción',
    title: 'Título',
    song: 'La canción',
    placeholder: '# Verso\nA | Cm | A | Cm',
    help: {
      sections: {
        term: 'Secciones',
        text: 'Tres maneras de nombrar una: una línea que empieza con #, un nombre entre ' +
          'corchetes, o un nombre con dos puntos. Las dos últimas pueden llevar los ' +
          'acordes de la sección en la misma línea. Los dos puntos solo nombran una ' +
          'sección cuando lo que sigue son acordes, así que una línea cantada con dos ' +
          'puntos sigue siendo letra.',
        example: '# Verso\n[Intro] G  D  Em  C\nSolo: Am  F  C  G',
      },
      chart: {
        term: 'Un cifrado',
        text: 'Una barra vertical inicia un compás; los espacios separan los acordes dentro de él.',
        example: 'C  Am | F  G | C\nF     | G    | C',
      },
      words: {
        term: 'O con la letra debajo',
        text: 'Una línea de acordes sobre la línea que se canta, cada acorde encima de la sílaba en la que cae.',
        example: 'G         D\nCuando te vi pasar',
      },
      either: {
        term: 'Cuando la línea podría ser las dos cosas',
        text: 'Una barra vertical la hace cifrado. Un > al principio la hace letra, y es la única manera de resolver una línea que se lee como acorde.',
        example: 'G\n> A',
      },
      bars: {
        term: 'Números de compás',
        text: 'Los compases se cuentan solos. Escribí @9 al principio de un compás donde la ' +
          'cifra deja de coincidir con la partitura de la que salió: escribir una repetición ' +
          'completa hace que los mismos compases aparezcan dos veces, y hay que avisarle a la ' +
          'cuenta. Un título puede llevar el número, y un número en una línea sola vale para ' +
          'el compás siguiente.',
        example: '# A @9\nDm | G7 | @17 Em | A7',
      },
      variations: {
        term: 'Más de una variación',
        text: 'La palabra antes de los dos puntos nombra una variación, así que un ' +
          'instrumento puede tener varias en una canción: una versión fácil y una más llena. ' +
          'Un título que sólo dice Voicings es la variación predeterminada. En cuál trabajás ' +
          'se elige arriba de las formas.',
        example: '# Voicings: E2, A2, D3, G3, B3, E4\nC = x32010\n\n# Más arriba: E2, A2, D3, G3, B3, E4\nC = x35553',
      },
      voicings: {
        term: 'Voicings',
        text: 'Van después de una línea ---, un bloque por afinación bajo un título que la nombra, para que la misma canción sirva en todos los instrumentos. Un acorde que se toca de más de una manera lleva una nota. Un acorde para el que guardaste una forma recibe esa forma la primera vez que aparece.',
        example: '---\n\n# Posiciones: E2, A2, D3, G3, B3, E4\nCm = x35543\nCm[2] = 8-10-10-8-8-8',
      },
    },
    notAChord: 'No es un acorde: {list}',
    badVoicingLines: 'No pude leer estas líneas de voicing: {list}',
    chart: 'El cifrado',
    chartHelp: 'Haz clic en un acorde para elegir cómo se toca ahí.',
    nothingYet: 'Todavía no hay nada escrito.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', con la forma predeterminada',
    chordUnvoiced: ', sin digitación posible',
    chordChoose: '. Elegir un voicing.',
    voicings: 'Voicings',
    voicingsHelp: 'Haz clic en una forma para cambiarla en todos los lugares donde se usa.',
    voicingsDefaults:
      ' Las formas marcadas como predeterminadas son lo que la pantalla de acordes mostraría primero; elige solo las que lo necesiten.',
    voicingsEmpty: 'Escribe la canción arriba y sus acordes aparecen aquí.',
    voicingsList: 'Voicings usados en esta canción',
    choose: 'Elegir',
    change: 'Cambiar',
    everywhere: '{verb} {key} en todos los lugares. ',
    usingDefault: 'Con la forma predeterminada. ',
    usedIn: { one: 'Usado en {count} lugar.', other: 'Usado en {count} lugares.' },
    default: 'predeterminada',
    missing: 'No hay forma tocable en {label} para: {list}. Sus reglas de voicing pueden ser demasiado estrictas.',
    share: 'Compartir enlace',
    snapPage: 'Encuadrar esta página',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    pageOf: 'Página {current} de {total}',
    print: 'Imprimir',
    shareLabel: 'Enlace para compartir esta canción',
    shareHelp: 'Quien abra este enlace ve la canción tal como está escrita.',
  },

  picker: {
    enter: 'Armar una forma',
    editCurrent: 'Editar esta forma',
    changeEverywhere: 'Cambiar {label} en todos los lugares',
    howPlayed: '¿Cómo se toca {chord} aquí?',
    noParse: 'Ese acorde no se entiende.',
    none: 'No hay digitaciones para {chord} en {label}. Sus reglas de voicing pueden ser demasiado estrictas.',
    replaces: { one: 'Reemplaza esta forma en {count} lugar. ', other: 'Reemplaza esta forma en {count} lugares. ' },
    ways: '{count} maneras de tocarlo, agrupadas por posición y de la más fácil a la más difícil.',
    changesOne: 'Cambia solo este acorde. ',
    chosen: ', elegida actualmente',
    clearEverywhere: 'Quitar en todos los lugares',
    clearChoice: 'Quitar elección',
    cancel: 'Cancelar',
  },

  wizard: {
    open: 'Asistente de formas',
    barHelp: 'Elegí formas para toda la canción de una vez.',
    title: 'Elegir formas para toda la canción',
    help:
      'Cada uno de estos elige una forma para cada acorde de la canción, tomando en cuenta ' +
      'el camino de la mano por la cifra en vez de juzgar cada acorde por separado. Ves qué ' +
      'haría antes de que cambie nada.',
    planners: {
      smoothest: {
        name: 'El camino más parejo',
        text:
          'Deja la mano donde está y evita saltos en la voz más aguda. Dos formas fáciles en ' +
          'extremos opuestos del mástil cuestan más en secuencia que dos intermedias juntas.',
        how: [
          'Toda forma que la búsqueda ofrece para el acorde es candidata.',
          'Cada una se puntúa por lo difícil que es de sostener, más cuánto tendrían que ' +
            'moverse la mano y la voz más aguda respecto de la forma anterior.',
          'La cifra se recorre en orden de lectura, así cada elección responde a la anterior.',
        ],
      },
      openPosition: {
        name: 'Junto a la cejuela',
        text:
          'La forma más grave de cada acorde, con cuerdas al aire donde ayudan. Las formas ' +
          'que un principiante ya conoce.',
        how: [
          'Toda forma que la búsqueda ofrece para el acorde es candidata.',
          'Cada una se puntúa por lo difícil que es de sostener, más cuánto sube por el ' +
            'mástil, menos un crédito por cada cuerda al aire.',
          'La cifra se recorre en orden de lectura, así cada elección responde a la anterior.',
        ],
      },
      choroCentro: {
        name: 'Choro, al lado de una siete cuerdas',
        text:
          'La parte de la guitarra de seis cuerdas en un regional: bajo con el pulgar y tres ' +
          'dedos, en el primer cuarto del mástil, con su bajo una tercera arriba de lo que ' +
          'toca la siete cuerdas, para que las dos no se dupliquen.',
        how: [
          'Las formas se enumeran, no se buscan. La búsqueda común descarta una forma con ' +
            'cuerdas apagadas cuando hay una más llena e igual de fácil, lo que está bien para ' +
            'quien toca solo y mal acá, donde las cuerdas graves callan porque las tiene la ' +
            'siete cuerdas.',
          'Cuatro cuerdas sonando, o cinco. Cuatro es la norma en este idioma y cinco la ' +
            'excepción ocasional: un bajo con el pulgar y el resto con tres dedos.',
          'O tres notas, con el pulgar en la cuarta cuerda y la cuerda grave suprimida, que ' +
            'una fuente da como la otra textura del idioma. Solo para un acorde con séptima: ' +
            'lo que sale es fundamental o quinta, y se permite porque el trítono — la tercera ' +
            'y la séptima — sigue sonando. Se ofrece, no se prefiere: las transcripciones ' +
            'muestran cuatro voces en esa posición.',
          'Las cuerdas que suenan son vecinas, con el pulgar en la más grave, la segunda más ' +
            'grave o la cuarta, y la toma llegando al menos a la segunda cuerda desde arriba. ' +
            'Un hueco en el medio es una decisión que todavía podés tomar; una forma que lo ' +
            'necesita no se deshace.',
          'Nada arriba del séptimo traste, cuerdas al aire bienvenidas, y el bajo de la toma ' +
            'entre el mi grave y el re que le sigue. Es el tramo de mástil que nombran las ' +
            'fuentes y la región donde las transcripciones de Época de Ouro realmente están.',
          'La nota más grave queda una tercera arriba de lo que toca la siete cuerdas — la ' +
            'nota tras la barra cuando la cifra escribe una, la fundamental si no — en la ' +
            'octava en que esté esa guitarra. De eso se trata: las dos guitarras toman ' +
            'inversiones distintas para no duplicarse.',
          'Cuando una tercera arriba de ese bajo no pertenece al acorde, otra relación ocupa ' +
            'su lugar — cuál es la elección de abajo. El caso está nombrado en la literatura ' +
            'y no es una falla de acá: una tercera arriba de la séptima de un dominante que ' +
            'resuelve en acorde mayor cae en una nota que el estilo no usa.',
          'Se conserva toda nota del acorde salvo la quinta, que es la que este idioma ' +
            'deja — a menos que esa quinta esté disminuida o aumentada, porque una 5b o ' +
            '5# es lo que hace que el acorde sea ese acorde.',
          'La cifra se recorre en orden de lectura, prefiriendo formas que mantengan las ' +
            'mismas cuerdas sonando, que es lo que vuelve una serie como Gm, Gm6, Gm7 una ' +
            'sola toma con un dedo moviéndose.',
          'Cuando dos formas cuestan lo mismo, gana la más grave en el mástil, y un acorde ' +
            'más lleno le gana a uno que gasta una cuerda duplicando una nota.',
        ],
        options: {
          whenNoThirdAbove: {
            label: 'Cuando no hay tercera arriba de la otra guitarra dentro del acorde',
            values: {
              sixth: 'Una sexta, después una octava',
              thirdBelow: 'Una tercera abajo',
            },
            rules: {
              sixth:
                'Cuando una tercera arriba del bajo de la otra guitarra no pertenece al ' +
                'acorde, se usa una sexta arriba de él, y en su defecto una octava. Son los ' +
                'primeros remedios que la literatura da para ese caso.',
              thirdBelow:
                'Cuando una tercera arriba del bajo de la otra guitarra no pertenece al ' +
                'acorde, la toma baja a una tercera ABAJO de él, quedando en la quinta — la ' +
                'segunda inversión. La literatura la da para el mismo caso, la describe como ' +
                'en perfecta consonancia con el estilo y nombra la grabación de donde viene.',
            },
          },
        },
      },
    },
    summary: {
      one: '{count} de {total} acordes cambiarían.',
      other: '{count} de {total} acordes cambiarían.',
    },
    covers: {
      one: '{count} compás',
      other: '{count} compases',
    },
    nothing: 'Cada acorde ya tiene la forma que esto elegiría.',
    missing: 'Ninguna forma para {list}.',
    how: 'Cómo funciona',
    howTitle: 'Cómo elige esto',
    sources: 'De dónde viene esto',
    noSources: 'Sin fuente: es una regla práctica sobre manos, no una afirmación sobre cómo se toca la música de nadie.',
    apply: 'Usar estas formas',
    back: '← Otras maneras',
    cancel: 'Cancelar',
    preview: 'Ver el plan',
    policyLabel: 'Elegí un enfoque',
    previewTitle: 'Las formas que elegiría',
    planReady: 'El plan está listo',
    planReadyPrompt:
      '{variation} ya tiene formas elegidas en esta canción. ¿Poner el plan al lado de ellas, o encima de ellas?',
    choiceLabel: 'Dónde poner el plan',
    newVariation: 'En una variación nueva',
    newVariationHint: '{variation} queda como está',
    over: 'Encima de {variation}',
    overHint: 'Reemplaza lo que está elegido ahí',
    defaultName: 'Formas nuevas',
    editNote:
      'De cualquier modo es una edición en la copia de trabajo: la hoja de guardado muestra lo que eligió, y descartar lo deshace.',
    write: 'Escribir el plan',
  },

  shape: {
    foreign: '{note}, fuera del acorde',
    title: 'Armar una forma',
    titleFor: 'Armar una forma para {chord}',
    help:
      'Hacé clic en un traste para poner un dedo, y otra vez para sacarlo. La fila arriba de ' +
      'la cejuela alterna la cuerda entre al aire y sin tocar.',
    frets: 'Trastes {from} a {to}',
    towardsNut: 'Mover la ventana hacia la cejuela',
    upTheNeck: 'Mover la ventana hacia arriba del mástil',
    sketch: 'Forma en armado: {shorthand}',
    unplayable: 'Ninguna mano para esto',
    empty: 'Nada en ninguna cuerda todavía.',
    clear: 'Limpiar',
    cancel: 'Cancelar',
    save: 'Usar esta forma',
  },

  print: { legend: 'Formas de acorde usadas' },

  confirm: { cancel: 'Cancelar', confirm: 'Eliminar' },

  install: {
    title: 'Agrega Explore Chords a tu pantalla de inicio',
    label: 'Instalar esta app',
    promptHelp: 'Se abre como una app y sigue funcionando sin red — útil en una clase.',
    iosHelp:
      'Toca Compartir y luego "Agregar a inicio". Después se abre como una app y sigue funcionando sin red.',
    install: 'Instalar',
    notNow: 'Ahora no',
    gotIt: 'Entendido',
    never: 'No volver a preguntar',
  },

  update: {
    ready: 'Hay una nueva versión lista.',
    reload: 'Recargar ahora',
    dismiss: 'Descartar',
  },

  announce: {
    whatsNew: 'Novedades',
    showTutorial: 'Ver el tutorial',
    letsGo: 'Vamos',
    close: 'Cerrar',
    sinceLast: 'Qué cambió desde tu última visita',
  },

  announcements: {
    welcome: {
      title: 'Bienvenido a Explore Chords',
      sections: [
        {
          heading: 'Encuentra un acorde',
          text:
            'Escríbelo como lo escribes tú — C7M, Cmaj7 o C∆7 funcionan — y aparecen todas las ' +
            'maneras de tocarlo en tu instrumento, agrupadas por dónde se apoya la mano y de la ' +
            'más fácil a la más difícil. Cuando un símbolo puede significar dos cosas, un aviso ' +
            'dice qué lectura se tomó y te deja cambiarla.',
        },
        {
          heading: 'Tu instrumento va primero',
          text:
            'El selector del encabezado cambia entre los instrumentos que configuraste. Cada uno ' +
            'guarda su afinación y sus reglas de voicing; la pantalla Instrumento es donde las ' +
            'editas, y donde un bajo y un ukelele pueden querer cosas distintas.',
        },
        {
          heading: 'Guarda las formas que te gusten',
          text:
            'Marca una forma con estrella y va a Guardados. Después, un acorde para el que tienes ' +
            'una forma guardada toma esa forma automáticamente la primera vez que aparece en una ' +
            'canción.',
        },
        {
          heading: 'Escribe canciones como texto',
          text:
            'En Canciones, un cifrado es texto plano: una línea que empieza con # nombra una ' +
            'sección, una barra vertical inicia un compás, los espacios separan los acordes dentro ' +
            'de él. Haz clic en un acorde para elegir cómo se toca; la elección se escribe de vuelta ' +
            'en el texto después de una línea ---, un bloque por afinación, para que la misma ' +
            'canción sirva en todos los instrumentos.',
        },
        {
          heading: 'Funciona sin señal',
          text:
            'Una vez cargada, todo corre en tu dispositivo. Agrégala a tu pantalla de inicio y ' +
            'llévala a una clase sin red.',
        },
      ],
    },
    '0.2.0': {
      title: 'Qué cambió en la 0.2',
      sections: [
        {
          heading: 'Una canción, todos los instrumentos',
          text:
            'Una canción ya no pertenece a un instrumento. Sus voicings se guardan por afinación, ' +
            'después de una línea --- en el texto, así que el mismo cifrado se toca en tu guitarra ' +
            'y en tu ukelele, cada uno con sus formas. Las canciones guardadas en el formato ' +
            'anterior se convierten solas, y las copias separadas por instrumento de una misma ' +
            'canción se unen en una.',
        },
        {
          heading: 'Los acordes sin forma elegida igual tienen una',
          text:
            'Toman la forma que la pantalla de acordes mostraría primero, marcada como ' +
            'predeterminada. Elige solo los que lo necesiten.',
        },
        {
          heading: 'Las formas guardadas entran en las canciones',
          text:
            'Una forma que marcaste con estrella se usa en cuanto su acorde entra en una canción, ' +
            'si es distinta de la predeterminada.',
        },
        {
          heading: 'B° es la séptima',
          text:
            'Un ° solo ahora se lee como séptima disminuida, que es lo que el símbolo significa en ' +
            'la práctica; la palabra dim es la tríada, y un aviso ofrece la otra lectura.',
        },
      ],
    },
    '0.3.0': {
      title: 'Qué cambió en la 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'La app ahora habla portugués de Brasil, español de Latinoamérica e italiano, además de inglés. ' +
            'Sigue el idioma del navegador; el selector del encabezado lo cambia, y la elección se ' +
            'recuerda en este dispositivo.',
        },
        {
          heading: 'Cifrados alineados',
          text:
            'En pantalla y al imprimir, los compases de una sección quedan en columnas, como en un ' +
            'cifrado escrito a mano, y la hoja impresa empieza por el cifrado y deja las formas ' +
            'pequeñas debajo.',
        },
      ],
    },
    '0.4.0': {
      title: 'Qué cambió en la 0.4',
      sections: [
        {
          heading: 'Rasgueo o punteo',
          text:
            'Las reglas que se llamaban Estándar ahora se llaman Rasgueo, y Punteo quedó al ' +
            'lado. Quien puntea sencillamente no toca la cuerda del medio del acorde, así que ' +
            'el punteo permite formas que el rasgueo no alcanza. Al configurar un instrumento ' +
            'se te pregunta cuál tocas, y la pantalla del instrumento lo cambia después.',
        },
        {
          heading: 'Se acabaron las cuerdas apagadas porque sí',
          text:
            'Una forma deja de ofrecerse cuando la misma forma con una de sus cuerdas apagadas ' +
            'sonando también está y los dedos que la completan bajan sin esfuerzo. Sol menor te ' +
            'da 3x0333, con la cuerda re sonando, en lugar de 3xx333, que la apaga sin razón, y ' +
            'el do al aire aparece entero en vez de a pedazos. Una estirada o una cejilla siguen ' +
            'contando como trabajo, así que las formas que necesitan una siguen ahí. Y una ' +
            'cuerda apagada en medio dejó de contar en la dificultad: al puntear, una cuerda que ' +
            'no tocas no cuesta nada.',
        },
      ],
    },
    '0.5.0': {
      title: 'Qué cambió en la 0.5',
      sections: [
        {
          heading: 'Canciones con su letra',
          text:
            'Ahora una canción se puede escribir como un cifrado con letra: una línea de ' +
            'acordes sobre la línea que se canta, cada acorde encima de la sílaba en la que ' +
            'cae. Pega una y se lee así, con [Intro] e Intro: nombrando secciones como ya lo ' +
            'hacía #. La letra va con ella a la hoja impresa, que ahora sale en dos columnas ' +
            'cuando la canción es lo bastante angosta — normalmente a la mitad de páginas. Y en ' +
            'el teléfono la estrofa salta de línea en vez de irse de lado.',
        },
        {
          heading: 'Los cifrados de siempre no cambian',
          text:
            'Una canción sin letra debajo de los acordes se lee exactamente como antes. Cuando ' +
            'una línea podría ser las dos cosas, una barra vertical la hace cifrado y un > al ' +
            'principio la hace letra, que es la única manera de resolver una estrofa que de ' +
            'verdad dice "A", contra el acorde del mismo nombre.',
        },
      ],
    },
    '0.6.0': {
      title: 'Qué cambió en la 0.6',
      sections: [
        {
          heading: 'La canción abre para leerse',
          text:
            'Ahora cada canción tiene una página propia que la muestra como saldrá en papel — ' +
            'la letra debajo de los acordes y las formas que tocas — en lugar de abrir el ' +
            'editor. El texto sigue a un clic, y la lista ofrece los dos caminos.',
        },
        {
          heading: 'Una página a la vez',
          text:
            'Esa página se divide en páginas del tamaño de tu pantalla, así se ve dónde la ' +
            'canción pasa del final de una. Las flechas de la esquina las dan vuelta y dejan ' +
            'la página entera a la vista, lo que convierte tocar mirando la pantalla en dar ' +
            'vuelta la página en vez de desplazarse. Su centro vuelve a encuadrar la página ' +
            'después de un desplazamiento a mano, y la barra de arriba ya no se lleva una ' +
            'franja de la ventana.',
        },
        {
          heading: 'Los cifrados se leen mejor',
          text:
            'Los paréntesis alrededor de una serie de acordes marcan una repetición y ya no se ' +
            'leen como acordes. Los acordes que siguen después del final de la letra conservan ' +
            'el espaciado con que se escribieron. Y una estrofa que salta a una línea de una ' +
            'palabra se lee como letra, no como un acorde que nadie reconoce.',
        },
      ],
    },
    '0.7.0': {
      title: 'Qué cambió en la 0.7',
      sections: [
        {
          heading: 'Guarda todo en un archivo',
          text:
            'Todo lo que tienes se guarda en este navegador, lo cual sirve hasta que el ' +
            'dispositivo no. La pantalla del instrumento ahora guarda todo en un zip — tus ' +
            'instrumentos y sus reglas, tus ajustes, tus formas guardadas y cada canción — y ' +
            'lo restaura aquí o en otro dispositivo.',
        },
        {
          heading: 'Tus canciones son archivos de texto',
          text:
            'Dentro del zip cada canción es un archivo de texto que puedes leer o editar con ' +
            'cualquier cosa. Pon otro en la carpeta songs con cualquier programa de zip y ' +
            'vuelve como canción, con el nombre de su archivo. El respaldo es tuyo, no un ' +
            'formato que solo esta app entiende.',
        },
      ],
    },
    '0.8.0': {
      title: 'Qué cambió en la 0.8',
      sections: [
        {
          heading: 'Un recordatorio para respaldar',
          text:
            'El respaldo ahora tiene su propia pantalla, y la lista de canciones avisa cuando ' +
            'hay canciones que no están en ningún respaldo — porque un Android nuevo no las ' +
            'trae, y un navegador que borra sus datos se las lleva. En el teléfono, guardar ' +
            'entrega el archivo al menú de compartir, donde están Drive, Archivos e iCloud.',
        },
        {
          heading: 'Las páginas se llenan hacia abajo antes que a lo ancho',
          text:
            'Al leer una canción, la columna ahora llega al pie de la página antes de que algo ' +
            'de la canción vaya al lado. Antes, unas estrofas en una pantalla ancha salían como ' +
            'una línea arriba de una página vacía. Una segunda columna es una página ahorrada, ' +
            'no ancho para gastar.',
        },
        {
          heading: 'Los acordes conservan sus paréntesis',
          text:
            'Em7(b5), A7(b13) y C7(9) se leían como un acorde llamado Em7(b5 con un paréntesis ' +
            'suelto al lado, porque los paréntesis también marcan una repetición. Ahora solo es ' +
            'marca de repetición el paréntesis que nada cierra, o que nada abrió.',
        },
      ],
    },
    '0.9.0': {
      title: 'Qué cambió en la 0.9',
      sections: [
        {
          heading: 'El signo de repetición',
          text:
            'El cifrado puede usar % para un compás que sigue igual al anterior, y se lee ' +
            'así, no como un acorde que nadie reconoce. Se muestra tal como lo escribiste, ' +
            'sin convertirse en el acorde que representa, y no hay nada que elegir en él: el ' +
            'acorde que repite ya tiene su forma donde se escribió.',
        },
      ],
    },
    '0.10.0': {
      title: 'Qué cambió en 0.10',
      sections: [
        {
          heading: 'Todos los diagramas del mismo tamaño',
          text:
            'Una forma más arriba en el mástil lleva el número de traste, y el espacio para él ' +
            'hacía ese diagrama más ancho que los demás, dejando la fila despareja y cada ' +
            'cuadrícula descentrada bajo su nombre. Ahora todo diagrama reserva ese espacio, ' +
            'lo necesite o no. El número de traste también es más grande, y los diagramas de ' +
            'la hoja impresa igual: estaban demasiado chicos para leerlos desde el atril.',
        },
        {
          heading: 'Lo que la forma suena de verdad',
          text:
            'El nombre del acorde dice cuál es la armonía. La forma decide cuál de sus notas ' +
            'queda más grave, y si la fundamental suena. Cuando ambos difieren, el nombre ' +
            'ahora lleva una nota discreta de lo que estás tomando en realidad: un Gm7 con la ' +
            'tercera abajo aparece como Gm7/Bb. Importa más cuando otro instrumento hace el ' +
            'bajo, porque entonces tomar otra inversión es el arreglo y no un accidente.',
        },
        {
          heading: 'El asistente de formas',
          text:
            'Un botón arriba de la cifra elige formas para toda la canción de una vez. Tres ' +
            'maneras hasta ahora: el camino más parejo para la mano, junto a la cejuela, o la ' +
            'parte de la guitarra de seis cuerdas en un regional de choro al lado de una ' +
            'siete cuerdas. Muestra qué haría antes de que cambie nada, y cada una explica ' +
            'sus propias reglas y cita sus propias fuentes en «Cómo funciona».',
        },
        {
          heading: 'O nombrar la cifra por lo que tocás',
          text:
            'Una casilla en la página de lectura nombra los acordes de la cifra por lo que ' +
            'suenan las formas elegidas, así Gm aparece como Gm/Bb cuando su forma pone la ' +
            'tercera abajo. Apagado por defecto, ya que una cifra nombra la armonía. Vale ' +
            'también para la hoja impresa, porque es el mismo renderizador.',
        },
      ],
    },
    '0.11.0': {
      title: 'Qué cambió en 0.11',
      sections: [
        {
          heading: 'Armar una forma haciendo clic',
          text:
            'La lista de formas de un acorde es lo que encontró la búsqueda, que no sirve ' +
            'cuando ya sabés qué querés tocar y no está ahí. Las dos maneras de elegir una ' +
            'forma ahora también ofrecen un diagrama grande para hacer clic: un traste para ' +
            'poner un dedo, otra vez para sacarlo, la fila arriba de la cejuela para alternar ' +
            'la cuerda entre al aire y sin tocar. Empieza desde la forma en uso, o desde cero, ' +
            'y te deja guardar una apertura para la que no encuentra dedos: una forma puede ' +
            'estar bien y ser incómoda. Abajo están las notas que toma, con cualquier nota ' +
            'fuera del acorde marcada.',
        },
        {
          heading: 'Las formas bajan por la página en el teléfono',
          text:
            'Las formas de una canción y las que guardaste iban en una sola fila que se ' +
            'desplazaba de costado, dejando siete de ocho fuera de la pantalla con todo el ' +
            'alto de la página libre. Ahora se acomodan en varias filas. Los resultados de ' +
            'acordes siguen desplazándose de costado, porque ahí hay un orden y el primero de ' +
            'la fila es la respuesta.',
        },
        {
          heading: 'Menos páginas al leer una canción',
          text:
            'Una canción con líneas de cifra más anchas que la pantalla del teléfono salía con ' +
            'una página por título de sección y las formas cortadas al costado. Ahora la cifra ' +
            'ocupa la única página que necesita, y las formas siguen entre páginas en vez de ' +
            'quedar cortadas.',
        },
      ],
    },
    '0.12.0': {
      title: 'Qué cambió en 0.12',
      sections: [
        {
          heading: 'Números de compás',
          text:
            'Transcribir de una partitura suele implicar reescribir su estructura: una ' +
            'repetición se escribe completa, porque así se toca mejor. Entonces los compases ' +
            'de la cifra dejan de coincidir con los números de la partitura, y “desde el ' +
            'compás 9” tiene que significar el compás 9 de la partitura. Así que los compases ' +
            'se cuentan solos, y @9 al principio de un compás dice cuál es su número real ' +
            '— también en un título, como # A @9. Los números van en el margen de la página de ' +
            'lectura, y en la hoja impresa con ella. Apagados hasta que los pidas, y no se ' +
            'ofrecen en una canción con letra, donde un acorde puede durar cuatro compases o ' +
            'medio y el texto no dice cuál.',
        },
        {
          heading: 'Se encuentra cómo armar una forma',
          text:
            'Un acorde tiene tantas formas como tiene — cuarenta y tres para un C en guitarra ' +
            '— y los botones estaban debajo de esa lista, lo que en el teléfono los dejaba a ' +
            'todos fuera de la pantalla. Ahora están arriba de la lista, bajo el título.',
        },
      ],
    },
    '0.13.0': {
      title: 'Qué cambió en 0.13',
      sections: [
        {
          heading: 'Más de una manera de tocar la misma canción',
          text:
            'Una canción guardaba un conjunto de formas por instrumento. Ahora puede guardar ' +
            'varios: una versión fácil y una más llena, o dos pasadas del asistente lado a ' +
            'lado para comparar. La palabra antes de los dos puntos en el título de las formas ' +
            'nombra la variación, así que «# Más arriba: E2, A2, …» es una variación llamada ' +
            'Más arriba. Agregá una arriba de las formas, partiendo de la que estás usando o ' +
            'de cero, y cambiá entre ellas ahí o en la página de lectura. Un acorde del que la ' +
            'variación no dice nada queda en su forma predeterminada, igual que antes.',
        },
        {
          heading: 'Se fue un «null» perdido',
          text:
            'La página de lectura de una canción con letra mostraba la palabra null debajo del ' +
            'título, y el panel de formas de una canción sin acordes también. Los dos están ' +
            'arreglados, junto con la razón por la que pasaba.',
        },
      ],
    },
    '0.14.0': {
      title: 'Qué cambió en 0.14',
      sections: [
        {
          heading: 'El asistente de choro pregunta cómo lo querés tocar',
          text:
            'Algunas preguntas de este estilo no tienen respuesta correcta, solo preferencia. ' +
            'Cuando la siete cuerdas sube un semitono — fa a fa#, en un compás de F y otro de ' +
            'F#° — una tercera arriba es la en los dos, así que la seis cuerdas toma la misma ' +
            'nota en el bajo dos veces. Un chorão puede hacer exactamente eso, o bajar a una ' +
            'tercera abajo. Las dos están en la literatura. Esa elección ahora está al lado de ' +
            'las formas: giralá y mirá responder a toda la canción. La lista “Cómo elige esto” ' +
            'gira con ella, así que lo que dice es siempre lo que va a hacer.',
        },
        {
          heading: 'Acordes que dejaba en blanco',
          text:
            'Un dominante con la séptima en el bajo — C7/Bb camino a F — volvía sin forma ' +
            'alguna. Hay una respuesta documentada: la seis cuerdas va una tercera ABAJO de la ' +
            'otra guitarra y queda en la quinta, C7/G. Ahora toca eso. A Cm7 le faltaba la ' +
            'tercera por un motivo parecido. Y un dominante puede tocarse ahora con tres notas ' +
            'y el pulgar en la cuarta cuerda, que es la otra textura del estilo y acá ' +
            'simplemente no estaba.',
        },
        {
          heading: 'Los acordes disminuidos conservan su trítono',
          text:
            'Al pedir F#°, el asistente daba cuatro cuerdas sin trítono y una de ellas gastada ' +
            'en duplicar una nota. La quinta es la nota que este estilo deja — pero no cuando ' +
            'está disminuida, que es justamente la que hace que el acorde sea disminuido. Ahora ' +
            'se queda, y la quinta aumentada del acorde aumentado también.',
        },
        {
          heading: 'Un acorde, dos formas, cuando la canción las pide',
          text:
            'El asistente elegía una forma por acorde para toda la canción. Ahora puede darle ' +
            'al mismo acorde una forma distinta en otro compás, cuando su política lo pida, y ' +
            'escribe la marca al pie solo. La vista previa muestra la canción como va a quedar ' +
            '— las formas que va a llevar y cuántos compases cubre cada una — así que un acorde ' +
            'partido en dos es algo que ves antes de aceptar y no después.',
        },
      ],
    },
    '0.15.0': {
      title: 'Qué cambió en 0.15',
      sections: [
        {
          heading: 'Una tesis que no encontrábamos',
          text:
            'El asistente de choro sigue fuentes escritas, y el único trabajo dedicado por ' +
            'entero a la parte de la guitarra de seis — José Paulo Becker sobre Época de ' +
            'Ouro, 1996 — no aparecía por ningún lado. Apareció. Todo lo de abajo sale de ' +
            'leerlo, y por eso esta versión corrige cosas que la 0.14 tenía a medias. Ahora ' +
            'figura en “De dónde viene esto”, con las demás.',
        },
        {
          heading: 'La pregunta que te hace es mejor ahora',
          text:
            'Antes preguntaba qué hacer cuando la tercera arriba de la otra guitarra repetía ' +
            'la nota que acababas de tocar. Ninguna fuente pregunta eso — y Becker, que ' +
            'documenta esta parte en detalle, nunca pone la seis cuerdas por debajo de la ' +
            'siete. Así que la pregunta es ahora la que la literatura sí hace: cuando ninguna ' +
            'tercera arriba de la otra guitarra está en el acorde, ¿querés una sexta y luego ' +
            'una octava, o la tercera abajo? C7/Bb camino a F es el caso, y se oyen las dos.',
        },
        {
          heading: 'Llega a la prima, y se queda en su registro',
          text:
            'Dos fuentes discrepan sobre dónde van los dedos, y ganó la que transcribe ' +
            'ejecuciones reales. La guitarra de Becker en Época de Ouro usa la prima todo el ' +
            'tiempo — un re menor con re debajo de la, re y fa, sobre las cuatro primeras ' +
            'cuerdas — así que el asistente ahora ofrece esas formas. Medir sus ' +
            'transcripciones también dio el registro en que la parte realmente está, nunca ' +
            'bajo el mi al aire y casi siempre entre el sol y el re que le sigue, y el ' +
            'asistente ahora se queda ahí en vez de subir por el mástil.',
        },
        {
          heading: 'Y algo dejado a propósito como estaba',
          text:
            'El dominante de tres notas con el pulgar en la cuarta cuerda, nuevo en 0.14, se ' +
            'apoya en una sola fuente. Becker nunca habla de suprimir una cuerda, y sus ' +
            'transcripciones muestran cuatro voces en esa posición. Así que la forma se sigue ' +
            'ofreciendo y dejó de preferirse. Donde “Cómo elige esto” depende de una sola ' +
            'fuente, o de nuestra lectura y no de la de ellas, ahora lo dice.',
        },
      ],
    },
  },

  instr: {
    chip: {
      change: '{label}, cambiar de instrumento',
      description: '{catalogue}, afinación {tuning}: {pitches}',
      descriptionCustom: '{catalogue}, afinación personalizada: {pitches}',
    },
    roster: {
      title: 'Instrumentos',
      inUse: 'en uso',
      reentrant: 're-entrante',
      strings: { one: '{count} cuerda', other: '{count} cuerdas' },
      open: 'Abrir {label}',
      add: 'Agregar instrumento',
      addMeta: 'catálogo, una afinación, un nombre',
      footer:
        'El que está en uso moldea cada acorde que la app muestra. Cambiar lo re-deriva todo al instante — un toque. Un instrumento en uso a la vez.',
      back: 'Volver',
    },
    add: {
      title: 'Agregar instrumento',
      cancel: 'Cancelar',
      instrument: 'Instrumento',
      tuning: 'Afinación',
      tuningGroup: 'Elige una afinación',
      custom: 'Personalizada…',
      customOption: 'Afinación personalizada',
      customPlaceholder: 'E2 A2 D3 G3 B3 E4',
      tuningHelp:
        'La afinación es la identidad del instrumento — la misma grafía que usa el bloque de voicing de una canción (cifra.md §6). Una cejilla es una afinación; no hay campo de cejilla.',
      name: 'Nombre',
      howYouPlay: 'Cómo tocas',
      howYouPlayHelp: 'El preset. Ajusta las reglas individuales después, en la pantalla del instrumento.',
      submit: 'Agregar instrumento',
      badTuning: 'Esa afinación no se entiende: {reason}',
    },
    detail: {
      use: 'Usar este instrumento',
      inUse: 'en uso',
      definition: 'Definición',
      edit: 'Editar',
      catalogue: 'Catálogo',
      tuning: 'Afinación',
      frets: 'Trastes',
      voicingRules: 'Reglas de voicing',
      editRules: 'Editar reglas',
      remove: 'Quitar instrumento',
    },
    rules: {
      title: 'Reglas de voicing',
      preset: 'Preset',
      presetGroup: 'Preset de voicing',
      reset: 'Volver a {preset}',
      explainer:
        'Editar cualquier regla vuelve el preset Personalizado y lo mantiene tal cual. Un instrumento que todavía nombra un preset se reconstruye a partir de él al cargar; un conjunto Personalizado no.',
      rules: 'Reglas',
      limits: 'Límites',
      costs: 'Costos',
      noBass:
        'Fundamental en el bajo queda desactivada en un instrumento sin registro grave — un ukelele, un cavaquinho — para que pasar a Jazz no vuelva a romperla.',
      on: 'activado',
      off: 'desactivado',
      toggleLabel: '{label}, {state}',
      rule: {
        requireRoot: 'Fundamental obligatoria',
        rootInBass: 'Fundamental en el bajo',
        requireThird: 'Tercera obligatoria',
        omitFifth: 'La quinta puede omitirse',
        allowRootless: 'Permitir sin fundamental',
        requireExtensions: 'Extensiones obligatorias',
        allowBarre: 'Permitir cejilla',
        allowInnerMutes: 'Permitir cuerdas apagadas en medio',
        allowDoubling: 'Permitir doblar notas',
        allowDuplicatePitch: 'Permitir altura idéntica repetida',
      },
      limit: {
        maxSpan: 'Apertura máxima',
        maxSpanUnit: 'trastes',
        minSoundingStrings: 'Mínimo de cuerdas sonando',
        maxResultsPerGroup: 'Formas por posición',
      },
    },
    shapes: {
      heading: 'Mis formas · {tuning}',
      saved: { one: '{count} guardada', other: '{count} guardadas' },
      empty: 'Aún no hay formas guardadas para esta afinación. Marca una en el explorador.',
      footer:
        'Marcadas una a una en el explorador (flujo 16); revisadas y quitadas aquí. Nunca escritas en una canción.',
      remove: 'Quitar tu forma de {chord}, {shorthand}',
    },
    remove: {
      title: '¿Quitar {label}?',
      shapes: { one: 'Su {count} forma guardada', other: 'Sus {count} formas guardadas' },
      body:
        '{shapes} y las variaciones en uso para {tuning} se quitan con él. Tus canciones conservan sus propios voicings — solo se van los ajustes de este instrumento.',
      bodyNoShapes:
        'Las variaciones en uso para {tuning} se quitan con él. Tus canciones conservan sus propios voicings — solo se van los ajustes de este instrumento.',
      cancel: 'Cancelar',
      confirm: 'Quitar',
    },
  },
};
