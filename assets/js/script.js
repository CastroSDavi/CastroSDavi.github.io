// --- Classe Usuário ---
class Usuario {
    constructor(nome = null, acertos = 0, erros = 0, pontos = 0) {
        this._nome = nome;
        this._acertos = acertos;
        this._erros = erros;
        this._pontos = pontos;
        this.atualizar_pontos();
    }
    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }
    set acertos(acertos) {
        this._acertos = acertos;
        this.atualizar_pontos();
    }
    set erros(erros) {
        this._erros = erros;
        this.atualizar_pontos();
    }
    resetarContadores() {
        this._acertos = 0;
        this._erros = 0;
        this.atualizar_pontos();
    }
    atualizar_pontos() {
        this._pontos = (15 * this._acertos) - (5 * this._erros);
        if (this._pontos < 0) this._pontos = 0;
    }
}

// --- Array de Perguntas ---
let perguntas = []; // Será carregado do JSON

// --- Variáveis Globais ---
let perguntaAtual = 0;
let perguntasFiltradas = [];
let categoriasSelecionadas = [];
const usuario = new Usuario();
let autoAvancoTimeoutId = null;
let secaoAtual = 'inicio-section'; // Padrão inicial
const QUESTOES_POR_PAGINA_GRID = 10; // Número de questões por página na grid
let paginaAtualGrid = 1; // Página atual da grid

// --- Elementos do DOM (cacheados) ---
let elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elNavigationButtons, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, avisoMensagem;
let elQuestionGridContainer;
let elPaginacaoControles;
let elFiltroCheckboxesScroll; // O div rolável das categorias
let elCatScrollLeft;         // Botão seta esquerda categorias
let elCatScrollRight;        // Botão seta direita categorias
let elBtnEncerrarSessao;     // Botão Encerrar
let elBtnRecomecar;          // Botão Tentar Novamente / Recomeçar
let elConfirmEncerrarOverlay, elConfirmEncerrarBtn, elCancelEncerrarBtn; // <<< Elementos do Modal

// --- Função para Embaralhar Array (Opcional) ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Função para buscar elementos do DOM ---
function cacheDOMelements() {
    try {
        elCategoriaTitulo = document.getElementById('categoria-titulo');
        elIdQuestao = document.getElementById('id-questao');
        elPerguntaTexto = document.getElementById('pergunta-texto');
        elPerguntaImagem = document.getElementById('pergunta-imagem');
        elRespostasContainer = document.getElementById('respostas-container');
        elReferencia = document.getElementById('referencia-questao');
        elQuizSection = document.getElementById('quiz-section');
        elPontuacao = document.getElementById('pontuacao');
        elAcertosNum = document.getElementById('acertos-numero');
        elErrosNum = document.getElementById('erros-numero');
        elPrevBtn = document.getElementById('prev-btn');
        elNextBtn = document.getElementById('next-btn');
        elNavigationButtons = elQuizSection ? elQuizSection.querySelector('.navigation-buttons') : null;
        elResultadoCard = document.querySelector('.resultado-final-card');
        elBtnRecomecar = elResultadoCard ? elResultadoCard.querySelector('#btn-recomecar') : null;
        elProgressBarFill = document.getElementById('progress-bar-fill');
        elProgressText = document.getElementById('progress-text');
        elProgressContainer = document.getElementById('progress-container');
        filtroCheckboxesContainer = document.querySelector('.filtro-categorias-container');
        elFiltroCheckboxesScroll = document.getElementById('filtro-checkboxes-scroll');
        elCatScrollLeft = document.getElementById('cat-scroll-left');
        elCatScrollRight = document.getElementById('cat-scroll-right');
        elBtnEncerrarSessao = document.getElementById('btn-encerrar-sessao');
        avisoContainer = document.getElementById('aviso-container');
        avisoMensagem = avisoContainer ? avisoContainer.querySelector('.aviso-mensagem') : null;
        elQuestionGridContainer = document.getElementById('question-grid-container');
        elPaginacaoControles = document.getElementById('paginacao-controles');

        // Cache dos elementos do Modal
        elConfirmEncerrarOverlay = document.getElementById('confirm-encerrar-overlay');
        elConfirmEncerrarBtn = document.getElementById('confirm-encerrar-btn');
        elCancelEncerrarBtn = document.getElementById('cancel-encerrar-btn');

        const elementos = {
            elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, elQuestionGridContainer, elPaginacaoControles, elFiltroCheckboxesScroll, elCatScrollLeft, elCatScrollRight, elBtnEncerrarSessao, elBtnRecomecar,
            elConfirmEncerrarOverlay, elConfirmEncerrarBtn, elCancelEncerrarBtn // Adiciona elementos do modal à checagem
        };
        let missingElements = false;
        for (const key in elementos) {
            // Considerar botões/modal não essenciais para o carregamento *inicial* da página,
            // mas logar um aviso se não encontrados.
            const isEssentialForCoreFunctionality = ![
                'elNavigationButtons', 'avisoMensagem', 'elBtnEncerrarSessao',
                'elBtnRecomecar', 'elConfirmEncerrarOverlay', 'elConfirmEncerrarBtn', 'elCancelEncerrarBtn'
            ].includes(key);

            if (!elementos[key] && isEssentialForCoreFunctionality) {
                console.error(`Erro Cache DOM: Elemento essencial ${key} não encontrado! Verifique IDs/classes no HTML.`);
                missingElements = true;
            } else if (!elementos[key] && !isEssentialForCoreFunctionality) {
                 console.warn(`Aviso Cache DOM: Elemento opcional ${key} não encontrado. Funcionalidade correspondente pode não estar disponível.`);
            }
        }
        return !missingElements;

    } catch (error) {
        console.error("Erro fatal durante cacheDOMelements:", error);
        return false;
    }
}

// --- Funções de Aviso ---
function mostrarAviso(texto) {
    if (!avisoContainer || !avisoMensagem) {
        console.warn("Tentativa de mostrar aviso, mas elementos não encontrados.");
        return;
    }
    avisoMensagem.textContent = texto;
    avisoContainer.style.display = 'block';
    // Esconder outros elementos se o aviso for mostrado na seção de questões
    if (secaoAtual === 'questoes-section') {
        if (elQuizSection) elQuizSection.style.display = 'none';
        if (elResultadoCard) elResultadoCard.style.display = 'none';
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) elPaginacaoControles.style.display = 'none';
        if (elProgressContainer) elProgressContainer.style.display = 'none';
        if (elProgressText) elProgressText.style.display = 'none';
        if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
    }
}
function limparAviso() {
    if (avisoContainer) {
        avisoContainer.style.display = 'none';
    }
}

// --- Funções de Filtro de Categoria ---
function extrairCategoriasUnicas(listaPerguntas) {
    const categorias = new Set();
    if (Array.isArray(listaPerguntas)) {
        listaPerguntas.forEach(pergunta => {
            if (Array.isArray(pergunta.categorias)) {
                pergunta.categorias.forEach(cat => {
                    if (cat && typeof cat === 'string') {
                       categorias.add(cat.trim());
                    }
                });
            }
        });
    }
    return [...categorias].sort((a, b) => a.localeCompare(b));
}

