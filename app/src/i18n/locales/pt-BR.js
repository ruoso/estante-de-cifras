/**
 * Português do Brasil.
 *
 * Vocabulário de quem ensina violão por aqui: casa, pestana, corda solta,
 * digitação, cifra. "Voicing" fica em inglês, como se diz na prática.
 */
export default {
  app: { name: 'Estante de Cifras', wordmark: 'Estante' },

  ordinal: { other: '{n}ª' },

  locale: { label: 'Idioma' },

  header: {
    help: 'Ajuda',
    helpLabel: 'Ajuda e novidades',
  },

  shell: {
    nav: 'Destinos',
    search: 'Busca',
    books: 'Livros',
    setlists: 'Repertórios',
  },

  // A tela de gerenciamento de livros (books.shelf, fluxo 7). `{name}` é o
  // título de um livro; `{count}` o número de alterações aguardando sincronia.
  books: {
    back: 'Voltar',
    add: 'Adicionar livro',
    addTitle: 'Adicionar um livro',
    close: 'Fechar',
    nameLabel: 'Nome do livro',
    namePlaceholder: 'Dê um nome ao livro',
    newBookHelp: 'Um nome, e um livro vazio. Sem precisar de conta.',
    create: 'Novo livro',
    byLink: 'Por link',
    byLinkMeta: 'Cole um link de um livro na Estante.',
    byLinkLabel: 'Link do livro',
    byLinkPlaceholder: 'https://…/i/…',
    byLinkOpen: 'Abrir',
    byLinkInvalid: 'Isso não é um link de livro.',
    mineOnEstante: 'Meus na Estante',
    mineMeta: 'Seus livros que ainda não estão nesta estante.',
    mineSignedOut: 'Entre para vê-los.',
    mineSignInPasskey: 'Entrar com uma chave de acesso',
    mineEmailLink: 'Sem chave de acesso aqui? Me envie um link por e-mail',
    mineAdd: 'Adicionar',
    mineAddLabel: 'Adicionar {name}',
    mineLeave: 'Sair',
    mineLeaveLabel: 'Sair de {name}',
    mineEmpty: 'Todos os seus livros já estão nesta estante.',
    mineError: 'Não foi possível conectar à Estante. Tente de novo.',
    uploadRow: 'Enviar',
    uploadRowMeta: 'Um zip de um livro, com ou sem o histórico.',
    uploadTitle: 'Enviar {name}',
    uploadCancelSurface: 'Cancelar o envio',
    uploadWhatToDo: 'O que fazer com ele',
    uploadWhatToDoLabel: 'O que fazer com o envio',
    uploadAsNew: 'Importar como livro novo',
    uploadMerge: 'Mesclar em um livro existente',
    uploadMergeInto: 'Mesclar em',
    uploadNoTargets: 'Você ainda não tem livros onde possa salvar. Importe como livro novo.',
    uploadBranch:
      'Do branch {branch} do zip. As edições do zip que nunca foram salvas são lidas como mais um salvamento: alterações do envio, feitas por você.',
    uploadSongs: 'Música por música',
    uploadAdded: 'adicionada',
    uploadChanged: 'alterada',
    uploadConflict: 'conflito',
    uploadReplace: 'substituir',
    uploadUnresolved: 'não resolvido',
    uploadUnresolvedHelp: 'mesclagem não resolvida: resolva antes de importar',
    uploadMarkerLine: 'primeira marca na linha {line}',
    uploadKeep: 'Substituir “{name}” pela versão enviada',
    uploadLeftOutTitle: 'Ficam de fora',
    uploadLeftOutBody:
      'Um livro guarda músicas, repertórios, um README e .gitattributes, então estes ficam de fora.',
    uploadCanonTitle: 'Posto em forma canônica',
    uploadCanonBody: 'As posições são postas em ordem canônica; a grade fica como foi escrita.',
    uploadMarkersTitle: 'Uma mesclagem inacabada no histórico',
    uploadMarkersBody:
      'O commit {commit} deixou marcas de conflito em {path}. Resolva no computador e envie de novo.',
    uploadMarkersLatest: 'Importar a versão mais recente sem o histórico',
    uploadConfirmCaption: 'Nada é escrito até você confirmar.',
    uploadConflictCaption: 'O conflito vai para a resolução.',
    uploadConfirmNew: 'Importar como livro novo',
    uploadConfirmMerge: 'Mesclar e salvar',
    uploadBadZip: 'Não foi possível ler esse arquivo como um zip de livro.',
    uploadFailed: 'Não foi possível concluir a importação. Nada foi escrito.',
    cancel: 'Cancelar',
    save: 'Salvar',
    onDevice: 'Neste dispositivo',
    onEstante: 'No Estante',
    canSave: 'pode salvar',
    reader: 'leitor',
    renameLabel: 'Renomear {name}',
    renameTitle: 'Renomear “{name}”',
    renameField: 'Nome na sua estante',
    empty: 'Nenhum livro ainda. Adicione um livro para começar.',
    syncing: 'sincronizando',
    savesWaiting: {
      one: '{count} alteração aguardando para subir',
      other: '{count} alterações aguardando para subir',
    },
    needsYou: 'precisa de você',
    offline: 'offline desde {time}',
    offlineUnknown: 'offline',
    noLongerShared: 'não compartilhado mais com você',
    // books.fork (workflow 11): as linhas de cópia própria na estante.
    cannotSaveHere: 'não dá para salvar aqui',
    fromOriginal: 'de {original}',
    originalNewSaves: {
      one: '{original} tem {count} alteração nova.',
      other: '{original} tem {count} alterações novas.',
    },
    originalNoLongerShared: 'original não compartilhado mais',
    bringIn: 'Trazer para cá',
    bringInLabel: 'Trazer para cá as alterações de {original}',
    bringInTitle: 'Trazer as alterações de {original}',
    bringInBody: {
      one: '{count} alteração nova em {original} desde a última vez que você as trouxe. Nada é gravado em {book} até você confirmar.',
      other: '{count} alterações novas em {original} desde a última vez que você as trouxe. Nada é gravado em {book} até você confirmar.',
    },
    bringInFetching: 'Buscando as alterações novas de {original}…',
    bringInNote: 'Nota',
    bringInNotePrefill: 'Traz as alterações de {original}: {titles}',
    bringInNotePrefillEmpty: 'Traz as alterações de {original}',
    bringInConflict: {
      one: '{songs} encontra edições suas. Depois de confirmar, você resolve um conflito por vez; o resto entra de uma vez.',
      other: '{songs} encontram edições suas. Depois de confirmar, você resolve um conflito por vez; o resto entra de uma vez.',
    },
    bringInCaption: 'Junta na sua cópia, salva e envia para a Estante.',
    bringInNotNow: 'Agora não',
    bringInBusy: 'Trazendo as alterações…',
    bringInStale: 'Algo mudou desde esta prévia, então ela foi refeita. Confira e depois traga as alterações.',
    bringInOffline: 'Trazer as alterações precisa da rede. Nada mudou: conecte e tente de novo.',
    originalGoneTitle: 'O original não é mais compartilhado com você.',
    originalGoneBody:
      'Este livro deixa de seguir {original}; as alterações foram trazidas pela última vez em {date}. Nada mais muda: sua cópia, o histórico e as músicas estão todos aqui, e você salva, compartilha e sincroniza como antes.',
    originalGoneBodyUndated:
      'Este livro deixa de seguir {original}. Nada mais muda: sua cópia, o histórico e as músicas estão todos aqui, e você salva, compartilha e sincroniza como antes.',
    forkedNote:
      '{book} agora é seu: ocupou o lugar do original na sua estante, então cada música aparece uma vez na busca.',
    syncNow: 'Sincronizar agora',
    notInStep: 'Alguns livros não estão em dia',
    // A estante enchendo num dispositivo novo (account.new_device, workflow 13).
    restoredTitle: 'Livro de casa restaurado.',
    restoredBody: 'Seu instrumento, notação e idioma estão configurados.',
    restoredDismiss: 'Dispensar',
    restoredDismissLabel: 'Dispensar o aviso do livro de casa',
    yourShelf: 'Sua estante',
    yourShelfCount: { one: '{count} livro', other: '{count} livros' },
    fillReady: 'pronto',
    fillCloning: 'baixando {percent}%',
    fillWaiting: 'aguardando',
    fillReadyMeta: { one: '{count} música · pesquisável', other: '{count} músicas · pesquisáveis' },
    fillCloningMeta: 'músicas pesquisáveis à medida que chegam',
    fillWaitingMeta: 'o próximo da fila',
    fillProgressLabel: 'Trazendo {name} para este dispositivo',
    onlyOn: 'Só no seu {device}: {title}',
    onlyOnOther: 'Só em outro dispositivo: {title}',
    onlyOnHelp: 'Coloque-o online lá para tê-lo aqui.',
    // O detalhe de cada livro (books.online, workflow 7 L46-63, L128-137; W07).
    detailBack: 'Voltar aos livros',
    pickBook: 'Escolha um livro para ver os detalhes.',
    private: 'privado',
    sharedBy: 'compartilhado por {owner}',
    shared: 'compartilhado',
    youOwn: 'Você é o dono',
    youCanSave: 'Você pode salvar',
    readOnly: 'Somente leitura',
    putOnline: 'Colocar online',
    putOnlineBody:
      'Só neste dispositivo. Colocá-lo online cria o livro no Estante, privado: só você pode abri-lo, até você convidar pessoas, no máximo 50.',
    putOnlineQuota: 'Sua conta está cheia. Remova um livro ou libere espaço e tente de novo.',
    putOnlineSignedOut: 'Entre na sua conta para colocar um livro online.',
    putOnlineOffline: 'Você está offline. Conecte-se e coloque o livro online.',
    putOnlineError: 'Não foi possível colocar online. Tente de novo.',
    lostAccessTitle: 'Não é mais compartilhado com você',
    lostAccessBody:
      'Este livro não é mais compartilhado com você, então não será mais sincronizado. Nada se perde: sua cópia, o histórico e as músicas estão todos aqui para ler, e as gravações que ainda não foram para a Estante ficam neste dispositivo. Baixe-o, ou torne-o seu para continuar salvando.',
    takenDownTitle: 'Este livro foi retirado',
    download: 'Baixar',
    downloadBody:
      'Um zip do repositório como está neste dispositivo: todo o histórico e as alterações não salvas como arquivos modificados. Qualquer ferramenta git abre.',
    remove: 'Remover da minha estante',
    removeBody: 'Apaga só a cópia deste dispositivo. O livro continua no Estante.',
    removeTitle: 'Remover “{name}” deste dispositivo?',
    removeLoss: {
      one: 'Este dispositivo tem {count} alteração ainda não enviada ao Estante; remover esta cópia a perde. O livro continua no Estante.',
      other:
        'Este dispositivo tem {count} alterações ainda não enviadas ao Estante; remover esta cópia as perde. O livro continua no Estante.',
    },
    removeUnsaved: {
      one: '{count} música com alterações não salvas será perdida',
      other: '{count} músicas com alterações não salvas serão perdidas',
    },
    removeGone:
      'Este livro está só neste dispositivo. Removê-lo o apaga para sempre — não há cópia no Estante. Baixe-o primeiro para guardar uma cópia.',
    removeConfirm: 'Remover da minha estante',
    delete: 'Excluir o livro',
    deleteBody: 'Exclui o livro do Estante, para todo mundo. Só o dono pode.',
    deleteTitle: 'Excluir {name} do Estante?',
    deleteModalBody:
      'Isto exclui o livro, com todo o histórico, para todos que o compartilham. Não dá para desfazer.',
    deleteField: 'Digite o nome do livro para confirmar',
    deleteConfirm: 'Excluir o livro',
    // Leaving one shared book (books.leave; workflow 10 §Leaving a book; Leave-book board).
    leave: 'Sair deste livro',
    leaveBody: 'Deixe de acompanhá-lo em todos os seus dispositivos.',
    leaveOffline: 'Sair precisa de conexão.',
    leaveOfflineBody: 'Nada mudou; você continua sendo membro.',
    leaveTitle: 'Sair de {name}?',
    leaveSentence: 'Você não poderá mais abri-lo nem sincronizá-lo, em nenhum dos seus dispositivos, e ele é removido deste. O dono pode convidar você de novo.',
    leaveSentenceRemote: 'Você não poderá mais abri-lo nem sincronizá-lo, em nenhum dos seus dispositivos. O dono pode convidar você de novo.',
    leaveSentenceNamed: 'Você não poderá mais abri-lo nem sincronizá-lo, em nenhum dos seus dispositivos, e ele é removido deste. {owner} pode convidar você de novo.',
    leaveSentenceRemoteNamed: 'Você não poderá mais abri-lo nem sincronizá-lo, em nenhum dos seus dispositivos. {owner} pode convidar você de novo.',
    leaveUnsaved: {
      one: '{count} música com alterações não salvas será perdida',
      other: '{count} músicas com alterações não salvas serão perdidas',
    },
    leaveUnpushed: {
      one: '{count} alteração salva não chegou ao livro e nunca chegará',
      other: '{count} alterações salvas não chegaram ao livro e nunca chegarão',
    },
    leaveUnpushedHelp: 'Torne-o seu para guardá-las como um livro seu, com o histórico; ou baixe o livro como está neste dispositivo.',
    leaveForkFirst: 'Tornar meu antes',
    leaveDownloadFirst: 'Baixar antes',
    leaveConfirm: 'Sair do livro',
    leaveFailed: 'Você não saiu de {name}. Você continua sendo membro.',
    share: 'Compartilhar',
    shareBody: 'Convide pessoas para ler ou editar este livro — até cinquenta.',
    shareBodyMember: 'Veja quem compartilha este livro com você, e quem salva nele.',
    // Os cartões de cópia própria no detalhe (books.fork, workflow 11).
    cannotSaveTitle: 'Não dá para salvar aqui',
    cannotSaveBody: {
      one: '{count} alteração não pode mais ir para {book}: você pode lê-lo, mas não salvar mais nele.',
      other: '{count} alterações não podem mais ir para {book}: você pode lê-lo, mas não salvar mais nele.',
    },
    fork: 'Fazer uma cópia',
    forkBody: 'Sua própria cópia de {book}, com o histórico, que continua acompanhando o original.',
  },

  sharing: {
    shareTitle: 'Compartilhar {name}',
    close: 'Fechar',
    back: 'Voltar',
    intro: 'Só quem você convida pode abrir este livro, cada um com a própria conta.',
    memberIntroReader:
      'Compartilhado com você por {owner}. Você pode ler este livro e mantê-lo na estante; para alterá-lo, torne-o seu. Só {owner} convida pessoas. Os outros leitores não aparecem na lista.',
    memberIntroEditor:
      'Compartilhado com você por {owner}. Você pode ler este livro e salvar nele. Só {owner} convida pessoas. Os outros leitores não aparecem na lista.',
    itsOwner: 'quem é dono dele',
    loading: 'Carregando…',
    retry: 'Tentar de novo',
    people: 'Pessoas',
    peopleTitle: '{book} · Pessoas',
    sharingTitle: '{book} · Compartilhamento',
    countOfLimit: '{count} de {limit}',
    peopleOfLimit: {
      one: '{count} de {limit} pessoas',
      other: '{count} de {limit} pessoas',
    },
    besidesYou: {
      one: 'além de você · espaço para mais {count}',
      other: 'além de você · espaço para mais {count}',
    },
    noRoomLeft: 'sem espaço',
    peopleExplainer: 'Só as pessoas desta lista podem abrir {book}. Quando chegar a 50, os convites param de deixar alguém entrar.',
    roomForMore: {
      one: 'Espaço para mais {count}.',
      other: 'Espaço para mais {count}.',
    },
    full: '{name} está cheio. Os convites não admitem mais ninguém; remova alguém para abrir espaço.',
    stateFull: 'Cheio',
    reviewMembers: 'Rever integrantes',
    members: 'Integrantes',
    invitations: 'Convites',
    you: 'Você',
    youNamed: '{name} (você)',
    unnamedOwner: 'Quem é dono do livro',
    unnamedEditor: 'Editor sem nome',
    unnamedReader: 'Leitor sem nome',
    someoneUnnamed: 'Alguém sem nome',
    nobodyYet: 'Ninguém ainda',
    editorsCount: {
      one: '{count} editor',
      other: '{count} editores',
    },
    readersCount: {
      one: '{count} leitor',
      other: '{count} leitores',
    },
    invitationsCount: {
      one: '{count} convite',
      other: '{count} convites',
    },
    ownerMeta: 'é dono deste livro',
    sharesMeta: 'compartilha este livro',
    editorMeta: 'salva neste livro',
    readerMeta: 'lê este livro',
    throughReader: 'pelo convite de leitor de {date}',
    throughEditor: 'pelo convite de editor de {date}',
    showMoreReaders: {
      one: 'Mostrar mais {count} leitor',
      other: 'Mostrar mais {count} leitores',
    },
    showFewerReaders: 'Mostrar menos leitores',
    roleOwner: 'Dono',
    roleEditor: 'Editor',
    roleReader: 'Leitor',
    changeRole: 'Mudar o papel de {name}',
    changeRoleEditor: 'Mudar o papel deste editor',
    changeRoleReader: 'Mudar o papel deste leitor',
    makeEditor: 'Tornar editor',
    makeReader: 'Tornar leitor',
    remove: 'Remover',
    removeTitle: 'Remover {name}?',
    removeTitleEditor: 'Remover este editor?',
    removeTitleReader: 'Remover este leitor?',
    thisPerson: 'Esta pessoa',
    removeJoinedReader: '{name} entrou pelo seu convite de leitor de {date}.',
    removeJoinedEditor: '{name} entrou pelo seu convite de editor de {date}.',
    removeEffect:
      'A remoção vale a partir da próxima vez que o aplicativo dessa pessoa alcançar a Estante; os outros integrantes não são afetados.',
    removeStays: {
      one: 'O que já está no aparelho dessa pessoa continua lá. Não pode ser recolhido. O livro terá espaço para mais {count}.',
      other: 'O que já está no aparelho dessa pessoa continua lá. Não pode ser recolhido. O livro terá espaço para mais {count}.',
    },
    removeConfirm: 'Remover {name}',
    removeConfirmUnnamed: 'Remover',
    cancel: 'Cancelar',
    invitePeople: 'Convidar pessoas',
    newInvitation: 'Novo convite',
    songInvite: 'Convidar alguém para esta música',
    inviteIntro:
      'Um link, para quantas pessoas você quiser enviar. Cada uma entra, ou cria uma conta, e o livro vai para a estante dela.',
    songShareIntro:
      'Uma música é compartilhada com o livro dela, {book}. Só quem você convida pode abri-la, cada um com a própria conta.',
    songInviteBody: 'O convite leva a pessoa para {book} e abre em {song} assim que ela entrar.',
    role: 'Papel',
    roleHelp: 'Leitores leem o livro e o mantêm na estante. Editores também salvam nele.',
    expires: 'Expira',
    expiryDay: 'Um dia',
    expiryWeek: 'Uma semana',
    expiryMonth: 'Um mês',
    expiryUntilWithdrawn: 'Até ser retirado',
    limitToggle: 'Limitar quantas pessoas podem usar',
    limitHelp: 'Opcional. Defina 1 para uma pessoa só.',
    limitField: 'Número de usos',
    change: 'Alterar',
    changeTerms: 'Alterar a validade e os usos',
    roomCallout: {
      one: '{book} tem espaço para mais {count} pessoa. Quando chegar a 50, este link para de deixar alguém entrar.',
      other: '{book} tem espaço para mais {count} pessoas. Quando chegar a 50, este link para de deixar alguém entrar.',
    },
    fullCallout: '{book} está cheio. Este link não deixa ninguém entrar até você remover alguém.',
    seeWhoJoins: 'Você vai ver quem entra por ele, e pode retirá-lo a qualquer momento.',
    createLink: 'Criar link',
    linkReady: 'Aqui está o link. Envie como quiser; dá para copiá-lo de novo enquanto ele ainda deixar alguém entrar.',
    linkLabel: 'Link do convite',
    copy: 'Copiar',
    copyLink: 'Copiar link',
    copied: 'Copiado',
    couldNotCopy: 'Não deu para copiar',
    copyByHand: 'Selecione o link e copie.',
    done: 'Pronto',
    inviteRowTitle: 'Convite de {role}',
    stateOpen: 'aberto',
    stateWithdrawn: 'retirado',
    stateUsedUp: 'esgotado',
    stateExpired: 'expirado',
    openUntil: 'aberto até {date}',
    usesUsed: {
      one: '{count} uso, usado',
      other: '{count} usos, usados',
    },
    nobodyJoined: 'ninguém entrou ainda',
    nameJoined: '{name} entrou',
    countJoined: {
      one: '{count} entrou',
      other: '{count} entraram',
    },
    termsDay: 'Expira em um dia',
    termsWeek: 'Expira em uma semana',
    termsMonth: 'Expira em um mês',
    termsUntilWithdrawn: 'Até ser retirado',
    usesNoLimit: 'sem limite de usos',
    usesLeft: {
      one: '{count} uso restante',
      other: '{count} usos restantes',
    },
    withdraw: 'Retirar',
    withdrawNote:
      'Retirar um convite impede que novas pessoas entrem por ele. Quem já entrou continua integrante.',
    joinedThrough: 'Entraram por ele:',
    joinedPeople: {
      one: '{count} pessoa: {names}',
      other: '{count} pessoas: {names}',
    },
    namesAndMore: {
      one: '{names} e mais {count}',
      other: '{names} e mais {count}',
    },
    joinedNobody: 'ninguém ainda',
    noInvitations: 'Nenhum convite ainda.',
    songForMembers: 'Para quem já está no livro',
    songForMembersBody: 'Os integrantes abrem {name} no endereço dela.',
    songAddressLabel: 'Endereço da música',
    manage: 'Gerenciar',
    seePeople: 'Ver quem',
    youAreEditor: 'Você é editor',
    youAreReader: 'Você é leitor',
    errNetwork: 'Você está offline, ou a Estante está fora do ar. Conecte e tente de novo.',
    errForbidden: 'Só o dono pode fazer isso.',
    errNotFound: 'Este livro não está disponível.',
    errGeneric: 'Algo deu errado. Tente de novo.',
  },

  search: {
    label: 'Buscar músicas, palavras e acordes',
    placeholder: 'Músicas, palavras, acordes…',
    clearQuery: 'Limpar busca',
    clearFilter: 'Limpar filtro',
    scopeToBook: 'Buscar só em {book}',
    instrument: 'instrumento',
    explore: 'Explorar {query} no seu {instrument}',
    exploreMeta: 'todos os jeitos de tocar, do mais fácil ao mais difícil',
    matching: 'Músicas com “{query}”',
    recent: 'Recentes',
    books: 'Livros',
    empty: 'Nenhuma música corresponde a “{query}”.',
    songCount: { one: '{count} música', other: '{count} músicas' },
    stillLoading: 'ainda carregando',
    voicedFor: 'com posições para {instrument}',
    unsaved: 'não salvo',
    conflict: 'conflito',
    where: '{book} · {folder}/',
    addToSetlist: 'Adicionar {title} a um repertório',
    setlist: 'Repertório',
  },

  setlists: {
    title: 'Repertórios',
    empty: 'Nenhum repertório ainda. Adicione uma música a um repertório pela busca ou pela tela de leitura.',
    loading: 'Carregando repertórios…',
    songCount: { one: '{count} música', other: '{count} músicas' },
    back: 'Voltar',
    play: 'Tocar',
    edit: 'Editar',
    more: 'Mais',
    done: 'Concluído',
    inKey: 'em {key}',
    missing: 'faltando',
    missingNotice: '{title} está faltando.',
    missingDetail: 'Não há mais nada em {path}, então é pulada ao tocar.',
    pointItAtASong: 'Apontar para uma música',
    addSong: 'Adicionar música',
    save: 'Salvar',
    saveMessage: 'Editar repertório',
    discard: 'Descartar',
    unsaved: 'alterações não salvas',
    songsLabel: 'Músicas · arraste para reordenar',
    keyNoteHint: 'O tom e a nota valem só neste repertório',
    dragToReorder: 'Arraste para reordenar',
    removeFromSetlist: 'Remover {title} do repertório',
    keyLabel: 'Tom de {title}',
    keyPlaceholder: 'Tom',
    noteLabel: 'Nota de {title}',
    notePlaceholder: 'Nota',
    notInBook: '{path} não está no livro',
    pointHereTitle: 'Apontar para uma música em {book}',
    searchLabel: 'Buscar uma música',
    cancel: 'Cancelar',
    pointHere: 'Apontar aqui',
    noResults: 'Nenhuma música encontrada.',
    relativeNote: 'Os links são relativos a {folder}, então o arquivo abre as músicas em qualquer host git.',
    addToSetlistTitle: 'Adicionar ao repertório',
    newSetlist: 'Novo repertório…',
    pickerMeta: '{book} · {count}',
    copyNotice: 'Esta música será copiada para {book} primeiro.',
    copyDetail: '{title} está em {other}, e um repertório aponta só para músicas do próprio livro.',
    copyThenUnsaved: 'A cópia e a alteração do repertório ficam como alterações não salvas em {book}, salvas como qualquer outra.',
    thenUnsaved: 'A alteração do repertório fica como alteração não salva em {book}, salva como qualquer outra.',
    add: 'Adicionar',
    copyAndAdd: 'Copiar e adicionar',
    newSetlistTitle: 'Novo repertório',
    newSetlistNameLabel: 'Nome do repertório',
    newSetlistNamePlaceholder: 'Nome do repertório',
    create: 'Criar',
  },

  play: {
    stop: 'Parar de tocar',
    previous: 'Música anterior',
    next: 'Próxima música',
    position: '{i} de {n}',
    positionAwake: '{i} de {n} · tela sempre ligada',
    inKey: 'Em {key}',
    setlistKey: 'Tom do repertório {key} · escrita em {songKey}',
    setlistKeyNote: 'Tom do repertório {key}',
    nextHeading: 'Próxima',
    nextItem: '{number}. {title}',
    note: 'Observação: {note}',
    hint: 'Deslize, toque numa borda ou use um pedal',
    announce: '{title}, {i} de {n}',
    announceNext: 'Próxima: {title}',
    empty: 'Este repertório ainda não tem músicas para tocar.',
  },

  explorer: {
    title: 'Explorar um acorde',
    back: 'Voltar à busca',
    chord: 'Acorde',
    unreadable: '“{text}” não é um acorde que o app consiga ler.',
    group: {
      open: 'Solto',
      fret: 'Casa {position}',
      count: { one: '{count} forma', other: '{count} formas' },
    },
    showMore: 'Mostrar mais {count}',
    showFewer: 'Mostrar menos',
    star: 'Favoritar {chord}, {shorthand} como sua forma',
    unstar: 'Sua forma de {chord}, {shorthand} — desfavoritar',
    notice: {
      readAs: 'Lido como {chord} — {reading}.',
      flip: 'Ler como {chord}?',
      about: {
        sevenPlus:
          'Na notação brasileira 7+ é a sétima maior; no americano e no Real Book é a quinta aumentada.',
        bareNine:
          'Na notação brasileira um 9 sozinho acrescenta a nona sem sétima; no americano e no Real Book inclui a sétima menor.',
        degreeSign:
          'Um ° sozinho é lido como a sétima diminuta; a tríade pura é a outra leitura.',
        sevenFour:
          'Na notação brasileira 7(4) suspende a terça; no americano e no Real Book acrescenta a quarta acima dela.',
      },
    },
    empty: {
      title: 'Nenhuma forma cabe nas regras',
      body:
        '{chord} pede mais notas do que {instrument} pode soar com suas regras de execução. A busca não afrouxou as regras para forçar uma.',
      rules: 'Regras de execução',
      hint: 'Permita notas omitidas lá, ou tente um acorde mais simples.',
    },
    enter: {
      name: 'Inserir uma forma',
      meta: 'posicione os dedos à mão e favorite',
      title: 'Inserir uma forma',
      help: 'Toque uma casa para pôr um dedo, toque de novo para tirar. Toque a pestana para soltar ou abafar a corda.',
      nut: 'Soltar ou abafar a corda {n}',
      muteString: 'Abafar a corda {n}',
      openString: 'Soltar a corda {n}',
      setFret: 'Corda {n}, casa {fret}',
      readout: 'O que soa',
      muted: 'Corda {n}: abafada',
      openNote: 'Corda {n}: solta, {note}',
      frettedNote: 'Corda {n}: casa {fret}, {note}',
      foreign: 'fora do acorde',
      unplayable: 'Esta forma não pode ser tocada como está, mas é mantida como desenhada.',
      star: 'Favoritar esta forma',
      cancel: 'Cancelar',
    },
  },

  // Um dispositivo novo (account.new_device, workflow 13).
  newDevice: {
    kind: {
      iphone: 'iPhone',
      ipad: 'iPad',
      'android-phone': 'celular Android',
      'android-tablet': 'tablet Android',
      mac: 'Mac',
      windows: 'computador Windows',
      linux: 'computador Linux',
      chromebook: 'Chromebook',
    },
    thisKind: {
      iphone: 'Este iPhone',
      ipad: 'Este iPad',
      'android-phone': 'Este celular',
      'android-tablet': 'Este tablet',
      mac: 'Este Mac',
      windows: 'Este computador',
      linux: 'Este computador',
      chromebook: 'Este Chromebook',
      other: 'Este dispositivo',
    },
    notation: {
      brazilian: 'Notação brasileira',
      american: 'Notação americana',
      realbook: 'Notação Real Book',
    },
    title: 'Suas duas Minhas músicas',
    later: 'Depois',
    merged: '{device}: as preferências e os formatos foram unidos aos da sua conta, ajuste por ajuste.',
    heading: '{device} tem as próprias Minhas músicas',
    body: 'Sua conta também tem Minhas músicas. Junte as duas ou mantenha-as separadas.',
    merge: 'Juntar',
    mergeBody: '{device}: as músicas vão para as Minhas músicas da sua conta. Primeiro uma prévia, música por música.',
    mergeWaiting: 'As Minhas músicas da sua conta ainda estão chegando a este dispositivo.',
    keepBoth: 'Manter as duas',
    keepBothBody: 'Esta fica na estante como Minhas músicas (este dispositivo).',
    keepBothTitle: 'Minhas músicas (este dispositivo)',
    previewTitle: 'O que a junção faria',
    previewNote: 'Nada é gravado até você confirmar',
    previewLoading: 'Lendo as Minhas músicas deste dispositivo…',
    unrelated: 'As duas não têm histórico em comum, então cada música que está nas duas aparece como um conflito para escolher.',
    keepBothInstead: 'Manter as duas',
    mergeAndSave: 'Juntar e salvar',
    failed: 'Não foi possível preparar a junção. Nada foi gravado.',
  },

  // O estado inicial de estante vazia na porta de entrada da busca
  // (account.first_run, fluxo 1).
  firstRun: {
    heading: 'Sua estante está vazia',
    body: 'Um livro é uma coleção de músicas: suas, de um professor, da sua banda. A busca procura em todos os livros da sua estante.',
    writeSong: 'Escrever uma música',
    writeSongMeta: 'Vai para Minhas músicas',
    addByLink: 'Adicionar um livro pelo link',
    addByLinkMeta: 'De um professor ou de um colega de banda',
    signIn: 'Entrar',
    signInMeta: 'Traga sua estante de outro dispositivo',
    openExample: 'Abrir o livro de exemplo',
    openExampleMeta: 'Músicas que vêm com o app, postas na sua estante; remova quando quiser',
    mySongs: 'Minhas músicas',
    mySongsMeta: 'Nenhuma música ainda · suas, neste dispositivo',
    exampleLabel: 'Livro de exemplo',
  },

  // A porta do convite para um livro compartilhado (books.add_by_link, fluxo 1
  // §Convidado; mockup W01). Genérica antes de entrar — não nomeia o livro.
  // shell.routing — um endereço para algo que não está neste aparelho.
  notHere: {
    back: 'Voltar',
    brand: 'Estante',
    bookTitle: 'Este link não abre um livro',
    bookBody:
      'Ele não está neste aparelho. Se você foi convidado, peça a quem enviou um novo convite; se ele é seu na Estante, adicione-o em Livros.',
    goToBooks: 'Ir para Livros',
    songTitle: 'Esta música não está em {book}',
    setlistTitle: 'Este repertório não está em {book}',
    itemBody: 'Ela pode ter sido renomeada, movida ou apagada.',
    openBook: 'Abrir as músicas de {book}',
  },
  invited: {
    brand: 'Estante',
    close: 'Fechar',
    working: 'Abrindo…',
    workingHeading: 'Abrindo o convite',
    promptHeading: 'Você foi convidado para um livro na Estante',
    promptBody:
      'Para abri-lo, entre ou crie uma conta primeiro — nenhum livro pode ser lido sem uma.',
    passkeyTitle: 'Uma conta é uma chave de acesso',
    passkeyBody: 'Sem senha para escolher. Seu telefone a cria, em segundos.',
    makeAccount: 'Criar uma conta',
    signIn: 'Já tenho conta: entrar',
    promptFooter: 'Então o livro vai para a sua estante e abre nas suas músicas.',
    deadTitle: 'Este link não abre um livro',
    deadBody:
      'O convite pode ter expirado ou sido retirado, ou esta conta não está no livro. Peça um novo a quem o enviou.',
    addByLink: 'Adicionar um livro pelo link',
    fullTitle: 'Este livro está cheio',
    fullBody:
      'Ele atingiu o limite de pessoas, então o convite não pode admitir mais ninguém. Peça ao dono do livro para abrir espaço e abra o link de novo.',
    errorTitle: 'Não foi possível abrir este link',
    errorBody:
      'Algo deu errado ao conectar à Estante. Verifique sua conexão e abra o link de novo.',
    ok: 'OK',
  },
  // A tela de entrada (account.sign_in, fluxos 7 e 13; mockup W13).
  signIn: {
    brand: 'Estante',
    close: 'Fechar',
    heading: 'Entrar',
    body: 'Traga seus livros, instrumentos e preferências para este telefone.',
    usePasskey: 'Usar uma chave de acesso',
    emailLink: 'Enviar um link por e-mail',
    note: 'Sem chave de acesso aqui? O link entra neste telefone e recupera sua conta se todos os dispositivos com uma chave de acesso forem perdidos.',
    emailHeading: 'Enviar um link por e-mail',
    emailBody: 'Enviaremos um link de acesso para o seu e-mail. Abra-o neste dispositivo para entrar.',
    emailLabel: 'Seu e-mail',
    emailSend: 'Enviar o link',
    usePasskeyInstead: 'Usar uma chave de acesso em vez disso',
    checkHeading: 'Verifique seu e-mail',
    checkBody: 'Se esse endereço tiver uma conta, um link de acesso está a caminho. Abra-o neste dispositivo para entrar.',
    checkBack: 'Voltar para entrar',
    redeeming: 'Entrando…',
    working: 'Processando…',
    offerHeading: 'Torne o acesso mais rápido',
    offerBody: 'Adicione uma chave de acesso a este dispositivo, para que da próxima vez seja um toque.',
    offerAdd: 'Adicionar uma chave de acesso',
    offerSkip: 'Agora não',
    errorPasskey: 'Essa chave de acesso não funcionou — tente de novo ou use um link por e-mail.',
    errorExpired: 'Este link expirou ou já foi usado — solicite um novo.',
    errorOffline: 'Não foi possível acessar o Estante. Verifique sua conexão e tente de novo.',
    requestNewLink: 'Solicitar um novo link',
  },

  account: {
    open: 'Conta',
    title: 'Conta',
    back: 'Voltar',
    preferences: 'Preferências',
    theme: 'Tema',
    language: 'Idioma',
    themeAutomatic: 'Automático',
    themeAutomaticMeta: 'Segue este dispositivo',
    themeEstante: 'Estante',
    themeEstanteMeta: 'Neutro, cifras azul-tinta',
    themeCaderno: 'Caderno',
    themeCadernoMeta: 'Papel, cifras à caneta vermelha, serifa',
    themePalco: 'Palco',
    themePalcoMeta: 'Palco escuro, âmbar, legível de longe',
    selected: 'Selecionado',
    themeNote:
      'O automático segue este dispositivo: claro → Estante, escuro → Palco. Escolher um tema com nome substitui isso. Sua escolha acompanha você em todos os dispositivos; o automático relê o modo claro ou escuro de cada um.',
    // Density and chord diagrams (shell.display_preferences).
    density: 'Densidade',
    densityCompact: 'Compacta',
    densityCompactMeta: 'Menor, mais à vista',
    densityCompactMetaLong: 'Espaçamento mais justo, cifra menor — mais da música à vista',
    densityComfortable: 'Confortável',
    densityComfortableMeta: 'O padrão',
    densityRoomy: 'Espaçosa',
    densityRoomyMeta: 'Maior, para ler de longe',
    densityRoomyMetaLong: 'Espaçamento mais folgado, cifra maior — para ler de mais longe',
    diagrams: 'Diagramas de acordes',
    diagramHand: 'Mão',
    diagramHandRight: 'Destro',
    diagramHandRightMeta: 'O padrão · corda mais grave à esquerda',
    diagramHandLeft: 'Canhoto',
    diagramHandLeftMeta: 'Espelhado · corda mais grave à direita',
    diagramNeck: 'Braço',
    diagramNeckVertical: 'Vertical',
    diagramNeckVerticalMeta: 'O padrão · a pestana no alto',
    diagramNeckHorizontal: 'Horizontal',
    diagramNeckHorizontalMeta: 'A pestana à esquerda, as casas para a direita',
    diagramsNote:
      'Muda como um formato é desenhado, nunca quais formatos são encontrados. Todos os diagramas seguem esta escolha.',
    languageNote: 'Usa o idioma do seu navegador até você escolher um.',
    notSignedIn: 'Sem sessão iniciada',
    notSignedInBody:
      'Estas preferências ficam salvas neste dispositivo agora. Entre para guardar seus livros e levar tema e idioma aos seus outros dispositivos.',
    usePasskey: 'Usar uma chave de acesso',
    emailLink: 'Enviar um link por e-mail',
    signedIn: 'Sessão iniciada',
    signedInStatus: 'Com sessão iniciada neste dispositivo',
    loading: 'Carregando…',
    retry: 'Tentar de novo',
    devices: 'Dispositivos com sessão',
    thisDevice: 'Este dispositivo',
    unknownDevice: 'Um dispositivo com sessão',
    inUseNow: '{device} · em uso agora',
    lastUsed: 'usado por último {time}',
    offlineManage:
      'Você está offline. Ainda pode encerrar a sessão deste dispositivo; seus outros dispositivos e chaves de acesso só poderão ser gerenciados quando você se reconectar.',
    signOut: 'Encerrar sessão',
    signOutLabel: 'Encerrar a sessão de {device}',
    signOutThis: 'Encerrar a sessão deste dispositivo',
    signOutTitle: 'Encerrar a sessão de {device}?',
    signOutBody:
      'Ele para de funcionar naquele dispositivo na próxima vez que acessar o Estante. Nada nele é removido.',
    signOutConfirm: 'Encerrar sessão',
    cancel: 'Cancelar',
    signOutThisTitle: 'Encerrar a sessão neste dispositivo?',
    signOutChoice: 'O que fazer com os livros desta conta neste dispositivo',
    signOutRemove: 'Remover os livros desta conta deste dispositivo',
    signOutRemoveMeta: 'Para um dispositivo emprestado ou compartilhado.',
    signOutKeep: 'Mantê-los aqui',
    signOutKeepMeta: 'Como livros locais, sem mais sincronizar.',
    signOutNotYet: 'Ainda não estão no Estante:',
    signOutUnsavedSongs: {
      one: '{title} · alterações não salvas em {count} música',
      other: '{title} · alterações não salvas em {count} músicas',
    },
    signOutUnpushed: {
      one: '{title} · {count} gravação ainda não enviada',
      other: '{title} · {count} gravações ainda não enviadas',
    },
    signOutOnlyHere: '{title} só existe neste dispositivo. Baixe antes de remover.',
    signOutDownload: 'Baixar',
    signOutDownloadLabel: 'Baixar {title}',
    signOutConfirmRemove: 'Encerrar sessão e remover',
    signOutConfirmKeep: 'Encerrar sessão e manter',
    signOutLeftOffline:
      'Sessão encerrada neste dispositivo. O Estante encerrará a sessão quando este dispositivo se reconectar.',
    passkeys: 'Chaves de acesso',
    passkeyUnnamed: 'Chave de acesso',
    passkeyAdded: 'Adicionada em {date}',
    addPasskey: 'Adicionar uma chave de acesso a este dispositivo',
    removePasskey: 'Remover',
    removePasskeyLabel: 'Remover {name}',
    removePasskeyTitle: 'Remover {name}?',
    removePasskeyBody:
      'Esta chave de acesso deixará de iniciar sua sessão. Suas outras chaves continuam funcionando; você pode adicionar outra quando quiser.',
    removePasskeyConfirm: 'Remover',
    leaving: 'Saindo do Estante',
    leavingBody: 'Faça uma cópia de tudo o que você guarda aqui e então encerre sua conta, se quiser.',
    leaveTakeData: 'Exportar seus dados',
    leaveDelete: 'Excluir minha conta',
    leaveTakeTitle: 'Exportar seus dados',
    leaveOffline: 'Offline',
    leaveOfflineNote:
      'Seus livros estão neste dispositivo, então os downloads funcionam aqui. Excluir sua conta exige conexão.',
    leaveDataBody:
      'Cada livro é salvo como está neste dispositivo — todo o histórico e suas alterações não salvas — igual ao que Baixar faz em qualquer livro.',
    leaveDownloadAll: 'Baixar tudo',
    leaveDownload: 'Baixar',
    leaveDownloadLabel: 'Baixar {title}',
    leaveHomeBook: 'Seu livro pessoal',
    leaveClose: 'Concluído',
    leaveTitle: 'Excluir sua conta?',
    leaveWhen: 'Ao excluir sua conta:',
    leaveWillAccount: 'Sua conta, todas as sessões e todas as chaves de acesso são removidas.',
    leaveWillBooks: 'Os livros que você possui são excluídos para todos que os compartilham.',
    leaveWillAccess: 'Seu acesso aos livros de outras pessoas termina.',
    leaveWillDevice: 'Seus livros e seu livro pessoal são removidos deste dispositivo.',
    leaveOwnHead: 'Livros que você possui — excluídos para todos:',
    leaveSharedWith: {
      one: '{title} · compartilhado com {count} pessoa — ela perderá o acesso',
      other: '{title} · compartilhado com {count} pessoas — elas perderão o acesso',
    },
    leaveOnlyYou: '{title} · só você — excluído',
    leaveLocalHead: 'Só neste dispositivo — exporte antes:',
    leaveTakeFirst: 'Exportar seus dados primeiro',
    leaveConfirmLabel: 'Digite seu endereço de e-mail para confirmar:',
    leaveMismatch: 'Esse não é o e-mail desta conta. Verifique e tente de novo.',
    leaveNeedsConnection: 'Precisa de conexão — disponível quando você estiver online de novo.',
    leaveCannotUndo: 'Isso não pode ser desfeito.',
    errNetwork: 'Você está offline, ou o Estante está inacessível. Conecte-se e tente de novo.',
    errGeneric: 'Algo deu errado. Tente de novo.',
    // The Recovery email region, the last way in, and the passkey-confirmed
    // delete (account.recovery_email; workflow 13, workflow 17).
    recoveryHeading: 'E-mail de recuperação',
    recoveryNone: 'Sem e-mail de recuperação',
    recoveryNoneWarn: 'Se você perder todos os dispositivos com uma chave de acesso, não há como entrar de novo.',
    recoveryLabel: 'E-mail de recuperação',
    recoveryHint: 'Usado só para enviar a você um link de entrada. Mostrado aqui, a você, e em nenhum outro lugar.',
    recoverySend: 'Enviar um link de verificação',
    recoveryWaiting: 'Esperando você confirmar',
    recoverySent: 'Enviamos um link de verificação para {address}. Confira sua caixa de entrada e abra-o.',
    recoveryOnceNone: 'O link funciona uma vez, por quinze minutos. Até ser aberto, nada muda e a conta continua sem e-mail de recuperação.',
    recoveryOnceKept: 'O link funciona uma vez, por quinze minutos. Até ser aberto, nada muda e {address} continua sendo seu e-mail de recuperação.',
    recoverySendAgain: 'Enviar de novo',
    recoveryDifferent: 'Usar outro endereço',
    recoveryConfirmed: 'Confirmado',
    recoveryConfirmedBody: 'Recebe um link de entrada quando você pedir um. Mostrado só a você.',
    recoveryChange: 'Trocar',
    recoveryChangeHint: 'Trocar mantém este endereço valendo até o novo ser confirmado; este endereço então recebe um breve aviso de que foi trocado.',
    recoveryInvalid: 'Isso não parece um endereço de e-mail.',
    recoveryOfflineHead: 'Quando offline',
    recoveryOffline: 'O e-mail de recuperação precisa de conexão, como entrar na conta. Os botões esperam até você voltar a ficar online; suas músicas não.',
    rateLimited: 'Tentativas demais — tente de novo daqui a pouco.',
    lastWayIn: 'último acesso',
    lastWayInBody: 'Sua única forma de entrar — adicione um e-mail de recuperação ou outra chave de acesso antes.',
    leaveByPasskey: 'Esta conta não tem e-mail. Confirme com uma das suas chaves de acesso para excluí-la.',
    leaveNotConfirmed: 'Não excluída — a chave de acesso não foi confirmada.',
    leaveNotConfirmedBody: 'Nada mudou. Tente de novo quando estiver pronto.',
    leaveRefused: 'Essa chave de acesso não confirmou esta conta. Tente de novo.',
    leaveNowEmail: 'Esta conta agora tem um e-mail — digite-o para confirmar.',
  },

  // The recovery email's confirm page, opened by the emailed link
  // (account.recovery_email; workflow 13 §Confirming it).
  recoveryConfirm: {
    brand: 'Estante',
    heading: 'E-mail de recuperação',
    working: 'Confirmando seu e-mail de recuperação…',
    confirmed: 'Seu e-mail de recuperação está confirmado',
    body: 'Seu e-mail de recuperação agora é para onde o Estante envia um link de entrada se você perder todos os dispositivos com uma chave de acesso.',
    notice: 'Este link só confirma o endereço — não faz você entrar neste dispositivo e não abre nenhum livro.',
    expired: 'Este link expirou ou já foi usado — envie um novo pela tela da conta.',
    taken: 'Este endereço é o e-mail de recuperação de outra conta do Estante — entre com ele.',
    rateLimited: 'Tentativas demais — tente de novo daqui a pouco.',
    errNetwork: 'Você está offline, ou o Estante está inacessível. Conecte-se e tente de novo.',
    retry: 'Tentar de novo',
    open: 'Abrir o Estante',
  },

  newSong: {
    create: 'Criar “{query}”',
    createMeta: 'Uma nova música em {book}',
    inThisBook: 'Nova música em {book}',
    inBook: 'Em {book}',
    changeable: 'pode mudar até o primeiro salvamento',
    changeBook: 'Mudar de livro',
    back: 'Voltar',
    unsaved: 'não salvo',
    untitled: 'Música sem título',
    notationNote:
      'A notação vem da sua preferência, então a música é lida igual por todo mundo.',
  },

  // A folha de tornar o livro seu (books.fork, workflow 11; W11 #1).
  fork: {
    title: '{book} é de outra pessoa — torná-lo seu?',
    body: 'Você pode ler {book}, mas não salvar nele. Torná-lo seu te dá:',
    pointCopy: 'Sua própria cópia do livro, com todo o histórico. Suas edições vão para ela e são salvas lá.',
    pointFollow: 'Ela continua acompanhando {book}: quando houver alterações novas, você escolhe quando trazê-las.',
    pointShelf: 'Ela ocupa o lugar de {book} na sua estante, então nada aparece duas vezes.',
    smallPrint: 'Sua cópia fica no Estante, privada para você. Você pode compartilhá-la, com seu próprio limite de 50 pessoas.',
    confirm: 'Tornar meu',
    notNow: 'Agora não',
    busy: 'Tornando seu…',
    offline: 'Tornar o livro seu precisa de rede. Nada mudou: conecte-se e tente de novo.',
    quota: 'Isso passaria do seu limite no Estante.',
    signedOut: 'Entre para tornar o livro seu.',
    error: 'Não foi possível torná-lo seu. Nada mudou: tente de novo.',
  },

  saveSheet: {
    title: 'Salvar {title}',
    titleAll: { one: 'Salvar {count} música', other: 'Salvar {count} músicas' },
    whatChanged: 'O que mudou',
    note: 'Nota',
    pushCaption:
      'Salvar compartilha esta versão com quem compartilha o livro; sem rede, na próxima sincronização.',
    cancel: 'Cancelar',
    save: 'Salvar',
    close: 'Fechar',
    saveAll: 'Salvar tudo',
    saveAllLabel: 'Salvar todas as mudanças em {book}',
    songNameLabel: 'Dê um nome à música',
    songNameHelp: 'Usado como título e nome do arquivo.',
    nameLabel: 'Seu nome, como aparecerá no histórico de uma música',
    nameHelp: 'Perguntado uma vez. Depois de entrar, o nome da sua conta é oferecido no lugar.',
    refused: 'Não salvo. A linha {line} não pôde ser lida. Corrija no editor e salve de novo.',
    refusedMerge:
      'Não salvo. Resolva primeiro os conflitos deste livro — um save agora seria incorporado à mesclagem.',
    failed: 'Não salvo. Algo deu errado ao gravar neste dispositivo. Suas mudanças continuam aqui — salve de novo.',
    discardTitle: 'Descartar as mudanças em {title}?',
    discardBody: 'A música volta a como estava no último salvamento. Isto seria perdido:',
    keepEditing: 'Continuar editando',
    discard: 'Descartar mudanças',
    makeYourOwn: 'Tornar este livro seu',
    notNow: 'Agora não',
    change: {
      untitledSection: '(sem título)',
      titleWhere: 'Título',
      sectionsWhere: 'Seções',
      voicingsWhere: 'Voicings',
      sectionBar: '{section} compasso {bar}',
      added: '{value} adicionado',
      removed: '{value} removido',
      changed: '{before} → {after}',
      sectionAdded: 'seção adicionada',
      sectionRemoved: 'seção removida',
      sectionRenamed: 'renomeada para {name}',
      sectionReordered: 'reordenadas',
      wordsChanged: 'letra alterada',
      voicingBlockAdded: 'adicionados para {tuning}',
      voicingBlockRemoved: 'removidos para {tuning}',
      voicingAdded: 'para {tuning}: {chord} adicionado',
      voicingRemoved: 'para {tuning}: {chord} removido',
      voicingChanged: 'para {tuning}: {chord} alterado',
    },
  },

  history: {
    title: 'Histórico',
    newestFirst: '{book} · mais recentes primeiro',
    songInBook: '{title} · {book}',
    listLabel: 'Versões de {title}',
    you: 'você',
    unsaved: 'Não salvo, neste dispositivo',
    unsavedBadge: 'não salvo',
    unsavedChanges: 'alterações não salvas',
    mergedWithResolution: 'Mesclado, com a sua resolução',
    backToSong: 'Voltar à música',
    backToHistory: 'Voltar ao histórico',
    whatChanged: 'O que mudou em relação à versão anterior',
    whatChangedToNow: 'O que mudou desta versão para agora',
    songAsItWas: 'A música como estava',
    asItWasThen: '{title} como estava então',
    compareNow: 'Comparar com agora',
    compareBefore: 'Comparar com a versão anterior',
    restore: 'Restaurar esta versão',
    showText: 'Mostrar o texto',
    lineDiffCaption: 'a diferença de linhas de {file} em relação à versão anterior',
    empty: 'Ainda não há versões.',
    restoreTitle: 'Restaurar a versão de {date}?',
    restoreBody:
      '{title} tem alterações não salvas neste dispositivo. Restaurar substitui essas alterações, e isto seria perdido:',
    restoreCaption:
      'A versão inteira é restaurada. Ela fica então não salva, e salvá-la cria uma nova versão; nada no histórico é alterado.',
    keepChanges: 'Manter minhas alterações',
    loseAndRestore: 'Descartar e restaurar',
    restoreBlock: 'Restaurar este bloco',
    restoreBlockNamed: 'Restaurar este bloco: {block}',
    voicingBlock: 'Posições para {tuning}',
    restorePartTitle: 'Restaurar {block}?',
    restorePartBody:
      '{block} tem alterações não salvas neste dispositivo. Restaurar este bloco substitui essas alterações, e isto seria perdido:',
    restorePartCaption:
      'Só este bloco é restaurado; o resto da música fica como está. Ele fica então não salvo, e salvar cria uma nova versão; nada no histórico é alterado.',
    nothingToRestore: 'Restaurar este bloco não traz nada de volta.',
    noBlockRestore:
      'Esta versão é antiga demais para restaurar bloco a bloco. Você ainda pode restaurar a versão inteira.',
  },

  // O resolvedor de conflitos por música (sync.conflicts, workflow 9).
  songConflict: {
    back: 'Voltar',
    stepOf: 'Conflito {n} de {total}',
    prev: 'Conflito anterior',
    next: 'Próximo conflito',
    yours: 'Seu',
    theirs: 'de {author}',
    theirsFallback: 'Deles',
    chartTitle: '{section}',
    chartTitleFallback: 'Um compasso que vocês dois mudaram',
    // The bar or bars a chart conflict is in (sync.conflicts_editing; W09#1 L42).
    chartTitleBar: '{section}, compasso {bar}',
    chartTitleBars: '{section}, compassos {first} e {second}',
    chartTitleBarRange: '{section}, compassos {first}–{last}',
    chartBody: 'Você e {author} mudaram isto.',
    chartBodyFallback: 'Vocês dois mudaram isto.',
    voicingTitle: 'A forma de {chord}',
    voicingBody: '{tuning} · {variation}. Você e {author} escolheram formas diferentes.',
    voicingBodyFallback: '{tuning} · {variation}. Vocês escolheram formas diferentes.',
    mainVariation: 'variação principal',
    propertyTitle: 'O campo {key}',
    propertyBody: 'Você e {author} mudaram isto.',
    propertyBodyFallback: 'Vocês dois mudaram isto.',
    titleTitle: 'O título',
    titleBody: 'Você e {author} deram títulos diferentes.',
    titleBodyFallback: 'Vocês deram títulos diferentes.',
    genericTitle: 'Uma mudança que vocês dois fizeram',
    genericBody: 'Você e {author} mudaram isto.',
    genericBodyFallback: 'Vocês dois mudaram isto.',
    absent: '(removido)',
    keepMine: 'Ficar com o meu',
    takeTheirs: 'Ficar com o deles',
    keepBoth: 'Ficar com os dois',
    edit: 'Editar',
    readsAsYours:
      'Até você resolver, {title} aparece na sua versão, com os trechos em conflito marcados.',
    keepBothSongTitle: 'Duas músicas?',
    keepBothSongBody:
      'Mantenha a sua como está e salve a versão de {author} ao lado, como uma música própria, para quando vocês realmente fizeram duas músicas.',
    keepBothSongBodyFallback:
      'Mantenha a sua como está e salve a versão que chegou ao lado, como uma música própria, para quando duas pessoas realmente fizeram duas músicas.',
    keepBothSong: 'Ficar com as duas, como duas músicas',
    previewLabel: '{title}, sua versão',
    spoken: {
      chartLine: 'conflito na linha da cifra',
      line: 'conflito nesta linha',
    },
    settledSoFar: 'Resolvido até agora',
    settledMine: 'Ficou com o seu',
    settledTheirs: 'Ficou com o de {author}',
    settledKeepBoth: 'Ficou com os dois — o de {author} em uma variação',
    settledEdit: 'Texto editado',
    allSettled: 'Todos os conflitos de {title} estão resolvidos.',
    editTitle: 'Editar o texto de {title}',
    editHelp: 'Mantenha as linhas que quiser, de um lado ou dos dois, e apague as três linhas de marcação.',
    editTextLabel: 'O texto da música, com as marcações de conflito',
    editSave: 'Salvar',
    editCancel: 'Cancelar',
    editRefused:
      'Não salvo. A linha {line} ainda é uma marcação de conflito. Remova todas as linhas de marcação depois de escolher o que fica e salve de novo.',
    editGoToLine: 'Ir para a linha {line}',
    markersTitle: 'Lendo as marcações',
    markerStart: 'começa a sua versão',
    markerMid: 'termina a sua, começa a de {author}',
    markerEnd: 'termina a versão de {author}',
    // The labels on the marker lines in the edit view, named as the side cards
    // name the two versions (W09#3 L284-308).
    markerYours: 'seu',
    markerTheirs: 'de {author}',
    markerTheirsFallback: 'deles',
  },

  // O painel do livro pausado (sync.conflicts, workflow 9).
  bookConflicts: {
    needsYou: { one: '{count} música precisa de você.', other: '{count} músicas precisam de você.' },
    needsYouBody:
      'As últimas mudanças que chegaram e as suas mexeram nos mesmos lugares. Todo o resto já está aqui, e você pode ler e editar normalmente; este livro não recebe nada novo da sincronização até que isto seja resolvido.',
    inConflict: 'Em conflito',
    conflictsCount: { one: '{count} conflito', other: '{count} conflitos' },
    conflictBadge: 'conflito',
    settle: 'Resolver',
    settleSong: 'Resolver {title}',
    keepBothSong: 'Ficar com as duas',
    keepBothSongFor: 'Ficar com as duas versões de {title} como duas músicas',
    deletedBody: '{author} apagou esta música. Você a tinha editado.',
    keepSong: 'Manter a música, com as edições',
    deleteSong: 'Apagar',
    cameIn: 'Chegou, já está aqui',
    addedBy: 'adicionada por {author}',
    changedBy: 'atualizada por {author}',
    savingTitle: 'Salvar neste livro',
    savingBody: {
      one: 'Resolva a música primeiro. Um save agora seria incorporado à mesclagem.',
      other: 'Resolva as {count} músicas primeiro. Um save agora seria incorporado à mesclagem.',
    },
    savingSafe: 'Suas edições não salvas ficam como estão até lá.',
    notNowTitle: 'Agora não',
    notNowBody:
      'Os conflitos podem esperar o tempo que você quiser. Abandonar deixa o livro como estava antes desta sincronização; as mudanças que chegaram esperam para serem mescladas na próxima.',
    abandon: 'Abandonar a mesclagem',
  },

  fileView: {
    filesEntry: 'Arquivos',
    filesFor: 'Arquivos de {name}',
    title: 'Arquivos',
    titleIn: '{book} · Arquivos',
    back: 'Voltar',
    backToFiles: 'Voltar aos arquivos',
    backToHistory: 'Voltar ao histórico',
    historyTab: 'Histórico',
    filesTab: 'Arquivos',
    historyTitle: '{book} · Histórico',
    newSong: 'Nova música',
    tree: 'Arquivos de {book}',
    holds:
      'Um livro guarda músicas (*.cifra.md), repertórios (*.setlist.md), README.md e .gitattributes, e nada mais.',
    status: {
      unsaved: 'alterações não salvas',
      new: 'novo',
      deleted: 'excluído',
      conflict: 'conflito',
    },
    filesChanged: { one: '{count} arquivo alterado', other: '{count} arquivos alterados' },
    save: 'Salvar…',
    saveFiles: { one: 'Salvar {count} arquivo…', other: 'Salvar {count} arquivos…' },
    rename: 'Renomear',
    renameLabel: 'Renomear {name}',
    renameSong: 'Renomear música',
    renameSetlist: 'Renomear repertório',
    renameNameLabel: 'Nome, em {folder}/',
    renameNameLabelRoot: 'Nome',
    renameHintSong: 'Uma música mantém .cifra.md, então continua sendo música. O título dentro dela não muda.',
    renameHintSetlist: 'Um repertório mantém .setlist.md, então continua sendo repertório.',
    linkNotice: 'Os links para ela são atualizados no mesmo salvamento',
    linkItem: '{path} · item {item}',
    renameCancel: 'Cancelar',
    renameConfirm: 'Renomear',
    deleteLabel: 'Excluir {name}',
    deleteTitle: 'Excluir {name}?',
    deleteBody:
      'Ela sai do livro quando você salvar. Um repertório que aponta para ela mostrará um item ausente.',
    deleteCancel: 'Manter',
    deleteConfirm: 'Excluir',
    changesTitle: 'Alterações não salvas',
    changesCaption: 'Um salvamento, um commit',
    noChanges: 'Nada a salvar.',
    historyHeading: 'Histórico',
    merge: 'mesclagem',
    commits: 'Versões de {book}',
    commitFiles: { one: '{count} arquivo', other: '{count} arquivos' },
    commitMeta: '{author} · {date} · {hash} · {files}',
    restore: 'Restaurar esta versão',
    restoreCaption:
      'Restaurar escreve esse arquivo como ele estava após este commit na cópia de trabalho, para ser salvo como uma nova versão.',
    diffCaption: 'as diferenças de linha de {file} neste commit',
    emptyEditor: 'Escolha um arquivo para abri-lo.',
    emptyCommit: 'Escolha um commit para ver o que ele mudou.',
  },

  nav: {
    label: 'Seções',
    explore: 'Acordes',
    instrument: 'Instrumento',
    library: 'Salvos',
    sheets: 'Músicas',
    backup: 'Backup',
  },

  chip: {
    summary: 'Instrumento: {label}. Trocar de instrumento.',
    add: '+ Adicionar instrumento',
  },

  viewAs: {
    fromSheet: 'desta cifra',
    fromLink: 'do link',
    viewing: ' Vendo como {label} ({source})',
    back: 'Voltar para meu {label}',
    keep: 'Manter como padrão',
  },

  input: {
    label: 'Acorde',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Mostrar',
    readAs: ' “{text}” lido como {reading}. ',
    use: 'Usar {reading}',
    build: 'Montar o acorde',
    root: 'Fundamental',
    quality: 'Qualidade',
    seventh: 'Sétima',
    bass: 'Baixo',
    bassRoot: 'Fundamental',
    extensions: 'Extensões',
  },

  quality: {
    major: 'Maior',
    minor: 'Menor',
    dim: 'Diminuto',
    aug: 'Aumentado',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'Sem sétima',
    dominant: 'Sétima dominante',
    major: 'Sétima maior',
    diminished: 'Sétima diminuta',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'sétima maior',
      dominantSharpFive: 'sétima dominante com quinta aumentada',
    },
    bareNine: {
      add: 'nona adicionada, sem sétima',
      dominant: 'nona dominante, com a sétima menor',
    },
    degreeSign: {
      diminishedSeventh: 'sétima diminuta',
      diminishedTriad: 'tríade diminuta, sem sétima',
    },
    sevenFour: {
      suspendedFourth: 'quarta suspensa',
      addedFourth: 'quarta acrescentada',
    },
  },

  errors: {
    empty: 'Digite um acorde.',
    unexpected: 'Não esperava "{text}".',
    needsNumber: '"{text}" precisa vir seguido de um número.',
    bassNeeded: 'Depois de "/" vem uma nota de baixo ou um número.',
    badNote: 'Não entendi a nota: {text}',
    badPitch: 'Não entendi a altura: {text}',
    emptyTuning: 'Uma afinação precisa de pelo menos uma corda.',
    unknownQuality: 'Qualidade de acorde desconhecida: {quality}',
    badDegree: 'Grau de extensão inválido: {degree}',
    badAlteration: 'Alteração de extensão inválida: {alter}',
    unknownDialect: 'Sistema de cifra desconhecido: {dialect}',
    noRoot: '"{text}" não começa com o nome de uma nota.',
    badRoot: 'Não entendi a fundamental "{text}".',
    badBass: 'Não entendi a nota de baixo "{text}".',
    unreadable: 'Não entendi "{text}" em "{whole}".',
    noSheetInLink: 'Esse link não traz nenhuma cifra.',
    cannotDecompress: 'Este navegador não consegue ler links de cifra comprimidos.',
    unknownLinkFormat: 'Esse link não está num formato que o app entenda.',
    notASheet: 'Esse link não contém uma cifra.',
  },

  toggles: {
    label: 'Exibição do diagrama',
    neck: 'Vista do braço',
    left: 'Canhoto',
  },

  results: {
    announceNone: 'Nenhuma digitação encontrada.',
    announceCount: '{count} digitações em {positions} posições.',
    empty: 'Digite um acorde para ver como tocá-lo.',
    none: 'Nenhuma digitação para este acorde em {label}.',
    noneHelp:
      'Pode ser que ele precise de mais cordas do que o instrumento tem, ou que suas regras de voicing estejam rígidas demais.',
    adjustRules: 'Ajustar regras de voicing',
    save: ' Salvar',
    saved: ' Salvo',
    saveLabel: 'Salvar {shorthand} na sua biblioteca',
    removeLabel: 'Remover {shorthand} da sua biblioteca',
  },

  groups: {
    open: 'Posição aberta',
    fret: 'Casa {position}',
    list: 'Digitações: {position}',
    showFewer: 'Mostrar menos',
    showAll: 'Mostrar todas as {count}',
  },

  difficulty: { easy: 'fácil', medium: 'média', hard: 'difícil' },

  diagram: {
    open: 'posição aberta',
    startingAt: 'a partir da casa {position}',
    barre: 'pestana em {count} cordas na casa {fret}',
    fingers: 'dedos {fingers}',
    muted: { one: '{count} corda não tocada', other: '{count} cordas não tocadas' },
    rootOn: 'fundamental na {ordinal} corda',
    noRoot: 'sem fundamental',
    voicedAs: 'soa como {chord}',
    toPlay: 'dificuldade {difficulty}',
    yourShape: 'sua forma',
    default: 'padrão',
  },

  chart: {
    label: 'Cifra',
    spoken: {
      noChord: 'sem acorde',
      bar: 'compasso {n}:',
      needsYou: 'precisa de você',
      conflict: 'um conflito',
      endOfConflict: 'fim do conflito',
      default: 'padrão',
      endOfDefaults: 'fim dos padrões',
    },
  },

  chord: {
    spoken: {
      doubleFlat: 'dobrado bemol',
      flat: 'bemol',
      sharp: 'sustenido',
      doubleSharp: 'dobrado sustenido',
      minor: 'menor',
      major: 'maior',
      diminished: 'diminuto',
      augmented: 'aumentado',
      suspendedTwo: 'com segunda suspensa',
      suspendedFour: 'com quarta suspensa',
      fifth: 'quinta',
      over: 'sobre',
      add: 'com',
      footnote: 'nota de rodapé',
      interval: { 2: 'segunda', 4: 'quarta', 5: 'quinta', 6: 'sexta', 7: 'sétima', 9: 'nona', 11: 'décima primeira', 13: 'décima terceira' },
    },
  },

  reading: {
    back: 'Voltar',
    byline: '{artist} · {book}',
    keyOf: 'Tom de {key}',
    shapes: 'Formas',
    shapesInKey: 'Formas em {key}',
    shapesFor: 'Formas · {instrument}',
    shapesCaption: 'Vazado: a forma padrão do app. Preenchido em cor: a sua forma para esse acorde.',
    transposedCaptionKey:
      'As formas da própria música são para {key}, então acordes transpostos usam as suas formas e, depois, as padrão.',
    transposedCaption:
      'Uma música transposta não tem formas escolhidas, então cada acorde usa a sua forma e, depois, a padrão.',
    unvoiced: 'Nenhuma forma tocável para {list}.',
    variationLabel: 'Variação',
    variationDefault: 'Padrão',
    transpose: 'Transpor',
    transposeTitle: 'Transpor a visualização',
    down: 'Um semitom abaixo',
    up: 'Um semitom acima',
    writtenKey: 'Tom escrito',
    transposedToKey: 'Transposta para {key} ({offset})',
    transposedBy: 'Transposta ({offset})',
    backToKey: 'Voltar para {key}',
    backToWritten: 'Voltar ao tom escrito',
    arrangingOff: 'Arranjo desativado enquanto transposta',
    noVoicings:
      'Ninguém escolheu formas para {instrument} nesta música ainda. Estas são as formas mais fáceis para cada acorde.',
    arrangeFor: 'Arranjar para {instrument}',
    // A pergunta única na primeira abertura (workflow 1 §The instrument;
    // W01 L104-108; songs.first_song). O texto é fixo em "violão".
    instrumentPrompt: 'Tocando no violão — mudar?',
    instrumentPromptChange: 'Mudar instrumento',
    instrumentPromptDismiss: 'Manter o violão e dispensar',
    arrange: 'Arranjar',
    edit: 'Editar',
    history: 'Histórico',
    addToSetlist: 'Adicionar ao repertório',
    print: 'Imprimir',
    share: 'Compartilhar',
    showFile: 'Mostrar o arquivo',
    more: 'Mais',
    fullScreen: 'Tela cheia',
    leaveFullScreen: 'Sair da tela cheia',
    // Uma sincronização em segundo plano trouxe uma nova versão com a música
    // aberta (sync.read_in_place, fluxo 8; W08). `{name}` é quem fez a mudança.
    updatedBy: 'Atualizado por {name}',
    seeWhatChanged: 'Ver o que mudou',
    updateDismiss: 'Dispensar aviso de atualização',
    // The footnote under the full-screen chart while a merge waits (sync.in_place_notices;
    // W08#4 L153-156). `{name}` is the most recent incoming author.
    updateWaiting: 'Uma atualização de {name} está esperando. Ela aparece quando você sair da tela cheia.',
  },

  arrange: {
    back: 'Voltar',
    done: 'Pronto',
    modeChip: 'Arranjando · {instrument}',
    modeHint: 'Toque num acorde para escolher sua forma',
    chordButton: 'Escolher uma forma para {chord}',
    shapes: 'Formas',
    shapesCaption:
      'As formas escolhidas aparecem em tinta. Um acorde que você não escolheu mostra a sua forma ou o padrão do app, cada um marcado.',
    chooseEveryUnchosen: 'Escolher estas para cada acorde não escolhido',
    runWizard: 'Usar o assistente',
    variations: 'Variações',
    pickerLabel: 'Formas de {chord}',
    scopeLabel: 'Quais acordes isto muda',
    everyChord: 'Todo {chord}',
    onlyHere: 'Só aqui',
    onlyHereWarning:
      'Só aqui marca este compasso na cifra, para todos que tocam a música. Nos instrumentos deles aparece o padrão até alguém escolher.',
    choose: 'Escolher',
    chooseShape: 'Escolher esta forma',
    chooseShapeLabel: 'Escolher {chord}, {shorthand}',
    enterShape: 'Inserir uma forma',
    enterShapeTitle: 'Inserir uma forma para {chord}',
    noShapes: 'Nenhuma forma tocável para {chord} em {instrument}.',
    variationLabel: 'Variação',
    variationDefault: 'Padrão',
    newVariation: '+ Nova variação',
    selectorCaption: 'O seletor aparece só quando {instrument} tem mais de uma variação nesta música.',
    addVariationTitle: 'Adicionar uma variação',
    variationName: 'Nome desta variação',
    variationPlaceholder: 'Mais acima no braço',
    variationCopy: 'Começar a partir das formas de “{name}”',
    variationNeedsName: 'Dê um nome à variação.',
    variationTaken: 'Já existe uma variação chamada “{name}” para este instrumento.',
    addVariationCancel: 'Cancelar',
    addVariationConfirm: 'Adicionar',
  },

  library: {
    title: 'Desenhos salvos',
    empty:
      'Nada salvo para {label} ainda. Marque um desenho com estrela na tela de acordes para guardá-lo aqui.',
    count: '{count} salvos para {label}.',
    list: 'Desenhos salvos para {label}',
    open: 'Abrir',
    openLabel: 'Mostrar {chord} na tela de acordes',
    remove: 'Remover',
    removeLabel: 'Remover {chord} {shorthand} dos seus desenhos salvos',
  },

  catalog: {
    '6guitar': 'Violão (6 cordas)',
    '7guitar': 'Violão (7 cordas)',
    '4bass': 'Baixo (4 cordas)',
    '5bass': 'Baixo (5 cordas)',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Bandolim',
    tenorbanjo: 'Banjo tenor',
  },

  // O nome curto que o chip do cabeçalho mostra (shell.header_chrome, fluxo
  // 15): o nome do catálogo sem a contagem de cordas do instrumento padrão.
  catalogShort: {
    '6guitar': 'Violão',
    '7guitar': 'Violão de 7 cordas',
    '4bass': 'Baixo',
    '5bass': 'Baixo de 5 cordas',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Bandolim',
    tenorbanjo: 'Banjo tenor',
  },

  tuning: {
    Standard: 'Padrão',
    'Drop D': 'Drop D',
    'Open G': 'Sol aberto',
    'Open D': 'Ré aberto',
    DADGAD: 'DADGAD',
    'Open C': 'Dó aberto',
    Brazilian: 'Brasileira',
    'Standard (re-entrant)': 'Padrão (reentrante)',
    'Low G': 'Sol grave',
    Baritone: 'Barítono',
    'Standard (Brazil)': 'Padrão (Brasil)',
    Irish: 'Irlandesa',
    custom: 'Personalizada',
    customOption: 'Afinação personalizada',
  },

  form: {
    edit: 'Editar instrumento',
    choose: 'Escolha seu instrumento',
    add: 'Adicionar um instrumento',
    firstRunHelp: 'Tudo é mostrado para este instrumento. Você pode adicionar outros e trocar quando quiser.',
    addHelp: 'Ele entra na sua lista; o seletor no cabeçalho alterna entre eles.',
    instrument: 'Instrumento',
    fallbackName: 'Instrumento',
    tuning: 'Afinação',
    strings: 'Cordas',
    stringsHelp:
      'Da corda mais grave para a mais aguda. Qualquer lista de notas separadas por vírgula serve, inclusive afinações reentrantes.',
    style: 'Como você toca',
    styleHelp:
      'Define quais formas aparecem: no dedilhado uma corda abafada no meio do acorde é permitida, na batida não. A tela do instrumento muda isso depois.',
    name: 'Nome',
    nameHelp: 'Aparece no seletor. Dê a afinações personalizadas nomes que você reconheça.',
    frets: 'Casas',
    save: 'Salvar alterações',
    start: 'Começar a tocar',
    addButton: 'Adicionar instrumento',
    cancel: 'Cancelar',
    needName: 'Dê um nome ao instrumento.',
    badTuning: 'Não entendi essa afinação: {reason}',
  },

  backup: {
    title: 'Backup',
    help:
      'Tudo o que você tem fica guardado neste navegador, o que serve até o aparelho não ' +
      'servir mais. Um backup é um único zip com seus instrumentos e ajustes, seus desenhos ' +
      'salvos e cada música como um arquivo de texto que você pode ler e editar em qualquer lugar.',
    save: 'Salvar um backup',
    insideTitle: 'O que tem dentro',
    inside:
      'Um zip, com seus instrumentos e suas regras e seus ajustes em um arquivo, seus ' +
      'desenhos salvos em outro, e cada música como um arquivo de texto com o nome dela. ' +
      'Coloque outra música na pasta songs com qualquer programa de zip e ela volta com o resto.',
    restore: 'Restaurar um backup',
    confirmTitle: 'Restaurar de “{name}”?',
    confirmBody:
      'Tudo neste aparelho é substituído pelo que o arquivo contém: {instruments} e {songs}.',
    instruments: { one: '{count} instrumento', other: '{count} instrumentos' },
    songs: { one: '{count} música', other: '{count} músicas' },
    confirmButton: 'Substituir tudo',
    nudgeTitle: 'Suas músicas só existem neste aparelho',
    nudgeText: {
      one:
        'A música aqui não está em nenhum backup. No Android um aparelho novo não a ' +
        'recebe, e um navegador que limpa os dados a leva junto.',
      other:
        'As {count} músicas aqui não estão em nenhum backup. No Android um aparelho novo ' +
        'não as recebe, e um navegador que limpa os dados as leva junto.',
    },
    notNow: 'Agora não',
    failed: 'Não consegui ler esse backup: {reason}',
  },
  instruments: {
    title: 'Instrumentos',
    help:
      'Tudo na tela é para o instrumento em uso. Cada um guarda sua afinação, suas regras de voicing, seus desenhos salvos e suas músicas.',
    inUse: 'Em uso',
    reentrant: 'Reentrante',
    meta: '{tuning} · {count} casas',
    use: 'Usar',
    useLabel: 'Usar {label}',
    edit: 'Editar',
    editLabel: 'Editar {label}',
    delete: 'Excluir',
    deleteLabel: 'Excluir {label}',
    add: 'Adicionar instrumento',
    back: '← Todos os instrumentos',
    deleteThis: 'Excluir este instrumento',
    confirmTitle: 'Excluir {label}?',
    confirmShapes: {
      one: 'O {count} desenho salvo dele vai junto. ',
      other: 'Os {count} desenhos salvos dele vão junto. ',
    },
    confirmSongs: 'As músicas ficam, pois carregam a própria afinação. Isso não pode ser desfeito.',
    confirmButton: 'Excluir instrumento',
  },

  rules: {
    title: 'Regras de voicing',
    help: 'Como os acordes são montados em {label}.',
    preset: 'Predefinição',
    custom: 'Personalizada',
    presets: {
      beginner: 'Iniciante',
      strumming: 'Batida',
      fingerstyle: 'Dedilhado',
      jazz: 'Jazz',
      bassFriendly: 'Para baixo',
    },
    rules: 'Regras',
    rootInBass: 'A fundamental deve ser a nota mais grave',
    requireThird: 'Exigir a terça',
    omitFifth: 'A quinta pode ser omitida',
    allowRootless: 'Permitir voicings sem fundamental',
    requireExtensions: 'Exigir todas as extensões escritas',
    allowBarre: 'Permitir pestana',
    allowInnerMutes: 'Permitir corda abafada entre cordas que soam',
    allowDoubling: 'Permitir a mesma nota em mais de uma corda',
    allowDuplicatePitch: 'Permitir a mesma altura duas vezes',
    limits: 'Limites',
    maxSpan: 'Abertura máxima (casas)',
    minSoundingStrings: 'Mínimo de cordas soando',
    maxResultsPerGroup: 'Desenhos mostrados por posição',
    weights: 'Pesos de dificuldade',
    weightsHelp:
      'Quanto cada coisa pesa para um desenho ser difícil. Valores negativos tornam o desenho mais fácil.',
    weight: {
      spanPerFret: 'Abertura, por casa',
      barre: 'Pestana',
      fullBarre: 'Pestana completa, extra',
      perFinger: 'Cada dedo',
      innerMute: 'Corda abafada no meio',
      mutedString: 'Cada corda abafada',
      positionPerFret: 'Posição, por casa',
      omittedFifth: 'Omitir a quinta',
      rootless: 'Omitir a fundamental',
      nonRootBass: 'Inversão não pedida',
      openString: 'Cada corda solta (um bônus)',
      nonAdjacentStretch: 'Abertura grande',
    },
  },

  sheets: {
    title: 'Cifras',
    help: 'Os acordes de uma música em {label}, cada um preso à digitação que você quer ensinar.',
    titlePlaceholder: 'Nome da música',
    newTitleLabel: 'Nome da nova música',
    create: 'Nova música',
    untitled: 'Música sem título',
    shared: 'Música compartilhada',
    sharedInstrument: 'Instrumento compartilhado',
    empty: 'Nenhuma música ainda.',
    measures: { one: '{count} compasso', other: '{count} compassos' },
    chords: { one: '{count} acorde', other: '{count} acordes' },
    chosenHere: { one: ' · {count} voicing escolhido aqui', other: ' · {count} voicings escolhidos aqui' },
    voicedFor: 'Com voicings para {list}',
    view: 'Ver',
    viewLabel: 'Ver {title}',
    edit: 'Editar',
    editLabel: 'Editar {title}',
    duplicate: 'Duplicar',
    duplicateLabel: 'Duplicar {title}',
    delete: 'Excluir',
    deleteLabel: 'Excluir {title}',
    imported: 'A música "{title}" foi importada.',
  },

  editor: {
    // O editor de código-fonte CodeMirror (songs.editor, fluxos 3 e 4).
    source: {
      sourceLabel: 'Código da música',
      viewToggle: 'O que mostrar',
      text: 'Texto',
      preview: 'Prévia',
      previewLabel: 'Prévia da música como ela será lida',
      addSection: 'Adicionar seção',
      save: 'Salvar',
      undo: 'Desfazer',
      pasteFenced: 'A música colada agora está dentro de uma cerca, então é lida como música.',
      pasteTitleAdded: 'A primeira linha virou o título.',
      notSaved: 'Não salvo.',
      voicingStop:
        'A linha {line} é um dedilhado que não pode ser lido, e salvar iria descartá-lo. Corrija ou apague a linha e salve de novo.',
      markerStop: 'A linha {line} é um marcador de conflito. Resolva-o antes de poder salvar a música.',
      afterRuleStop:
        'A linha {line} vem depois da linha ---, onde só se guardam blocos de dedilhados, e salvar iria descartá-la. Se ela faz parte da música, mova a linha --- para baixo dela; um título de dedilhados precisa de uma afinação, como ## Voicings: E2 A2 D3 G3 B3 E4.',
    },
    // Uma sincronização em segundo plano mesclou uma nova versão sob as edições
    // não salvas do editor aberto (songs.edit_in_place, workflow 8; W08). O aviso
    // não modal diz de quem veio e abre o histórico da música. `{name}` é o nome
    // de quem fez a alteração. Reutiliza o texto da leitura (reading.updatedBy).
    mergedUnderLead: 'O que {name} salvou chegou enquanto você editava',
    mergedUnderRest: ' e foi mesclado sob as suas alterações. As suas continuam aqui, não salvas, por cima.',
    cameIn: 'Chegou',
    seeWhatCameIn: 'Ver o que chegou',
    updateDismiss: 'Dispensar aviso de atualização',
    // The editor app bar's word mark while the working text differs from the last
    // saved version (sync.in_place_notices; W08#3 L96, W04 L107/L158).
    unsaved: 'alterações não salvas',
    variationInUse: 'Variação:',
    variationLabel: 'Qual variação usar',
    variationDefault: 'Padrão',
    variationAdd: 'Adicionar variação',
    variationHelp:
      'Um instrumento pode ter várias variações numa música — uma fácil e uma mais ' +
      'cheia, por exemplo. Todas ficam no texto, cada uma sob o seu título; em qual você ' +
      'está trabalhando fica guardado por música.',
    variationName: 'Nome desta variação',
    variationPlaceholder: 'Mais acima no braço',
    variationCopy: 'Começar dos desenhos de “{name}”',
    variationNeedsName: 'Dê um nome à variação.',
    variationTaken: 'Já existe uma variação chamada “{name}” para este instrumento.',
    variationCancel: 'Cancelar',
    variationConfirm: 'Adicionar',
    chartBarNumbers: 'Mostrar os números dos compassos',
    chartVoicedAs: 'Nomear os acordes da cifra pelo que os desenhos soam',
    back: '← Todas as músicas',
    titleLabel: 'Nome da música',
    title: 'Nome',
    song: 'A música',
    placeholder: '# Verso\nA | Cm | A | Cm',
    help: {
      sections: {
        term: 'Seções',
        text: 'Três jeitos de dar nome a uma: uma linha começando com #, um nome entre ' +
          'colchetes, ou um nome com dois-pontos. As duas últimas podem trazer os acordes ' +
          'da seção na mesma linha. Os dois-pontos só dão nome a uma seção quando o que ' +
          'vem depois são acordes, então uma linha cantada com dois-pontos continua letra.',
        example: '# Verso\n[Intro] G  D  Em  C\nSolo: Am  F  C  G',
      },
      chart: {
        term: 'Uma cifra',
        text: 'Uma barra vertical inicia um compasso; espaços separam os acordes dentro dele.',
        example: 'C  Am | F  G | C\nF     | G    | C',
      },
      words: {
        term: 'Ou com a letra embaixo',
        text: 'Uma linha de acordes sobre a linha em que é cantada, cada acorde acima da sílaba em que cai.',
        example: 'G            D\nQuando eu te vi passar',
      },
      either: {
        term: 'Quando a linha poderia ser as duas coisas',
        text: 'Uma barra vertical faz dela uma cifra. Um > no começo faz dela letra, e é o único jeito de resolver uma linha que se lê como acorde.',
        example: 'G\n> A',
      },
      bars: {
        term: 'Números dos compassos',
        text: 'Os compassos são contados sozinhos. Escreva @9 no início de um compasso onde ' +
          'a cifra deixa de concordar com a partitura de origem — escrever uma repetição por ' +
          'extenso faz os mesmos compassos aparecerem duas vezes, e a contagem precisa ser ' +
          'avisada. Um título pode levar o número, e um número numa linha sozinha vale para o ' +
          'compasso seguinte.',
        example: '# A @9\nDm | G7 | @17 Em | A7',
      },
      variations: {
        term: 'Mais de uma variação',
        text: 'A palavra antes dos dois-pontos dá nome a uma variação, então um instrumento ' +
          'pode ter várias numa música — uma versão fácil e uma mais cheia, por exemplo. Um ' +
          'título só com Voicings é a variação padrão. Em qual você trabalha se escolhe acima ' +
          'dos desenhos.',
        example: '# Voicings: E2, A2, D3, G3, B3, E4\nC = x32010\n\n# Mais acima: E2, A2, D3, G3, B3, E4\nC = x35553',
      },
      voicings: {
        term: 'Voicings',
        text: 'Ficam depois de uma linha ---, um bloco por afinação sob um título que a nomeia, para a mesma música servir a todos os instrumentos. Um acorde tocado de mais de um jeito ganha uma nota. Um acorde para o qual você salvou um desenho recebe esse desenho na primeira vez que aparece.',
        example: '---\n\n# Posições: E2, A2, D3, G3, B3, E4\nCm = x35543\nCm[2] = 8-10-10-8-8-8',
      },
    },
    notAChord: 'Não é um acorde: {list}',
    badVoicingLines: 'Não consegui ler estas linhas de voicing: {list}',
    chart: 'A cifra',
    chartHelp: 'Clique em um acorde para escolher como ele é tocado ali.',
    nothingYet: 'Nada escrito ainda.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', usando o desenho padrão',
    chordUnvoiced: ', sem digitação possível',
    chordChoose: '. Escolher um voicing.',
    voicings: 'Voicings',
    voicingsHelp: 'Clique em um desenho para trocá-lo em todos os lugares em que é usado.',
    voicingsDefaults:
      ' Os desenhos marcados como padrão são o que a tela de acordes mostraria primeiro; escolha só os que precisam.',
    voicingsEmpty: 'Escreva a música acima e os acordes aparecem aqui.',
    voicingsList: 'Voicings usados nesta música',
    choose: 'Escolher',
    change: 'Trocar',
    everywhere: '{verb} {key} em todos os lugares. ',
    usingDefault: 'Usando o desenho padrão. ',
    usedIn: { one: 'Usado em {count} lugar.', other: 'Usado em {count} lugares.' },
    default: 'padrão',
    missing: 'Nenhum desenho tocável em {label} para: {list}. As regras de voicing podem estar rígidas demais.',
    share: 'Compartilhar link',
    snapPage: 'Encaixar esta página',
    previousPage: 'Página anterior',
    nextPage: 'Página seguinte',
    pageOf: 'Página {current} de {total}',
    print: 'Imprimir',
    shareLabel: 'Link para compartilhar esta música',
    shareHelp: 'Quem abrir este link vê a música como está escrita.',
  },

  picker: {
    enter: 'Montar um desenho',
    editCurrent: 'Editar este desenho',
    changeEverywhere: 'Trocar {label} em todos os lugares',
    howPlayed: 'Como {chord} é tocado aqui?',
    noParse: 'Esse acorde não faz sentido.',
    none: 'Nenhuma digitação para {chord} em {label}. As regras de voicing podem estar rígidas demais.',
    replaces: { one: 'Substitui este desenho em {count} lugar. ', other: 'Substitui este desenho em {count} lugares. ' },
    ways: '{count} jeitos de tocar, agrupados por posição, do mais fácil ao mais difícil.',
    changesOne: 'Muda só este acorde. ',
    chosen: ', escolhido no momento',
    clearEverywhere: 'Limpar em todos os lugares',
    clearChoice: 'Limpar escolha',
    cancel: 'Cancelar',
  },

  wizard: {
    open: 'Assistente de desenhos',
    barHelp: 'Escolha desenhos para a música toda de uma vez.',
    title: 'Escolher desenhos para a música toda',
    help:
      'Cada um destes escolhe um desenho para cada acorde da música, levando em conta o ' +
      'caminho da mão pela cifra em vez de julgar cada acorde isoladamente. Você vê o que ' +
      'aconteceria antes de mudar qualquer coisa.',
    planners: {
      smoothest: {
        name: 'O caminho mais suave',
        text:
          'Mantém a mão onde está e evita saltos na voz mais aguda. Dois desenhos fáceis em ' +
          'pontas opostas do braço são mais difíceis em sequência do que dois medianos lado ' +
          'a lado.',
        how: [
          'Todo desenho que a busca oferece para o acorde é um candidato.',
          'Cada um é pontuado pela dificuldade de segurar, mais o quanto a mão e a voz mais ' +
            'aguda teriam de se mover em relação ao desenho anterior.',
          'A cifra é percorrida na ordem de leitura, então cada escolha responde à anterior.',
        ],
      },
      openPosition: {
        name: 'Junto à pestana',
        text:
          'O desenho mais grave de cada acorde, com cordas soltas onde ajudam. Os desenhos ' +
          'que um iniciante já conhece.',
        how: [
          'Todo desenho que a busca oferece para o acorde é um candidato.',
          'Cada um é pontuado pela dificuldade de segurar, mais o quanto sobe no braço, menos ' +
            'um crédito por cada corda solta.',
          'A cifra é percorrida na ordem de leitura, então cada escolha responde à anterior.',
        ],
      },
      choroCentro: {
        name: 'Choro, ao lado de um sete cordas',
        text:
          'A parte do violão de seis cordas no regional: baixo no polegar e três dedos, no ' +
          'primeiro quádruplo do braço, com o baixo uma terça acima do que o sete cordas ' +
          'toca, para que os dois não se dobrem.',
        how: [
          'Os desenhos são enumerados, não buscados. A busca comum descarta um desenho com ' +
            'cordas abafadas quando existe um mais cheio e igualmente fácil, o que está certo ' +
            'para quem toca sozinho e errado aqui, onde as cordas graves ficam caladas porque ' +
            'o sete cordas as tem.',
          'Quatro cordas soando, ou cinco. Quatro é o padrão nesse idioma e cinco a exceção ' +
            'ocasional: um baixo no polegar e o resto em três dedos.',
          'Ou três notas, com o polegar na quarta corda e a corda grave suprimida, que uma ' +
            'fonte dá como a outra textura do idioma. Só para acorde com sétima: o que sai é ' +
            'tônica ou quinta, e é permitido porque o trítono — a terça e a sétima — continua ' +
            'soando. Oferecido, não preferido: as transcrições mostram quatro vozes nessa ' +
            'posição.',
          'As cordas que soam são vizinhas, com o polegar na mais grave, na segunda mais ' +
            'grave ou na quarta, e a pega alcançando ao menos a segunda corda de cima. Um ' +
            'buraco no meio é uma decisão que você ainda pode tomar; um desenho que precisa ' +
            'de um não se desfaz.',
          'Nada acima da sétima casa, cordas soltas bem-vindas, e o baixo da própria pega ' +
            'entre o mi grave e o ré acima dele. É o trecho de braço que as fontes nomeiam e ' +
            'a região em que as transcrições do Época de Ouro de fato ficam.',
          'A nota mais grave fica uma terça acima do que o sete cordas toca — a nota depois da ' +
            'barra quando a cifra escreve uma, a fundamental caso contrário — na oitava em que ' +
            'aquele violão estiver. É disso que se trata: os dois violões pegam inversões ' +
            'diferentes para não se dobrarem.',
          'Quando uma terça acima desse baixo não pertence ao acorde, outra relação entra no ' +
            'lugar dela — qual delas é a escolha abaixo. O caso está nomeado na literatura, ' +
            'não é falha daqui: uma terça acima da sétima de um dominante que resolve em ' +
            'acorde maior cai numa nota que o estilo não usa.',
          'Toda nota do acorde é mantida, exceto a quinta, que é a que esse idioma ' +
            'dispensa — a não ser que essa quinta seja diminuta ou aumentada, pois uma 5b ' +
            'ou 5# é o que faz o acorde ser aquele acorde.',
          'A cifra é percorrida na ordem de leitura, preferindo desenhos que mantenham as ' +
            'mesmas cordas soando, o que transforma uma sequência como Gm, Gm6, Gm7 em uma ' +
            'só pega com um dedo se movendo.',
          'Quando dois desenhos custam o mesmo, vence o mais grave no braço, e um acorde ' +
            'mais cheio vence um que gasta uma corda dobrando nota.',
        ],
        options: {
          whenNoThirdAbove: {
            label: 'Quando não há terça acima do outro violão dentro do acorde',
            values: {
              sixth: 'Uma sexta, depois uma oitava',
              thirdBelow: 'Uma terça abaixo',
            },
            rules: {
              sixth:
                'Quando uma terça acima do baixo do outro violão não pertence ao acorde, ' +
                'usa-se uma sexta acima dele, e na falta dela uma oitava. São os primeiros ' +
                'remédios que a literatura dá para esse caso.',
              thirdBelow:
                'Quando uma terça acima do baixo do outro violão não pertence ao acorde, a ' +
                'pega desce a uma terça ABAIXO dele, repousando na quinta — a segunda ' +
                'inversão. A literatura dá isso para o mesmo caso, descreve como em perfeita ' +
                'consonância com o estilo e nomeia a gravação de onde vem.',
            },
          },
        },
      },
    },
    summary: {
      one: '{count} de {total} acordes mudariam.',
      other: '{count} de {total} acordes mudariam.',
    },
    covers: {
      one: '{count} compasso',
      other: '{count} compassos',
    },
    nothing: 'Todo acorde já tem o desenho que este escolheria.',
    missing: 'Nenhum desenho para {list}.',
    how: 'Como funciona',
    howTitle: 'Como esta escolha é feita',
    sources: 'De onde isto vem',
    noSources: 'Sem fonte: é uma regra prática sobre mãos, não uma afirmação sobre como a música de alguém é tocada.',
    apply: 'Usar estes desenhos',
    back: '← Outras formas',
    cancel: 'Cancelar',
    preview: 'Ver o plano',
    policyLabel: 'Escolha uma abordagem',
    previewTitle: 'Os desenhos que ele escolheria',
    planReady: 'O plano está pronto',
    planReadyPrompt:
      '{variation} já tem desenhos escolhidos nesta música. Pôr o plano ao lado deles, ou por cima deles?',
    choiceLabel: 'Onde pôr o plano',
    newVariation: 'Em uma nova variação',
    newVariationHint: '{variation} fica como está',
    over: 'Por cima de {variation}',
    overHint: 'Substitui o que está escolhido ali',
    defaultName: 'Novos desenhos',
    editNote:
      'De qualquer forma é uma edição na cópia de trabalho: a folha de salvamento mostra o que ele escolheu, e descartar desfaz.',
    write: 'Escrever o plano',
  },

  shape: {
    foreign: '{note}, fora do acorde',
    title: 'Montar um desenho',
    titleFor: 'Montar um desenho para {chord}',
    help:
      'Clique numa casa para pôr um dedo nela, e de novo para tirar. A fileira acima da ' +
      'pestana alterna a corda entre solta e não tocada.',
    frets: 'Casas {from} a {to}',
    towardsNut: 'Mover a janela para a pestana',
    upTheNeck: 'Mover a janela para cima do braço',
    sketch: 'Desenho sendo montado: {shorthand}',
    unplayable: 'Nenhuma mão para isto',
    empty: 'Nada em nenhuma corda ainda.',
    clear: 'Limpar',
    cancel: 'Cancelar',
    save: 'Usar este desenho',
  },

  print: { legend: 'Desenhos de acorde usados' },

  confirm: { cancel: 'Cancelar', confirm: 'Excluir' },

  install: {
    title: 'Adicione o Explore Chords à tela inicial',
    label: 'Instalar este app',
    promptHelp: 'Ele abre como um app e continua funcionando sem rede — útil numa aula.',
    iosHelp:
      'Toque em Compartilhar e depois em "Adicionar à Tela de Início". Ele passa a abrir como um app e funciona sem rede.',
    install: 'Instalar',
    notNow: 'Agora não',
    gotIt: 'Entendi',
    never: 'Não perguntar de novo',
  },

  update: {
    ready: 'Uma nova versão está pronta.',
    reload: 'Recarregar agora',
    dismiss: 'Dispensar',
  },

  announce: {
    whatsNew: 'Novidades',
    showTutorial: 'Ver o tutorial',
    letsGo: 'Vamos lá',
    close: 'Fechar',
    sinceLast: 'O que mudou desde sua última visita',
  },

  announcements: {
    welcome: {
      title: 'Bem-vindo ao Explore Chords',
      sections: [
        {
          heading: 'Encontre um acorde',
          text:
            'Digite do jeito que você escreve — C7M, Cmaj7 ou C∆7 funcionam — e aparecem todos ' +
            'os jeitos de tocá-lo no seu instrumento, agrupados pela posição da mão e do mais ' +
            'fácil ao mais difícil. Quando um símbolo pode significar duas coisas, um aviso diz ' +
            'qual leitura foi usada e deixa você inverter.',
        },
        {
          heading: 'Seu instrumento vem primeiro',
          text:
            'O seletor no cabeçalho alterna entre os instrumentos que você configurou. Cada um ' +
            'guarda sua afinação e suas regras de voicing; a tela Instrumento é onde você as ' +
            'edita, e onde um baixo e um ukulele podem querer coisas diferentes.',
        },
        {
          heading: 'Salve os desenhos de que gosta',
          text:
            'Marque um desenho com estrela e ele vai para Salvos. Depois, um acorde para o qual ' +
            'você tem um desenho salvo recebe esse desenho automaticamente na primeira vez que ' +
            'aparece numa música.',
        },
        {
          heading: 'Escreva músicas como texto',
          text:
            'Em Músicas, uma cifra é texto puro: uma linha começando com # dá nome a uma seção, ' +
            'uma barra vertical inicia um compasso, espaços separam os acordes dentro dele. Clique ' +
            'em um acorde para escolher como ele é tocado; a escolha é escrita de volta no texto ' +
            'depois de uma linha ---, um bloco por afinação, para a mesma música servir a todos os ' +
            'instrumentos.',
        },
        {
          heading: 'Funciona sem sinal',
          text:
            'Depois de carregado, tudo roda no seu aparelho. Adicione à tela inicial e leve para ' +
            'uma aula sem rede nenhuma.',
        },
      ],
    },
    '0.2.0': {
      title: 'O que mudou na 0.2',
      sections: [
        {
          heading: 'Uma música, todos os instrumentos',
          text:
            'Uma música não pertence mais a um instrumento. Seus voicings ficam guardados por ' +
            'afinação, depois de uma linha --- no texto, então a mesma cifra toca no seu violão e ' +
            'no seu ukulele, cada um com seus desenhos. Músicas salvas no formato antigo se ' +
            'convertem sozinhas, e cópias separadas por instrumento de uma mesma música viram uma só.',
        },
        {
          heading: 'Acordes sem desenho escolhido ainda têm um',
          text:
            'Eles recebem o desenho que a tela de acordes mostraria primeiro, marcado como padrão. ' +
            'Escolha só os que precisam.',
        },
        {
          heading: 'Desenhos salvos entram nas músicas',
          text:
            'Um desenho que você marcou com estrela é usado assim que seu acorde entra numa ' +
            'música, se for diferente do padrão.',
        },
        {
          heading: 'B° é a sétima',
          text:
            'Um ° sozinho agora é lido como sétima diminuta, que é o que o símbolo significa na ' +
            'prática; a palavra dim é a tríade, e um aviso oferece a outra leitura.',
        },
      ],
    },
    '0.3.0': {
      title: 'O que mudou na 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'O app agora fala português do Brasil, espanhol latino-americano e italiano, além de inglês. ' +
            'Ele segue o idioma do navegador; o seletor no cabeçalho troca, e a escolha fica ' +
            'guardada neste aparelho.',
        },
        {
          heading: 'Cifras alinhadas',
          text:
            'Na tela e na impressão, os compassos de uma seção ficam em colunas, como numa cifra ' +
            'escrita à mão, e a folha impressa começa pela cifra e mantém os desenhos pequenos ' +
            'abaixo dela.',
        },
      ],
    },
    '0.4.0': {
      title: 'O que mudou na 0.4',
      sections: [
        {
          heading: 'Batida ou dedilhado',
          text:
            'As regras que se chamavam Padrão agora se chamam Batida, e Dedilhado ficou ao ' +
            'lado delas. Quem dedilha simplesmente não toca a corda do meio do acorde, então o ' +
            'dedilhado permite formas que a batida não alcança. Ao configurar um instrumento a ' +
            'pergunta aparece, e a tela do instrumento muda isso depois.',
        },
        {
          heading: 'Nada de cordas abafadas à toa',
          text:
            'Uma forma deixa de aparecer quando a mesma forma com uma das cordas abafadas ' +
            'soando também está disponível e os dedos que a preenchem descem sem esforço. Sol ' +
            'menor traz 3x0333, com a corda ré soando, no lugar de 3xx333, que a abafa sem ' +
            'motivo, e o dó solto aparece inteiro em vez de aos pedaços. Uma esticada ou uma ' +
            'pestana continuam contando como trabalho, então as formas que precisam de uma ' +
            'continuam aí. E uma corda abafada no meio deixou de pesar na dificuldade: no ' +
            'dedilhado, uma corda que você não toca não custa nada.',
        },
      ],
    },
    '0.5.0': {
      title: 'O que mudou na 0.5',
      sections: [
        {
          heading: 'Músicas com a letra',
          text:
            'Agora dá para escrever uma música como uma cifra de verdade: uma linha de acordes ' +
            'sobre a linha em que ela é cantada, cada acorde acima da sílaba em que cai. Cole ' +
            'uma e ela é lida assim, com [Intro] e Intro: dando nome às seções como o # já ' +
            'fazia. A letra vai junto para a folha impressa, que agora sai em duas colunas ' +
            'quando a música é estreita o bastante — normalmente pela metade das páginas. E no ' +
            'celular a estrofe quebra a linha em vez de sumir para o lado.',
        },
        {
          heading: 'As cifras de sempre continuam iguais',
          text:
            'Uma música sem letra embaixo dos acordes é lida exatamente como antes. Quando uma ' +
            'linha poderia ser as duas coisas, uma barra vertical faz dela uma cifra e um > no ' +
            'começo faz dela letra — o único jeito de resolver uma estrofe que diz mesmo "A", ' +
            'contra o acorde de mesmo nome.',
        },
      ],
    },
    '0.6.0': {
      title: 'O que mudou na 0.6',
      sections: [
        {
          heading: 'A música abre para ser lida',
          text:
            'Agora cada música tem uma página própria que a mostra como ela vai sair no papel ' +
            '— a letra embaixo dos acordes e os desenhos que você toca — em vez de abrir o ' +
            'editor. O texto continua a um clique, e a lista oferece os dois caminhos.',
        },
        {
          heading: 'Uma página por vez',
          text:
            'Essa página é dividida em páginas do tamanho da sua tela, então dá para ver onde ' +
            'a música passa do fim de uma delas. As setas no canto viram as páginas e deixam ' +
            'a página inteira à vista, o que transforma tocar olhando a tela em virar página ' +
            'em vez de rolar. O meio delas reenquadra a página depois de uma rolagem à mão, e ' +
            'a barra de cima não ocupa mais uma faixa da janela.',
        },
        {
          heading: 'As cifras são lidas melhor',
          text:
            'Parênteses em volta de uma sequência de acordes marcam uma repetição e não são ' +
            'mais lidos como acordes. Acordes que continuam depois do fim da letra mantêm o ' +
            'espaçamento com que foram escritos. E uma estrofe que quebra numa linha de uma ' +
            'palavra é lida como letra, não como um acorde que ninguém reconhece.',
        },
      ],
    },
    '0.7.0': {
      title: 'O que mudou na 0.7',
      sections: [
        {
          heading: 'Salve tudo em um arquivo',
          text:
            'Tudo o que você tem fica guardado neste navegador, o que serve até o aparelho ' +
            'não servir mais. A tela do instrumento agora salva tudo em um zip — seus ' +
            'instrumentos e suas regras, seus ajustes, seus desenhos salvos e cada música — e ' +
            'restaura aqui ou em outro aparelho.',
        },
        {
          heading: 'Suas músicas são arquivos de texto',
          text:
            'Dentro do zip cada música é um arquivo de texto que você abre e edita com ' +
            'qualquer coisa. Coloque outro na pasta songs com qualquer programa de zip e ele ' +
            'volta como música, com o nome do arquivo. O backup é seu para guardar, não um ' +
            'formato que só este app entende.',
        },
      ],
    },
    '0.8.0': {
      title: 'O que mudou na 0.8',
      sections: [
        {
          heading: 'Um lembrete para fazer backup',
          text:
            'O backup agora tem uma tela própria, e a lista de músicas avisa quando há ' +
            'músicas que não estão em nenhum backup — porque um Android novo não leva elas, e ' +
            'um navegador que limpa os dados leva elas junto. No celular, salvar entrega o ' +
            'arquivo para o menu de compartilhar, que é onde ficam o Drive, o Arquivos e o iCloud.',
        },
        {
          heading: 'As páginas enchem para baixo antes de para o lado',
          text:
            'Lendo uma música, a coluna agora vai até o pé da página antes de qualquer parte ' +
            'da música ir para o lado. Antes, algumas estrofes numa tela larga saíam como uma ' +
            'linha no alto de uma página vazia. Uma segunda coluna é uma página economizada, ' +
            'não largura para gastar.',
        },
        {
          heading: 'Os acordes ficam com os parênteses deles',
          text:
            'Em7(b5), A7(b13) e C7(9) estavam sendo lidos como um acorde chamado Em7(b5 com um ' +
            'parêntese solto do lado, porque parênteses também marcam repetição. Agora só é ' +
            'marca de repetição o parêntese que nada fecha, ou que nada abriu.',
        },
      ],
    },
    '0.9.0': {
      title: 'O que mudou na 0.9',
      sections: [
        {
          heading: 'O sinal de repetição',
          text:
            'A cifra pode usar % para um compasso que continua igual ao anterior, e ele é ' +
            'lido assim, não como um acorde que ninguém reconhece. Aparece do jeito que você ' +
            'escreveu, sem virar o acorde que ele representa, e não há nada para escolher ' +
            'nele: o acorde que ele repete já tem o desenho dele onde foi escrito.',
        },
      ],
    },
    '0.10.0': {
      title: 'O que mudou na 0.10',
      sections: [
        {
          heading: 'Todo diagrama do mesmo tamanho',
          text:
            'Um desenho mais acima no braço traz o número da casa, e o espaço para ele deixava ' +
            'aquele diagrama mais largo que os outros, desalinhando a fileira e tirando cada ' +
            'grade do centro sob o seu nome. Agora todo diagrama reserva esse espaço, precise ' +
            'dele ou não. O número da casa também ficou maior, e os diagramas na folha ' +
            'impressa igualmente: estavam pequenos demais para ler da estante.',
        },
        {
          heading: 'O que o desenho realmente soa',
          text:
            'O nome do acorde diz qual é a harmonia. O desenho decide qual das suas notas fica ' +
            'mais grave, e se a fundamental soa. Quando os dois diferem, o nome agora traz uma ' +
            'observação discreta do que você está pegando de fato: um Gm7 com a terça embaixo ' +
            'aparece como Gm7/Bb. Importa mais quando outro instrumento faz o baixo, porque aí ' +
            'escolher outra inversão é o arranjo, não um acidente.',
        },
        {
          heading: 'O assistente de desenhos',
          text:
            'Um botão acima da cifra escolhe desenhos para a música toda de uma vez. Três ' +
            'formas até agora: o caminho mais suave para a mão, junto à pestana, ou a parte ' +
            'do violão de seis cordas num regional de choro ao lado de um sete cordas. Ele ' +
            'mostra o que faria antes de mudar qualquer coisa, e cada um explica as próprias ' +
            'regras e cita as próprias fontes em “Como funciona”.',
        },
        {
          heading: 'Ou nomear a cifra pelo que você toca',
          text:
            'Uma caixa de seleção na página de leitura nomeia os acordes da cifra pelo que os ' +
            'desenhos escolhidos soam, então Gm aparece como Gm/Bb quando o desenho põe a ' +
            'terça embaixo. Desligado por padrão, já que uma cifra nomeia a harmonia. Vale ' +
            'também para a folha impressa, porque é o mesmo renderizador.',
        },
      ],
    },
    '0.11.0': {
      title: 'O que mudou na 0.11',
      sections: [
        {
          heading: 'Montar um desenho clicando',
          text:
            'A lista de desenhos de um acorde é o que a busca achou, o que não ajuda quando ' +
            'você já sabe o que quer tocar e não está lá. As duas formas de escolher um ' +
            'desenho agora também oferecem um diagrama grande o bastante para clicar: uma ' +
            'casa para pôr um dedo, de novo para tirar, a fileira acima da pestana para ' +
            'alternar a corda entre solta e não tocada. Começa do desenho em uso, ou do zero, ' +
            'e deixa salvar uma abertura para a qual não acha dedos — um desenho pode estar ' +
            'certo e ser difícil. Abaixo ficam as notas que ele pega, com qualquer nota fora ' +
            'do acorde marcada.',
        },
        {
          heading: 'Os desenhos descem a página no celular',
          text:
            'Os desenhos de uma música e os que você salvou ficavam numa fileira só, que ' +
            'rolava para o lado, deixando sete de oito fora da tela com a altura toda da ' +
            'página sobrando. Agora eles quebram em linhas. Os resultados de acordes continuam ' +
            'rolando para o lado, porque ali há uma ordem e o primeiro da fileira é a resposta.',
        },
        {
          heading: 'Menos páginas ao ler uma música',
          text:
            'Uma música com linhas de cifra mais largas que a tela do celular saía com uma ' +
            'página por título de seção e os desenhos cortados na lateral. Agora a cifra ocupa ' +
            'a única página de que precisa, e os desenhos seguem pelas páginas em vez de serem ' +
            'cortados.',
        },
      ],
    },
    '0.12.0': {
      title: 'O que mudou na 0.12',
      sections: [
        {
          heading: 'Números dos compassos',
          text:
            'Transcrever de uma partitura muitas vezes quer dizer reescrever a estrutura: uma ' +
            'repetição vai por extenso, porque assim se toca melhor. Aí os compassos da cifra ' +
            'deixam de casar com os números da partitura, e “a partir do compasso 9” tem de ' +
            'querer dizer o compasso 9 da partitura. Então os compassos são contados sozinhos, ' +
            'e @9 no início de um compasso diz qual é o número dele de verdade — também num ' +
            'título, como # A @9. Os números aparecem na margem da página de leitura, e na ' +
            'folha impressa junto. Desligados até você pedir, e não oferecidos numa música com ' +
            'letra, onde um acorde pode durar quatro compassos ou meio, e o texto não diz qual.',
        },
        {
          heading: 'Dá para achar como montar um desenho',
          text:
            'Um acorde tem tantos desenhos quantos tem — quarenta e três para um C no violão — ' +
            'e os botões ficavam abaixo dessa lista, o que no celular jogava todos eles para ' +
            'fora da tela. Agora ficam acima da lista, logo abaixo do título.',
        },
      ],
    },
    '0.13.0': {
      title: 'O que mudou na 0.13',
      sections: [
        {
          heading: 'Mais de um jeito de tocar a mesma música',
          text:
            'Uma música guardava um conjunto de desenhos por instrumento. Agora pode guardar ' +
            'vários — uma versão fácil e uma mais cheia, ou dois usos do assistente lado a ' +
            'lado para comparar. A palavra antes dos dois-pontos no título dos desenhos dá ' +
            'nome à variação, então “# Mais acima: E2, A2, …” é uma variação chamada Mais ' +
            'acima. Adicione uma acima dos desenhos, partindo da que você está usando ou do ' +
            'zero, e alterne entre elas ali ou na página de leitura. Um acorde sobre o qual a ' +
            'variação não diz nada fica no seu padrão, como antes.',
        },
        {
          heading: 'Um “null” perdido saiu',
          text:
            'A página de leitura de uma música com letra mostrava a palavra null embaixo do ' +
            'título, e o painel de desenhos de uma música sem acordes também. Os dois foram ' +
            'corrigidos, junto com o motivo de acontecerem.',
        },
      ],
    },
    '0.14.0': {
      title: 'O que mudou na 0.14',
      sections: [
        {
          heading: 'O assistente de choro pergunta como você quer tocar',
          text:
            'Algumas perguntas desse estilo não têm resposta certa, só preferência. Quando o ' +
            'sete cordas sobe um semitom — fá para fá#, num compasso de F e outro de F#° — a ' +
            'terça acima é lá nos dois, então o seis cordas repete a mesma nota no baixo. Um ' +
            'chorão pode fazer exatamente isso, ou descer a uma terça abaixo. As duas coisas ' +
            'estão na literatura. Essa escolha agora fica ao lado dos desenhos: vire a chave e ' +
            'veja a música inteira responder. A lista “Como esta escolha é feita” vira junto, ' +
            'de modo que o que ela diz é sempre o que vai ser feito.',
        },
        {
          heading: 'Acordes que ele deixava em branco',
          text:
            'Um dominante com a sétima no baixo — C7/Bb a caminho de F — voltava sem desenho ' +
            'nenhum. Existe resposta documentada: o seis cordas vai uma terça ABAIXO do outro ' +
            'violão e repousa na quinta, C7/G. Agora ele toca isso. Cm7 estava sem a terça por ' +
            'um motivo parecido. E um dominante pode agora ser tocado com três notas e o ' +
            'polegar na quarta corda, que é a outra textura do estilo e aqui simplesmente ' +
            'faltava.',
        },
        {
          heading: 'Acordes diminutos mantêm o trítono',
          text:
            'Pedindo F#°, o assistente dava quatro cordas sem trítono nenhum e uma delas ' +
            'gasta dobrando nota. A quinta é a nota que esse estilo dispensa — mas não quando ' +
            'ela é diminuta, que é justamente a nota que faz o acorde ser diminuto. Agora ela ' +
            'fica, e a quinta aumentada do acorde aumentado também.',
        },
        {
          heading: 'Um acorde, dois desenhos, quando a música pede',
          text:
            'O assistente escolhia um desenho por acorde para a música inteira. Agora ele pode ' +
            'dar ao mesmo acorde um desenho diferente em outro compasso, quando a política ' +
            'pedir, e escreve a marca de rodapé sozinho. A prévia mostra a música como ela vai ' +
            'ficar — os desenhos que ela vai carregar e quantos compassos cada um cobre — ' +
            'então um acorde dividido em dois é coisa que você vê antes de aceitar, não depois.',
        },
      ],
    },
    '0.15.0': {
      title: 'O que mudou na 0.15',
      sections: [
        {
          heading: 'Uma dissertação que não achávamos',
          text:
            'O assistente de choro segue fontes escritas, e o único trabalho dedicado ' +
            'inteiramente à parte do violão de seis — José Paulo Becker sobre o Época de ' +
            'Ouro, 1996 — não se achava em lugar nenhum. Apareceu. Tudo o que vem abaixo sai ' +
            'da leitura dele, e é por isso que esta versão corrige coisas que a 0.14 tinha ' +
            'só meio certas. Ele agora está em “De onde isto vem”, com os demais.',
        },
        {
          heading: 'A pergunta que ele te faz ficou melhor',
          text:
            'Antes ele perguntava o que fazer quando a terça acima do outro violão repetia a ' +
            'nota que você acabara de tocar. Nenhuma fonte pergunta isso — e Becker, que ' +
            'documenta essa parte em detalhe, nunca põe o seis cordas abaixo do sete cordas. ' +
            'Então a pergunta agora é a que a literatura de fato faz: quando nenhuma terça ' +
            'acima do outro violão está no acorde, você quer uma sexta e depois uma oitava, ' +
            'ou a terça abaixo? C7/Bb a caminho de F é o caso, e dá para ouvir os dois.',
        },
        {
          heading: 'Ele alcança a prima, e fica na região que é dele',
          text:
            'Duas fontes discordam sobre onde vão os dedos, e ganhou a que transcreve ' +
            'execuções de verdade. O violão de Becker no Época de Ouro usa a prima o tempo ' +
            'todo — um ré menor com ré embaixo de lá, ré e fá, em cima das quatro primeiras ' +
            'cordas — então o assistente agora oferece esses desenhos. Medir as transcrições ' +
            'dele também deu a região em que a parte realmente fica, nunca abaixo do mi ' +
            'solto e quase sempre entre o sol e o ré acima dele, e o assistente agora se ' +
            'mantém nela em vez de subir o braço.',
        },
        {
          heading: 'E uma coisa deixada de propósito como estava',
          text:
            'O dominante de três notas com o polegar na quarta corda, novidade da 0.14, se ' +
            'apoia numa fonte só. Becker nunca fala em suprimir corda, e as transcrições dele ' +
            'mostram quatro vozes nessa posição. Então o desenho continua sendo oferecido e ' +
            'deixou de ser preferido. Onde “Como esta escolha é feita” depende de uma fonte ' +
            'só, ou da nossa leitura e não da delas, agora está dito.',
        },
      ],
    },
  },

  instr: {
    chip: {
      change: '{label}, trocar de instrumento',
      description: '{catalogue}, afinação {tuning}: {pitches}',
      descriptionCustom: '{catalogue}, afinação personalizada: {pitches}',
    },
    roster: {
      title: 'Instrumentos',
      inUse: 'em uso',
      reentrant: 're-entrante',
      strings: { one: '{count} corda', other: '{count} cordas' },
      open: 'Abrir {label}',
      add: 'Adicionar instrumento',
      addMeta: 'catálogo, uma afinação, um nome',
      footer:
        'O que está em uso molda todos os acordes que o app mostra. Trocar re-deriva tudo na hora — um toque. Um instrumento em uso de cada vez.',
      back: 'Voltar',
    },
    add: {
      title: 'Adicionar instrumento',
      cancel: 'Cancelar',
      instrument: 'Instrumento',
      tuning: 'Afinação',
      tuningGroup: 'Escolha uma afinação',
      custom: 'Personalizada…',
      customOption: 'Afinação personalizada',
      customPlaceholder: 'E2 A2 D3 G3 B3 E4',
      tuningHelp:
        'A afinação é a identidade do instrumento — a mesma grafia que o bloco de voicing de uma música usa (cifra.md §6). Um capotraste é uma afinação; não há campo de capotraste.',
      name: 'Nome',
      howYouPlay: 'Como você toca',
      howYouPlayHelp: 'O preset. Ajuste as regras individuais depois, na tela do instrumento.',
      submit: 'Adicionar instrumento',
      badTuning: 'Essa afinação não foi entendida: {reason}',
    },
    detail: {
      use: 'Usar este instrumento',
      inUse: 'em uso',
      definition: 'Definição',
      edit: 'Editar',
      catalogue: 'Catálogo',
      tuning: 'Afinação',
      frets: 'Casas',
      voicingRules: 'Regras de voicing',
      editRules: 'Editar regras',
      remove: 'Remover instrumento',
    },
    rules: {
      title: 'Regras de voicing',
      preset: 'Preset',
      presetGroup: 'Preset de voicing',
      reset: 'Voltar para {preset}',
      explainer:
        'Editar qualquer regra torna o preset Personalizado e o mantém exatamente assim. Um instrumento que ainda nomeia um preset é reconstruído a partir dele ao carregar; um conjunto Personalizado não.',
      rules: 'Regras',
      limits: 'Limites',
      costs: 'Custos',
      noBass:
        'Fundamental no baixo fica desligada num instrumento sem registro grave — um ukulele, um cavaquinho — para que trocar para Jazz não a quebre de novo.',
      on: 'ativado',
      off: 'desativado',
      toggleLabel: '{label}, {state}',
      rule: {
        requireRoot: 'Fundamental obrigatória',
        rootInBass: 'Fundamental no baixo',
        requireThird: 'Terça obrigatória',
        omitFifth: 'A quinta pode ser omitida',
        allowRootless: 'Permitir sem fundamental',
        requireExtensions: 'Extensões obrigatórias',
        allowBarre: 'Permitir pestana',
        allowInnerMutes: 'Permitir cordas abafadas no meio',
        allowDoubling: 'Permitir dobrar notas',
        allowDuplicatePitch: 'Permitir altura idêntica repetida',
      },
      limit: {
        maxSpan: 'Abertura máxima',
        maxSpanUnit: 'casas',
        minSoundingStrings: 'Mínimo de cordas soando',
        maxResultsPerGroup: 'Formas por posição',
      },
    },
    shapes: {
      heading: 'Minhas formas · {tuning}',
      saved: { one: '{count} salva', other: '{count} salvas' },
      empty: 'Nenhuma forma salva para esta afinação ainda. Marque uma no explorador.',
      footer:
        'Marcadas uma a uma no explorador (fluxo 16); revisadas e removidas aqui. Nunca escritas numa música.',
      remove: 'Remover sua forma de {chord}, {shorthand}',
    },
    remove: {
      title: 'Remover {label}?',
      shapes: { one: 'Sua {count} forma salva', other: 'Suas {count} formas salvas' },
      body:
        '{shapes} e as variações em uso para {tuning} são removidas junto. Suas músicas mantêm os próprios voicings — só vão as configurações deste instrumento.',
      bodyNoShapes:
        'As variações em uso para {tuning} são removidas junto. Suas músicas mantêm os próprios voicings — só vão as configurações deste instrumento.',
      cancel: 'Cancelar',
      confirm: 'Remover',
    },
  },
};