function gerarCheckboxesCategoria(containerElemento, listaCategorias) {
    if (!containerElemento) {
        console.error("Container rolável para checkboxes de categoria não encontrado!");
        return;
    }
    containerElemento.innerHTML = ''; // Limpa

    const criarCheckboxItem = (id, value, textoLabel, checked = true) => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.name = 'categoria';
        input.value = value;
        input.checked = checked;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = textoLabel;
        div.appendChild(input);
        div.appendChild(label);
        return div;
    };

    containerElemento.appendChild(criarCheckboxItem('cat-todas', 'Todas', 'Todas', true));
    listaCategorias.forEach(categoria => {
        const idSeguro = `cat-${categoria.toLowerCase().replace(/\s+/g, '-')}`;
        containerElemento.appendChild(criarCheckboxItem(idSeguro, categoria, categoria, true));
    });

    setTimeout(atualizarSetasScrollCategorias, 100);
}

function obterCategoriasSelecionadas() {
    const selecionadas = [];
     if (!filtroCheckboxesContainer) return selecionadas;

    const checkboxesCategorias = filtroCheckboxesContainer.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:checked:not([value="Todas"])');
    checkboxesCategorias.forEach(cb => {
        selecionadas.push(cb.value);
    });
    return selecionadas;
}

// --- Funções para Rolagem das Categorias com Setas ---
function rolarCategorias(direcao) {
    if (!elFiltroCheckboxesScroll) return;
    const scrollAmount = elFiltroCheckboxesScroll.clientWidth * 0.8;
    elFiltroCheckboxesScroll.scrollBy({
        left: direcao === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
    // Usar setTimeout para garantir a atualização após a animação de rolagem
    setTimeout(atualizarSetasScrollCategorias, 400); // Ajuste o tempo se necessário
}


function atualizarSetasScrollCategorias() {
    if (!elFiltroCheckboxesScroll || !elCatScrollLeft || !elCatScrollRight) {
        // Garante que as setas estejam ocultas se os elementos não existirem
        if(elCatScrollLeft) { elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true; }
        if(elCatScrollRight) { elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true; }
        return;
    }
    // Pequeno delay para garantir que o DOM esteja atualizado, especialmente após gerar os checkboxes
    // requestAnimationFrame é uma alternativa mais robusta se o delay causar problemas
    // requestAnimationFrame(() => {
        const scrollLeft = Math.round(elFiltroCheckboxesScroll.scrollLeft);
        const scrollWidth = elFiltroCheckboxesScroll.scrollWidth;
        const clientWidth = elFiltroCheckboxesScroll.clientWidth;
        const epsilon = 1; // Margem para lidar com arredondamentos de pixel

        // Verifica se há conteúdo suficiente para rolar
        const canScroll = scrollWidth > clientWidth + epsilon;

        if (!canScroll) {
            elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true;
            elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true;
        } else {
            elCatScrollLeft.disabled = scrollLeft <= 0;
            elCatScrollRight.disabled = scrollLeft + clientWidth >= scrollWidth - epsilon;

            elCatScrollLeft.style.pointerEvents = elCatScrollLeft.disabled ? 'none' : 'auto';
            elCatScrollRight.style.pointerEvents = elCatScrollRight.disabled ? 'none' : 'auto';

            // Não altere a opacidade aqui se você usa a opacidade no :hover do CSS
            // Apenas controle o estado 'disabled' e 'pointer-events'
        }
    // });
}

// --- Funções de Barra de Progresso ---
function atualizarBarraProgresso() {
    if (!elProgressContainer || !elProgressBarFill || !elProgressText) return;
    const quizAtivo = elQuizSection && elQuizSection.style.display !== 'none' && elQuizSection.style.display !== 'hidden'; // Verifica se está visível
    const temPerguntas = perguntasFiltradas && perguntasFiltradas.length > 0;

    if (quizAtivo && temPerguntas) {
        elProgressContainer.style.display = 'block';
        elProgressText.style.display = 'block';
        const totalPerguntas = perguntasFiltradas.length;
        // Garante que o número da questão atual não exceda o total ao exibir
        const numQuestaoAtualExibicao = Math.min(perguntaAtual + 1, totalPerguntas);
        const progressoPercentual = totalPerguntas > 0 ? (numQuestaoAtualExibicao / totalPerguntas) * 100 : 0;

        elProgressBarFill.style.width = `${progressoPercentual}%`;
        elProgressText.textContent = `${numQuestaoAtualExibicao} / ${totalPerguntas}`;
    } else {
        elProgressContainer.style.display = 'none';
        elProgressText.style.display = 'none';
        if(elProgressBarFill) elProgressBarFill.style.width = `0%`;
        if(elProgressText) elProgressText.textContent = `0 / 0`;
    }
}


// --- Funções de Navegação de Seção ---
function mostrarSecao(idSecao) {
    if (!elQuizSection) { // Garante que os elementos estejam cacheados
        if (!cacheDOMelements()) {
             console.error("Falha ao mostrar seção - elementos do DOM não encontrados.");
             alert("Erro ao carregar a interface. Tente recarregar a página.");
             return;
        }
    }
    document.querySelectorAll('.main-section').forEach(s => s.style.display = 'none');
    const secaoParaMostrar = document.getElementById(idSecao);
    if (secaoParaMostrar) {
        secaoParaMostrar.style.display = 'flex'; // Usar flex como padrão para as seções principais
        secaoAtual = idSecao;
        limparAviso(); // Limpa avisos ao mudar de seção
        if (idSecao === 'questoes-section') {
            prepararSecaoQuestoes(); // Prepara a seção de questões (filtros, etc.)
            setTimeout(atualizarSetasScrollCategorias, 150); // Dá um tempo para renderizar
        } else {
            esconderElementosQuiz(); // Garante que elementos do quiz fiquem ocultos
        }
        // Atualiza a barra de progresso (deve esconder se não for quiz ativo)
        atualizarBarraProgresso();
    } else {
         console.error(`Seção com ID '${idSecao}' não encontrada.`);
    }
}

function prepararSecaoQuestoes() {
     // Garante que o quiz e o resultado estejam ocultos ao entrar na seção
     if (elQuizSection) elQuizSection.style.display = 'none';
     if (elResultadoCard) elResultadoCard.style.display = 'none';
     if (avisoContainer) avisoContainer.style.display = 'none'; // Esconde aviso inicial
     // Atualiza os filtros e carrega as perguntas correspondentes (ou mostra aviso)
     atualizarFiltroECarregarPerguntas();
}

function esconderElementosQuiz() {
    // Esconde todos os componentes específicos do quiz ativo ou finalizado
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    if (elPaginacaoControles) {
        elPaginacaoControles.innerHTML = ''; // Limpa paginação
        elPaginacaoControles.style.display = 'none';
    }
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
    // Esconde botões específicos da seção de questões
    if(elCatScrollLeft) { elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; }
    if(elCatScrollRight) { elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; }
    if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
}


// --- Funções da Grade de Questões e Paginação ---
function renderizarGridEPaginacao() {
    if (!elQuestionGridContainer || !elPaginacaoControles || !perguntasFiltradas) {
        console.warn("Elementos da grid/paginação ou perguntas filtradas não disponíveis.");
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none'; // Esconde paginação também
        return;
    }
    if (perguntasFiltradas.length === 0) {
        elQuestionGridContainer.style.display = 'none';
        elPaginacaoControles.innerHTML = '';
        elPaginacaoControles.style.display = 'none'; // Esconde paginação se não há perguntas
        return;
    }
    elQuestionGridContainer.style.display = 'flex'; // Mostra a grid
    renderizarItensDaPaginaGrid(paginaAtualGrid);
    renderizarControlesPaginacao(perguntasFiltradas.length);
    atualizarGridEstilos(perguntaAtual); // Atualiza estilos imediatamente
}


function renderizarItensDaPaginaGrid(pagina) {
    if (!elQuestionGridContainer) return;
    elQuestionGridContainer.innerHTML = ''; // Limpa a grid
    const totalQuestoes = perguntasFiltradas.length;
    const inicio = (pagina - 1) * QUESTOES_POR_PAGINA_GRID;
    const fim = Math.min(inicio + QUESTOES_POR_PAGINA_GRID, totalQuestoes);

    for (let i = inicio; i < fim; i++) {
        const gridItem = document.createElement('button');
        gridItem.classList.add('grid-item');
        gridItem.textContent = i + 1; // Número da questão (base 1)
        gridItem.dataset.index = i; // Índice da questão no array filtrado (base 0)
        gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
        gridItem.onclick = () => irParaQuestao(i); // Usa o índice base 0
        elQuestionGridContainer.appendChild(gridItem);
    }
}

function renderizarControlesPaginacao(totalQuestoes) {
    if (!elPaginacaoControles) return;
    elPaginacaoControles.innerHTML = ''; // Limpa controles existentes
    const totalPaginas = Math.ceil(totalQuestoes / QUESTOES_POR_PAGINA_GRID);

    // Não mostra paginação se houver apenas uma página ou nenhuma
    if (totalPaginas <= 1) {
         elPaginacaoControles.style.display = 'none';
         return;
    }

    elPaginacaoControles.style.display = 'flex'; // Mostra a área de paginação

    const criarBotao = (texto, paginaDestino, isDisabled = false, isCurrent = false, isEllipsis = false, ariaLabel = '') => {
        if (isEllipsis) {
            const span = document.createElement('span');
            span.textContent = texto;
            span.setAttribute('aria-hidden', 'true'); // Esconde de leitores de tela
            span.classList.add('paginacao-ellipsis'); // Classe para estilização opcional
            return span;
        }

        const btn = document.createElement('button');
        btn.textContent = texto;
        btn.disabled = isDisabled || isCurrent; // Desabilita se for a atual ou explicitamente desabilitado

        if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);

        if (isCurrent) {
            btn.classList.add('pagina-atual');
            btn.setAttribute('aria-current', 'page'); // Indica a página atual para acessibilidade
        } else if (!isDisabled) {
            // Só adiciona o clique se não estiver desabilitado ou atual
            btn.onclick = () => mudarPaginaGrid(paginaDestino);
        }
        return btn;
    };

    // Botão Anterior ('«')
    elPaginacaoControles.appendChild(criarBotao('«', paginaAtualGrid - 1, paginaAtualGrid === 1, false, false, 'Página anterior da grade'));

    // Lógica para exibir números e elipses (...)
    const maxVisibleButtons = 5; // Máximo de botões numéricos visíveis (excluindo primeiro/último e elipses)
    const halfVisible = Math.floor(maxVisibleButtons / 2);

    if (totalPaginas <= maxVisibleButtons + 2) { // Se cabe tudo sem elipses complexas
        for (let i = 1; i <= totalPaginas; i++) {
            elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`));
        }
    } else { // Lógica com elipses
        // Primeira página sempre visível
        elPaginacaoControles.appendChild(criarBotao(1, 1, false, paginaAtualGrid === 1, false, 'Ir para página 1 da grade'));

        // Elipse inicial?
        if (paginaAtualGrid > halfVisible + 2) {
            elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true)); // Elipse desabilitada
        }

        // Números do meio
        let startPage = Math.max(2, paginaAtualGrid - halfVisible);
        let endPage = Math.min(totalPaginas - 1, paginaAtualGrid + halfVisible);

        // Ajustes para não sobrepor elipses com primeiro/último
        if (paginaAtualGrid <= halfVisible + 1) { // Perto do início
            endPage = Math.min(totalPaginas - 1, maxVisibleButtons);
        }
        if (paginaAtualGrid >= totalPaginas - halfVisible) { // Perto do fim
            startPage = Math.max(2, totalPaginas - maxVisibleButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
             elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`));
        }

        // Elipse final?
        if (paginaAtualGrid < totalPaginas - halfVisible - 1) {
             elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true)); // Elipse desabilitada
        }

        // Última página sempre visível
        elPaginacaoControles.appendChild(criarBotao(totalPaginas, totalPaginas, false, paginaAtualGrid === totalPaginas, false, `Ir para página ${totalPaginas} da grade`));
    }

    // Botão Próximo ('»')
    elPaginacaoControles.appendChild(criarBotao('»', paginaAtualGrid + 1, paginaAtualGrid === totalPaginas, false, false, 'Próxima página da grade'));
}


function mudarPaginaGrid(novaPagina) {
     const totalPaginas = Math.ceil(perguntasFiltradas.length / QUESTOES_POR_PAGINA_GRID);
     // Verifica se a nova página é válida e diferente da atual
     if (novaPagina >= 1 && novaPagina <= totalPaginas && novaPagina !== paginaAtualGrid) {
         paginaAtualGrid = novaPagina;
         renderizarGridEPaginacao(); // Renderiza a nova página e os controles
     }
}

function atualizarGridEstilos(indiceAtualGlobal) {
    if (!elQuestionGridContainer || !perguntasFiltradas) return;

    const items = elQuestionGridContainer.querySelectorAll('.grid-item');
    items.forEach(item => {
        const itemIndexGlobal = parseInt(item.dataset.index, 10); // Índice global (base 0) da pergunta

        if (isNaN(itemIndexGlobal) || itemIndexGlobal < 0 || itemIndexGlobal >= perguntasFiltradas.length) {
             console.warn("Item da grade com índice inválido:", item.dataset.index);
             return; // Pula item inválido
        }

        const pergunta = perguntasFiltradas[itemIndexGlobal];
        // Limpa classes de estado anteriores
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect');

        // Adiciona classe de estado (correto/incorreto) se já foi respondida
        if (pergunta?.hasOwnProperty('respostaDada')) {
            const classeEstado = pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect';
            item.classList.add(classeEstado);
        }

        // Adiciona classe se for a questão atualmente exibida
        if (itemIndexGlobal === indiceAtualGlobal) {
            item.classList.add('grid-item--current');
        }
    });
}


function irParaQuestao(indice) {
    clearTimeout(autoAvancoTimeoutId); // Cancela auto avanço se houver
    autoAvancoTimeoutId = null;

    if (perguntasFiltradas && indice >= 0 && indice < perguntasFiltradas.length) {
        perguntaAtual = indice;
        carregarPergunta(); // Carrega a pergunta no índice especificado
    } else {
        console.error(`Tentativa de ir para questão inválida: índice ${indice}`);
        // Opcional: Mostrar um aviso ao usuário ou manter na questão atual
    }
}

// --- Funções Principais do Quiz ---

function atualizarFiltroECarregarPerguntas() {
    if (!filtroCheckboxesContainer || !elQuizSection) {
        console.error("Erro: Elementos de filtro ou quiz não encontrados para atualizar.");
        mostrarAviso("Erro ao configurar o quiz. Tente recarregar.");
        return;
    }

    clearTimeout(autoAvancoTimeoutId); // Cancela auto avanço pendente
    autoAvancoTimeoutId = null;
    limparAviso(); // Limpa avisos anteriores

    categoriasSelecionadas = obterCategoriasSelecionadas();
    perguntasFiltradas = filtrarPerguntas(perguntas, categoriasSelecionadas);

    reiniciarEstadoQuiz(); // Reseta pontuação, índice da questão atual e estado das perguntas
    paginaAtualGrid = 1; // Volta para a primeira página da grid

    renderizarGridEPaginacao(); // Renderiza a grid (pode ficar oculta dependendo do aviso)
    setTimeout(atualizarSetasScrollCategorias, 100); // Atualiza setas após renderização

    // Garante que o resultado anterior esteja oculto
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    // Esconde o quiz antes de decidir se mostra ele ou um aviso
    elQuizSection.style.display = 'none';

    exibirQuizOuAviso(perguntasFiltradas, categoriasSelecionadas); // Decide o que mostrar
    atualizarBarraProgresso(); // Atualiza a barra (deve ficar oculta se não houver quiz)
}

function filtrarPerguntas(listaCompleta, categoriasFiltro) {
    let filtradas = [];
     if (!Array.isArray(listaCompleta)) {
         console.error('ERRO FATAL: A variável "perguntas" não é um array!');
         mostrarAviso("Erro interno ao processar perguntas.");
         return []; // Retorna array vazio em caso de erro
     }

    // Filtra se houver categorias selecionadas
    if (categoriasFiltro.length > 0) {
        filtradas = listaCompleta.filter(p =>
            p.categorias && // Verifica se a pergunta tem a propriedade 'categorias'
            Array.isArray(p.categorias) && // Verifica se 'categorias' é um array
            p.categorias.some(cat => categoriasFiltro.includes(cat)) // Verifica se alguma categoria da pergunta está na lista de filtros
        );
    } else {
        // Se NENHUMA categoria está selecionada (exceto "Todas"), não retorna nenhuma pergunta
        // (O caso "Todas" é tratado pela lógica que seleciona todas as outras)
         filtradas = [];
    }

    // IMPORTANTE: Limpa o estado 'respostaDada' das perguntas filtradas antes de retorná-las
    // Isso garante que um novo quiz comece sem respostas pré-marcadas
    filtradas.forEach(p => delete p.respostaDada);

    // Opcional: Embaralhar as perguntas filtradas
    // shuffleArray(filtradas);

    return filtradas;
}

// Função para reiniciar o estado GERAL do quiz (pontuação, índice, estado das perguntas)
function reiniciarEstadoQuiz() {
    perguntaAtual = 0; // Volta para a primeira questão
    usuario.resetarContadores(); // Zera acertos, erros e pontos no objeto Usuario
    atualizar_pontuacao(); // Atualiza a exibição da pontuação na UI

    // LIMPA O ESTADO 'respostaDada' de TODAS as perguntas no array filtrado atual.
    // Isso é crucial para que o quiz possa ser refeito com as mesmas perguntas.
    if (perguntasFiltradas && Array.isArray(perguntasFiltradas)) {
        perguntasFiltradas.forEach(p => delete p.respostaDada);
    }
    // Limpa também o timeout de avanço automático, se houver
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;
}

function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    limparAviso(); // Garante que não haja avisos antigos

    if (perguntasParaExibir.length > 0) {
        // Há perguntas, então inicia o quiz
        elQuizSection.style.display = 'flex'; // Mostra a seção do quiz
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'block'; // Mostra o botão Encerrar
        carregarPergunta(); // Carrega a primeira pergunta (índice 0)
        renderizarGridEPaginacao(); // Mostra a grid e paginação
        atualizarBarraProgresso(); // Mostra a barra de progresso
    } else {
        // Não há perguntas para exibir, mostra um aviso apropriado
        const temCheckboxesDeCategoria = elFiltroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;

        if (categoriasAtivas.length === 0 && temCheckboxesDeCategoria) {
            mostrarAviso("Selecione pelo menos uma categoria para começar o quiz.");
        } else if (categoriasAtivas.length > 0) {
            mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
        } else if (!temCheckboxesDeCategoria) {
             mostrarAviso("Nenhuma categoria disponível ou erro ao carregar categorias.");
        } else {
             mostrarAviso("Selecione uma categoria para iniciar."); // Fallback
        }

        // Esconde elementos do quiz ativo
        if(elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if(elPaginacaoControles) elPaginacaoControles.style.display = 'none';
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
        if(elProgressContainer) elProgressContainer.style.display = 'none';
        if(elProgressText) elProgressText.style.display = 'none';
        if(elQuizSection) elQuizSection.style.display = 'none';
    }
}

function carregarPergunta() {
    // Verifica se os elementos essenciais existem e se há perguntas filtradas
    if (!elementosEssenciaisQuizExistem() || !perguntasFiltradas || perguntasFiltradas.length === 0) {
        console.log("carregarPergunta: Elementos ausentes ou sem perguntas filtradas.");
        // Se não houver perguntas, pode ser que o usuário desmarcou todas as categorias
        // A função exibirQuizOuAviso já deve ter tratado isso.
        // Poderia, opcionalmente, mostrar o resultado final se chegou aqui por erro inesperado.
        // mostrarResultadoFinal(); // Descomente se quiser forçar o resultado em caso de erro aqui
        return;
    }

    // Verifica se o índice da pergunta atual é válido
    if (perguntaAtual < 0 || perguntaAtual >= perguntasFiltradas.length) {
        console.warn(`Índice da pergunta (${perguntaAtual}) fora dos limites [0, ${perguntasFiltradas.length - 1}]. Mostrando resultado final.`);
        mostrarResultadoFinal();
        return;
    }

    // Verifica se a página da grid precisa ser atualizada
    const paginaNecessaria = Math.floor(perguntaAtual / QUESTOES_POR_PAGINA_GRID) + 1;
    if (paginaNecessaria !== paginaAtualGrid) {
        // Muda para a página correta da grid ANTES de atualizar os estilos
        mudarPaginaGrid(paginaNecessaria);
    } else {
        // Se já está na página correta, apenas atualiza os estilos da grid
         atualizarGridEstilos(perguntaAtual);
    }


    // Garante que a seção do quiz esteja visível
    elQuizSection.style.display = 'flex';

    // Atualiza UI relacionada à navegação (progresso, botões, grid)
    atualizarUINavegacaoQuiz();

    const pergunta = perguntasFiltradas[perguntaAtual];
    if (!pergunta) {
        console.error(`Erro crítico: Pergunta no índice ${perguntaAtual} é indefinida.`);
        mostrarAviso("Erro ao carregar dados da pergunta.");
        mostrarResultadoFinal(); // Encerra o quiz em caso de erro grave
        return;
    }

    limparAreaPergunta(); // Limpa respostas e imagem da pergunta anterior
    preencherDetalhesQuestao(pergunta, perguntaAtual); // Preenche texto, ID, categoria
    exibirImagemQuestao(pergunta.imagem, perguntaAtual); // Mostra imagem se houver
    criarBotoesResposta(pergunta); // Cria os botões de resposta
    configurarBotoesNavegacao(perguntaAtual, perguntasFiltradas.length); // Configura botões Prev/Next
}


function elementosEssenciaisQuizExistem() {
    const ok = elQuizSection && elRespostasContainer && elPerguntaTexto && elIdQuestao && elCategoriaTitulo && elReferencia && elNavigationButtons && elPrevBtn && elNextBtn && elProgressBarFill && elProgressText && elProgressContainer && elQuestionGridContainer && elPaginacaoControles && elPontuacao && elAcertosNum && elErrosNum;
     if (!ok) {
         console.error("Erro crítico: Elementos essenciais da UI do quiz não foram encontrados no DOM. Verifique os IDs e classes no HTML.");
         // Tenta recachear, pode ajudar em alguns casos raros
         if (!cacheDOMelements()) {
             alert("Erro grave na interface do quiz. Por favor, recarregue a página.");
         }
     }
     return ok;
}

function atualizarUINavegacaoQuiz() {
    clearTimeout(autoAvancoTimeoutId); // Cancela qualquer auto avanço pendente
    autoAvancoTimeoutId = null;
    atualizarBarraProgresso(); // Atualiza a barra de progresso
    // Note: atualizarGridEstilos agora é chamado dentro de carregarPergunta ou mudarPaginaGrid
    // para garantir que a página correta esteja visível antes de estilizar.
    // atualizarGridEstilos(perguntaAtual);
}

function limparAreaPergunta() {
    if (elRespostasContainer) elRespostasContainer.innerHTML = ''; // Limpa botões de resposta
    if (elPerguntaImagem) {
        elPerguntaImagem.style.display = 'none'; // Esconde a imagem
        elPerguntaImagem.src = ""; // Remove a fonte para liberar memória (opcional)
        elPerguntaImagem.alt = ""; // Limpa o texto alternativo
    }
    // Limpa texto da pergunta e referência (opcional, preencherDetalhesQuestao sobrescreve)
    // if (elPerguntaTexto) elPerguntaTexto.textContent = '';
    // if (elReferencia) elReferencia.textContent = '';
}


function preencherDetalhesQuestao(pergunta, indice) {
    // Define o título da categoria exibido
    let tituloCat = "Questão"; // Padrão
    if (pergunta.categorias && pergunta.categorias.length > 0) {
        // Usa a primeira categoria da pergunta, se disponível
        tituloCat = pergunta.categorias[0];
    } else if (categoriasSelecionadas.length === 1) {
        // Se só uma categoria foi selecionada no filtro, usa ela
        tituloCat = categoriasSelecionadas[0];
    }
    // Atualiza os elementos da UI
    if (elCategoriaTitulo) elCategoriaTitulo.innerText = tituloCat;
    if (elIdQuestao) elIdQuestao.innerText = indice + 1; // Exibe número da questão (base 1)
    if (elPerguntaTexto) elPerguntaTexto.textContent = pergunta.pergunta;
    if (elReferencia) elReferencia.textContent = `Referência: ${pergunta.referencia || 'N/A'}`; // Exibe referência ou 'N/A'
}

function exibirImagemQuestao(urlImagem, indice) {
    if (elPerguntaImagem) {
        if (urlImagem && typeof urlImagem === 'string' && urlImagem.trim() !== "") {
            elPerguntaImagem.src = urlImagem;
            elPerguntaImagem.alt = `Imagem ilustrativa da questão ${indice + 1}`;
            elPerguntaImagem.style.display = 'block'; // Mostra o elemento img
            // Tratamento de erro caso a imagem não carregue
            elPerguntaImagem.onerror = () => {
                elPerguntaImagem.style.display = 'none'; // Esconde se der erro
                console.warn(`Erro ao carregar imagem da questão ${indice + 1}: ${urlImagem}`);
            };
             elPerguntaImagem.onload = () => {
                // Opcional: fazer algo quando a imagem carrega com sucesso
            };
        } else {
            // Se não há URL de imagem, garante que esteja escondido
            elPerguntaImagem.style.display = 'none';
        }
    }
}

function criarBotoesResposta(pergunta) {
    if (!elRespostasContainer) return; // Sai se o container não existe
    elRespostasContainer.innerHTML = ''; // Limpa respostas anteriores

    if (!pergunta.respostas || !Array.isArray(pergunta.respostas) || pergunta.respostas.length === 0) {
        console.error(`Pergunta ${pergunta.id || perguntaAtual} não possui um array de respostas válido.`);
        elRespostasContainer.innerHTML = '<p style="color: red;">Erro: Opções de resposta não encontradas para esta pergunta.</p>';
        // Desabilita navegação se não há como responder? (Opcional)
        // if(elNextBtn) elNextBtn.disabled = true;
        return;
    }

    const jaRespondida = pergunta.hasOwnProperty('respostaDada');

    // Cria um botão para cada resposta
    pergunta.respostas.forEach((respostaTexto) => {
        const p = document.createElement('p'); // Ou button, se preferir semanticamente
        p.classList.add('answer');
        p.textContent = respostaTexto;
        p.setAttribute('role', 'button'); // Melhora acessibilidade se usar <p>
        p.tabIndex = 0; // Permite focar com Tab

        if (jaRespondida) {
            // Se a pergunta já foi respondida antes (ex: voltando com Prev)
            marcarRespostaComoJaFeita(p, pergunta, respostaTexto);
        } else {
            // Se é a primeira vez vendo a pergunta nesta sessão do quiz
            p.onclick = () => verificarResposta(p, pergunta);
            // Adiciona evento para tecla Enter/Espaço para acessibilidade
            p.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); // Previne rolagem da página com Espaço
                    verificarResposta(p, pergunta);
                }
            };
        }
        elRespostasContainer.appendChild(p);
    });
}

// Função auxiliar para marcar respostas quando o usuário volta a uma questão já respondida
function marcarRespostaComoJaFeita(elementoResposta, pergunta, textoDaResposta) {
    elementoResposta.onclick = null; // Remove clique
    elementoResposta.onkeydown = null; // Remove keydown
    elementoResposta.classList.add('answered'); // Marca como respondida (estilo base)
    elementoResposta.style.cursor = 'default'; // Muda cursor
    elementoResposta.tabIndex = -1; // Remove do foco Tab

    // Aplica estilo correto/incorreto
    if (textoDaResposta === pergunta.correta) {
        elementoResposta.classList.add('correct');
    } else if (textoDaResposta === pergunta.respostaDada) {
        // Marca como incorreta APENAS a que o usuário selecionou errado
        elementoResposta.classList.add('incorrect');
    }
    // Não marca outras opções incorretas, apenas a correta e a selecionada (se errada)
}

function configurarBotoesNavegacao(indiceAtual, totalPerguntas) {
     // Verifica se os botões existem
     if (!elNavigationButtons || !elPrevBtn || !elNextBtn) {
         console.warn("Botões de navegação (Prev/Next) não encontrados.");
         // Tenta recachear se eles sumiram inesperadamente
         if (elQuizSection) {
             elNavigationButtons = elQuizSection.querySelector('.navigation-buttons');
             if (elNavigationButtons) {
                 elPrevBtn = elNavigationButtons.querySelector('#prev-btn');
                 elNextBtn = elNavigationButtons.querySelector('#next-btn');
             }
         }
         // Se ainda não encontrou, retorna para evitar erros
         if (!elPrevBtn || !elNextBtn) return;
     }

    // Mostra a área dos botões
    elNavigationButtons.style.display = 'flex';

    // Habilita/desabilita botão Anterior
    elPrevBtn.disabled = indiceAtual === 0;

    // Configura botão Próximo/Ver Resultado
    elNextBtn.disabled = false; // Habilita por padrão (será desabilitado se a questão não for respondida)
    if (indiceAtual === totalPerguntas - 1) {
        elNextBtn.innerText = 'Ver Resultado';
         // Desabilita se a última questão AINDA não foi respondida
         if (!perguntasFiltradas[indiceAtual]?.hasOwnProperty('respostaDada')) {
            // elNextBtn.disabled = true; // Descomente se quiser forçar resposta na última
         }
    } else {
        elNextBtn.innerText = 'Próxima';
         // Desabilita se a questão atual AINDA não foi respondida
        if (!perguntasFiltradas[indiceAtual]?.hasOwnProperty('respostaDada')) {
            // elNextBtn.disabled = true; // Descomente se quiser forçar resposta antes de avançar
        }
    }
}

function verificarResposta(elementoClicado, pergunta) {
     // Impede múltiplas respostas para a mesma questão
     if (pergunta.hasOwnProperty('respostaDada') || !elementoClicado || !elRespostasContainer) {
         return;
     }
     clearTimeout(autoAvancoTimeoutId); // Cancela auto-avanço anterior, se houver

     const respostaSelecionada = elementoClicado.textContent;
     pergunta.respostaDada = respostaSelecionada; // Armazena a resposta dada no objeto da pergunta

     desabilitarRespostas(); // Desabilita todos os botões de resposta
     aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada); // Aplica estilos correct/incorrect
     atualizarEstadoAposResposta(pergunta, respostaSelecionada); // Atualiza score
     atualizarGridEstilos(perguntaAtual); // Atualiza a cor na grid
     // Habilita o botão próximo/resultado agora que a resposta foi dada
     if(elNextBtn) elNextBtn.disabled = false;

     // Agenda o avanço automático para a próxima questão ou resultado
     agendarProximaQuestao(1500); // Avança após 1.5 segundos
 }

function desabilitarRespostas() {
    const respostas = elRespostasContainer.querySelectorAll('.answer');
    respostas.forEach(r => {
        r.onclick = null; // Remove handler de clique
        r.onkeydown = null; // Remove handler de teclado
        r.classList.add('answered'); // Adiciona classe para estilo de respondida/desabilitada
        r.style.cursor = 'default';
        r.tabIndex = -1; // Remove da navegação por Tab
    });
}

function aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada) {
     const ehCorreta = respostaSelecionada === pergunta.correta;

     // Marca a resposta clicada como correta ou incorreta
     elementoClicado.classList.add(ehCorreta ? "correct" : "incorrect");

     // Se a resposta foi incorreta, destaca também qual era a correta
     if (!ehCorreta) {
         const todasRespostas = elRespostasContainer.querySelectorAll('.answer');
         todasRespostas.forEach(elResposta => {
             if (elResposta.textContent === pergunta.correta) {
                 elResposta.classList.add('correct'); // Mostra a correta
             }
         });
     }
}

function atualizarEstadoAposResposta(pergunta, respostaSelecionada) {
    if (respostaSelecionada === pergunta.correta) {
        usuario.acertos += 1;
    } else {
        usuario.erros += 1;
    }
    atualizar_pontuacao(); // Atualiza a exibição do score na UI
}

function agendarProximaQuestao(delayMs) {
    // Garante que não haja múltiplos timeouts rodando
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = setTimeout(proximaPergunta, delayMs);
}

function proximaPergunta() {
    clearTimeout(autoAvancoTimeoutId); // Limpa o timeout agendado
    autoAvancoTimeoutId = null;

    if (perguntaAtual < perguntasFiltradas.length - 1) {
        // Ainda há perguntas
        perguntaAtual++;
        carregarPergunta();
    } else {
        // Chegou ao final do quiz
        mostrarResultadoFinal();
    }
}

function perguntaAnterior() {
    clearTimeout(autoAvancoTimeoutId); // Cancela avanço automático se clicar em voltar
    autoAvancoTimeoutId = null;

    if (perguntaAtual > 0) {
        perguntaAtual--;
        carregarPergunta(); // Carrega a pergunta anterior
    }
}

function mostrarResultadoFinal() {
    clearTimeout(autoAvancoTimeoutId); // Garante que não avance automaticamente para cá
    autoAvancoTimeoutId = null;

    // Esconde elementos do quiz ativo
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none'; // Esconde avisos
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none'; // Esconde grid
    if (elPaginacaoControles) elPaginacaoControles.style.display = 'none'; // Esconde paginação da grid
    if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none'; // Esconde botão Encerrar

    // Mostra o card de resultado
    if (elResultadoCard) {
        elResultadoCard.style.display = 'block';
        preencherMensagemFinal(); // Preenche os dados no card
        // Foca no título do resultado para acessibilidade
        const tituloResultado = elResultadoCard.querySelector('.resultado-final-titulo');
        if (tituloResultado) tituloResultado.focus();
    }
    else {
        console.error("Card de resultado final não encontrado no DOM.");
        // Fallback: mostra um aviso com os resultados
        mostrarAviso(`Quiz Concluído! Pontuação Final: ${usuario.pontos} (Acertos: ${usuario.acertos}, Erros: ${usuario.erros})`);
    }
}

function preencherMensagemFinal() {
    // Verifica se os elementos necessários existem
    if (!elResultadoCard || !filtroCheckboxesContainer) {
         console.warn("Não é possível preencher mensagem final: card de resultado ou container de filtros ausente.");
         return;
     }

    const tituloEl = elResultadoCard.querySelector('.resultado-final-titulo');
    const pontuacaoEl = elResultadoCard.querySelector('.pontos-valor');
    const acertosEl = elResultadoCard.querySelector('.acertos-valor');
    const errosEl = elResultadoCard.querySelector('.erros-valor');

    if (!tituloEl || !pontuacaoEl || !acertosEl || !errosEl) {
        console.error("Elementos internos do card de resultado (título, pontos, acertos, erros) não encontrados.");
        return;
    }

    // Define o título com base nas categorias selecionadas
    tituloEl.textContent = gerarTituloResultadoFinal();
    // Preenche os valores
    pontuacaoEl.textContent = usuario.pontos;
    acertosEl.textContent = usuario.acertos;
    errosEl.textContent = usuario.erros;
}

function gerarTituloResultadoFinal() {
    // Tenta obter os checkboxes para determinar o contexto do quiz
    const todosCheckboxesCategorias = filtroCheckboxesContainer?.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:not([value="Todas"])');
    const checkboxTodas = filtroCheckboxesContainer?.querySelector('#filtro-checkboxes-scroll input[value="Todas"]');
    const categoriasAtivas = obterCategoriasSelecionadas(); // Pega as categorias que FORAM usadas no quiz finalizado

    if (!todosCheckboxesCategorias || !checkboxTodas) {
         // Se não encontrar os checkboxes, retorna um título genérico
         return "Quiz Concluído!";
     }

    const totalCategoriasDisponiveis = todosCheckboxesCategorias.length;

    if (categoriasAtivas.length === 1) {
        // Se o quiz foi feito com apenas uma categoria
        return `Quiz de "${categoriasAtivas[0]}" Concluído!`;
    } else if (categoriasAtivas.length === totalCategoriasDisponiveis && totalCategoriasDisponiveis > 0) {
         // Se todas as categorias disponíveis foram selecionadas
         // (Verificar se o checkbox "Todas" estava marcado pode ser redundante aqui,
         // mas garante que a intenção era incluir tudo)
         if (checkboxTodas.checked) {
            return `Quiz de Todas as Categorias Concluído!`;
         } else {
            // Caso raro: todas selecionadas individualmente
            return `Quiz (Todas as Categorias) Concluído!`;
         }
    } else if (categoriasAtivas.length > 1) {
        // Se foi um quiz com múltiplas categorias, mas não todas
        return `Quiz de Múltiplas Categorias Concluído!`;
    } else {
        // Se NENHUMA categoria estava ativa (caso de erro ou quiz vazio)
        return "Quiz Finalizado!"; // Ou um título indicando o problema
    }
}


function atualizar_pontuacao() {
    if (elPontuacao) elPontuacao.textContent = usuario.pontos;
    if (elAcertosNum) elAcertosNum.textContent = usuario.acertos;
    if (elErrosNum) elErrosNum.textContent = usuario.erros;
}

// --- Funções do Modal de Confirmação --- <<< NOVO BLOCO
function showConfirmEncerrarModal() {
    if (elConfirmEncerrarOverlay) {
        elConfirmEncerrarOverlay.style.display = 'flex'; // Garante que está como flex antes da animação
        // Força reflow para garantir a transição
        void elConfirmEncerrarOverlay.offsetWidth;
        elConfirmEncerrarOverlay.classList.add('visible');
        // Foca no botão de cancelar para acessibilidade
        if(elCancelEncerrarBtn) elCancelEncerrarBtn.focus();
    }
}

function hideConfirmEncerrarModal() {
    if (elConfirmEncerrarOverlay) {
        elConfirmEncerrarOverlay.classList.remove('visible');
         // O CSS cuida de esconder com display:none após a transição de visibilidade
         // Se precisar esconder manualmente por algum motivo:
         // setTimeout(() => { if(!elConfirmEncerrarOverlay.classList.contains('visible')) elConfirmEncerrarOverlay.style.display = 'none'; }, 300); // 300ms = duração da transição de opacidade/escala
    }
}
// --- Fim Funções do Modal ---

// --- Carregamento Inicial e Event Listeners ---

async function carregarPerguntasJSON() {
    try {
        // Adiciona timestamp para evitar cache agressivo do browser
        const timestamp = Date.now();
        const response = await fetch(`assets/data/questions.json?t=${timestamp}`);

        if (!response.ok) {
            throw new Error(`Falha ao buscar perguntas: ${response.status} ${response.statusText}`);
        }

        // Verifica o tipo de conteúdo (opcional mas bom para depuração)
        const contentType = response.headers.get("content-type");
        if (!contentType || !(contentType.includes("application/json") || contentType.includes("text/plain"))) {
            console.warn(`Tipo de conteúdo inesperado ao buscar perguntas: ${contentType}`);
        }

        const data = await response.json();

        // Validação básica dos dados recebidos
        if (!Array.isArray(data)) {
            throw new Error("Formato de dados inválido recebido (esperava um Array).");
        }
        // Validação mais profunda (opcional): verificar se os itens têm as propriedades esperadas
        // if (data.length > 0 && (!data[0].pergunta || !data[0].respostas || !data[0].correta)) {
        //     throw new Error("Estrutura das perguntas no JSON parece inválida.");
        // }

        perguntas = data; // Armazena as perguntas globalmente
        console.log(`Perguntas carregadas com sucesso (${perguntas.length} perguntas).`);
        return true; // Indica sucesso

    } catch (error) {
        console.error("Erro CRÍTICO durante o carregamento das perguntas:", error);
        // Tenta mostrar o erro na interface, se possível
        if (!avisoContainer || !avisoMensagem) {
             // Se os elementos de aviso não foram cacheados ainda, tenta cachear
             cacheDOMelements();
        }
        if (avisoContainer && avisoMensagem) {
            // Mostra o erro na seção de questões (ou outra seção visível)
            mostrarSecao('questoes-section'); // Garante que a seção correta esteja visível
            mostrarAviso(`Falha ao carregar as perguntas: ${error.message}. Verifique o arquivo JSON e a conexão.`);
        } else {
            // Fallback se a UI não estiver pronta
            alert(`Falha crítica ao carregar as perguntas: ${error.message}`);
        }
        return false; // Indica falha
    }
}

function configurarEventListeners() {
    // Navegação Principal (Abas Início/Questões)
    document.querySelectorAll('.navbar .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Previne comportamento padrão do link
            const clickedLink = e.target.closest('a'); // Garante que pegou o link mesmo clicando no texto/ícone
            if (!clickedLink) return;

            const targetSectionId = clickedLink.dataset.section;
            if (targetSectionId && targetSectionId !== secaoAtual) {
                // Remove a classe ativa de outros links
                document.querySelectorAll('.navbar .nav-link.active').forEach(activeLink => {
                    activeLink.classList.remove('active');
                });
                // Adiciona classe ativa ao link clicado
                clickedLink.classList.add('active');
                // Mostra a seção correspondente
                mostrarSecao(targetSectionId);
            }
        });
    });

    // Filtro de Categorias (Checkboxes)
    if (filtroCheckboxesContainer) {
        // Usa delegação de eventos no container pai para performance
        filtroCheckboxesContainer.addEventListener('change', (e) => {
            // Verifica se o evento veio de um checkbox dentro da área rolável
            if (e.target?.type === 'checkbox' && e.target.closest('#filtro-checkboxes-scroll')) {
                handleCheckboxChange(e.target); // Lógica para marcar/desmarcar "Todas"
                atualizarFiltroECarregarPerguntas(); // Recarrega as perguntas com base nos filtros
                setTimeout(atualizarSetasScrollCategorias, 100); // Atualiza visibilidade das setas
            }
        });
    } else {
        console.warn("Container de filtros de categoria não encontrado. Filtros não funcionarão.");
    }

    // Botões de Navegação do Quiz (Anterior/Próximo)
    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior);
    if (elNextBtn) elNextBtn.addEventListener('click', proximaPergunta);

    // Setas de Rolagem das Categorias
    if (elCatScrollLeft) elCatScrollLeft.addEventListener('click', () => rolarCategorias('left'));
    if (elCatScrollRight) elCatScrollRight.addEventListener('click', () => rolarCategorias('right'));

    // Atualiza Setas ao Rolar a Div de Categorias manualmente
    if (elFiltroCheckboxesScroll) {
        // Usa { passive: true } para melhor performance de rolagem
        elFiltroCheckboxesScroll.addEventListener('scroll', atualizarSetasScrollCategorias, { passive: true });
    }

    // Atualiza Setas ao Redimensionar a Janela
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        // Adiciona um pequeno delay para evitar disparos múltiplos durante o redimensionamento
        resizeTimeout = setTimeout(atualizarSetasScrollCategorias, 150);
    });

    // --- Event Listeners do Modal de Confirmação --- <<< ALTERADO / ADICIONADO
    // Botão Encerrar Sessão (Agora abre o Modal)
    if (elBtnEncerrarSessao) {
        elBtnEncerrarSessao.addEventListener('click', () => {
            showConfirmEncerrarModal(); // Chama a função para mostrar o modal
        });
    } else {
        console.warn("Botão Encerrar Sessão (#btn-encerrar-sessao) não encontrado.")
    }

    // Botão Confirmar DENTRO do modal
    if (elConfirmEncerrarBtn) {
        elConfirmEncerrarBtn.addEventListener('click', () => {
            mostrarResultadoFinal(); // Ação de confirmação
            hideConfirmEncerrarModal(); // Esconde o modal
        });
    } else {
         console.warn("Botão Confirmar do Modal (#confirm-encerrar-btn) não encontrado.")
    }

    // Botão Cancelar DENTRO do modal
    if (elCancelEncerrarBtn) {
        elCancelEncerrarBtn.addEventListener('click', () => {
            hideConfirmEncerrarModal(); // Apenas esconde o modal
        });
    } else {
         console.warn("Botão Cancelar do Modal (#cancel-encerrar-btn) não encontrado.")
    }

     // Opcional: Fechar modal clicando fora (no overlay escuro)
     if (elConfirmEncerrarOverlay) {
         elConfirmEncerrarOverlay.addEventListener('click', (event) => {
             // Verifica se o clique foi no overlay e não no conteúdo do modal
             if (event.target === elConfirmEncerrarOverlay) {
                 hideConfirmEncerrarModal();
             }
         });
     } else {
          console.warn("Overlay do Modal (#confirm-encerrar-overlay) não encontrado.")
     }
    // --- Fim Event Listeners do Modal ---

    // Botão Recomeçar (No Card de Resultado)
    if (elBtnRecomecar) {
        elBtnRecomecar.addEventListener('click', reiniciarQuizCompleto);
    } else {
        // Aviso se o botão não foi encontrado (pode acontecer se cacheDOMelements falhar)
        console.warn("Botão Recomeçar (#btn-recomecar) não encontrado no DOM. A funcionalidade de recomeçar não estará disponível.");
    }
}


function handleCheckboxChange(changedCheckbox) {
     if (!elFiltroCheckboxesScroll) return; // Precisa da referência à área rolável

     const cbTodas = elFiltroCheckboxesScroll.querySelector('input[value="Todas"]');
     const outrosCheckboxes = elFiltroCheckboxesScroll.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');

     if (!cbTodas || !outrosCheckboxes) {
         console.error("Checkbox 'Todas' ou checkboxes de categoria não encontrados dentro de #filtro-checkboxes-scroll.");
         return;
     }

     if (changedCheckbox === cbTodas) {
         // Se o checkbox "Todas" foi alterado
         // Marca ou desmarca todos os outros checkboxes para corresponder
         outrosCheckboxes.forEach(cb => {
             cb.checked = cbTodas.checked;
         });
     } else {
         // Se um checkbox de categoria individual foi alterado
         // Verifica se TODOS os outros estão marcados para atualizar o "Todas"
         let todosMarcados = true;
         outrosCheckboxes.forEach(cb => {
             if (!cb.checked) {
                 todosMarcados = false;
             }
         });
         // Marca o checkbox "Todas" se todos os outros estiverem marcados, desmarca caso contrário
         cbTodas.checked = todosMarcados;
     }
}

// --- Função Reiniciar Quiz Completo ---
function reiniciarQuizCompleto() {
    if (!elResultadoCard || !filtroCheckboxesContainer) {
        console.error("Não foi possível reiniciar: Elementos essenciais (card de resultado ou filtro) não encontrados.");
        // Tenta recarregar a interface caso os elementos tenham sumido
        cacheDOMelements();
        if (!elResultadoCard || !filtroCheckboxesContainer) {
             alert("Erro ao tentar reiniciar o quiz. Por favor, recarregue a página.");
             return;
        }
    }

    // 1. Esconder o card de resultado
    elResultadoCard.style.display = 'none';

    // 2. Resetar estado e recarregar perguntas baseado nos filtros ATUAIS
    // A função atualizarFiltroECarregarPerguntas já faz o reset interno (reiniciarEstadoQuiz)
    // e decide se mostra o quiz ou um aviso (ex: nenhuma categoria selecionada).
    atualizarFiltroECarregarPerguntas();

    // 3. Rolar a tela para o topo da área de conteúdo principal ou filtros (Opcional)
    const mainContent = document.querySelector('#questoes-section .main-content');
    if (mainContent) {
        // Rola para o topo do conteúdo principal onde os filtros/quiz aparecem
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
         // Fallback: rola a janela inteira para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carrega os dados das perguntas do JSON
    const perguntasCarregadas = await carregarPerguntasJSON();

    // Só continua se as perguntas foram carregadas com sucesso
    if (perguntasCarregadas) {
        // 2. Busca e armazena referências aos elementos do DOM
        if (!cacheDOMelements()) {
            console.error("Erro Crítico: Falha ao encontrar elementos essenciais do DOM após carregar perguntas.");
            // Mostra um erro genérico se o cache falhar completamente
            // (mostrarAviso pode não funcionar se avisoContainer não foi encontrado)
            const body = document.querySelector('body');
            if (body) body.innerHTML = '<p style="color:red; padding: 20px;">Erro grave ao inicializar a interface. Por favor, recarregue a página ou contate o suporte.</p>';
            return; // Interrompe a inicialização
        }

        // 3. Gera os filtros de categoria na UI
        try {
            const categoriasUnicas = extrairCategoriasUnicas(perguntas);
            gerarCheckboxesCategoria(elFiltroCheckboxesScroll, categoriasUnicas);
            console.log("Filtros de categoria gerados.");
        } catch (error) {
            console.error("Erro ao gerar filtros de categoria:", error);
            mostrarAviso("Erro ao configurar os filtros de categoria.");
            // Não interrompe necessariamente, mas os filtros podem não funcionar
        }

        // 4. Configura todos os ouvintes de evento (clicks, changes, etc.)
        configurarEventListeners();

        // 5. Exibe a seção inicial padrão (ou a seção marcada como ativa no HTML)
        const linkAtivoInicial = document.querySelector('.navbar .nav-link.active');
        const secaoInicialId = linkAtivoInicial?.dataset.section || 'inicio-section'; // Usa 'inicio-section' como fallback
        mostrarSecao(secaoInicialId);

        // 6. Atualiza o estado visual das setas de rolagem das categorias (após um pequeno delay)
        setTimeout(atualizarSetasScrollCategorias, 150); // Delay para garantir renderização inicial
    } else {
        // Se as perguntas não carregaram, uma mensagem de erro já deve ter sido exibida por carregarPerguntasJSON
        console.error("Inicialização interrompida: Falha ao carregar perguntas.");
    }
});