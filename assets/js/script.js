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
        // Pontuação: +15 por acerto, -5 por erro (mínimo 0)
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
let elConfirmEncerrarOverlay, elConfirmEncerrarBtn, elCancelEncerrarBtn; // Elementos do Modal

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

    const criarCheckboxItem = (id, value, textoLabel, checked = false) => {
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

    containerElemento.appendChild(criarCheckboxItem('cat-todas', 'Todas', 'Todas', false));
    listaCategorias.forEach(categoria => {
        const idSeguro = `cat-${categoria.toLowerCase().replace(/\s+/g, '-')}`;
        containerElemento.appendChild(criarCheckboxItem(idSeguro, categoria, categoria, false));
    });
    setTimeout(atualizarSetasScrollCategorias, 100);
}

function obterCategoriasSelecionadas() {
    const selecionadas = [];
     if (!filtroCheckboxesContainer) return selecionadas;
    const checkboxesCategorias = filtroCheckboxesContainer.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:checked:not([value="Todas"])');
    checkboxesCategorias.forEach(cb => selecionadas.push(cb.value));
    return selecionadas;
}

// --- Funções para Rolagem das Categorias com Setas ---
function rolarCategorias(direcao) {
    if (!elFiltroCheckboxesScroll) return;
    const scrollAmount = elFiltroCheckboxesScroll.clientWidth * 0.8;
    elFiltroCheckboxesScroll.scrollBy({ left: direcao === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(atualizarSetasScrollCategorias, 400);
}


function atualizarSetasScrollCategorias() {
    if (!elFiltroCheckboxesScroll || !elCatScrollLeft || !elCatScrollRight) {
        if(elCatScrollLeft) { elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true; }
        if(elCatScrollRight) { elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true; }
        return;
    }
    const scrollLeft = Math.round(elFiltroCheckboxesScroll.scrollLeft);
    const scrollWidth = elFiltroCheckboxesScroll.scrollWidth;
    const clientWidth = elFiltroCheckboxesScroll.clientWidth;
    const epsilon = 1;
    const canScroll = scrollWidth > clientWidth + epsilon;

    if (!canScroll) {
        elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true;
        elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true;
    } else {
        elCatScrollLeft.disabled = scrollLeft <= 0;
        elCatScrollRight.disabled = scrollLeft + clientWidth >= scrollWidth - epsilon;
        elCatScrollLeft.style.pointerEvents = elCatScrollLeft.disabled ? 'none' : 'auto';
        elCatScrollRight.style.pointerEvents = elCatScrollRight.disabled ? 'none' : 'auto';
        elCatScrollLeft.style.opacity = '';
        elCatScrollRight.style.opacity = '';
    }
}

// --- Funções de Barra de Progresso ---
function atualizarBarraProgresso() {
    if (!elProgressContainer || !elProgressBarFill || !elProgressText) return;
    const quizAtivo = elQuizSection && (elQuizSection.style.display === 'flex' || elQuizSection.style.display === 'block');
    const temPerguntas = perguntasFiltradas && perguntasFiltradas.length > 0;
    if (quizAtivo && temPerguntas) {
        elProgressContainer.style.display = 'block'; elProgressText.style.display = 'block';
        const totalPerguntas = perguntasFiltradas.length;
        const numQuestaoAtualExibicao = Math.min(perguntaAtual + 1, totalPerguntas);
        const progressoPercentual = totalPerguntas > 0 ? (numQuestaoAtualExibicao / totalPerguntas) * 100 : 0;
        elProgressBarFill.style.width = `${progressoPercentual}%`;
        elProgressText.textContent = `${numQuestaoAtualExibicao} / ${totalPerguntas}`;
    } else {
        elProgressContainer.style.display = 'none'; elProgressText.style.display = 'none';
        if(elProgressBarFill) elProgressBarFill.style.width = `0%`;
        if(elProgressText) elProgressText.textContent = `0 / 0`;
    }
}


// --- Funções de Navegação de Seção ---
function mostrarSecao(idSecao) {
    if (!elQuizSection) {
        if (!cacheDOMelements()) {
             console.error("Falha ao mostrar seção - elementos do DOM não encontrados.");
             alert("Erro ao carregar a interface. Tente recarregar a página.");
             return;
        }
    }
    document.querySelectorAll('.main-section').forEach(s => s.style.display = 'none');
    const secaoParaMostrar = document.getElementById(idSecao);
    if (secaoParaMostrar) {
        secaoParaMostrar.style.display = 'flex';
        secaoAtual = idSecao;
        limparAviso();

        // Atualiza estado ativo em AMBAS as navbars
        document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => {
            activeLink.classList.remove('active');
            activeLink.removeAttribute('aria-current');
        });
        const topLinkAtivo = document.querySelector(`.navbar .nav-link[data-section="${idSecao}"]`);
        const bottomLinkAtivo = document.querySelector(`.bottom-navbar .bottom-nav-link[data-section="${idSecao}"]`);
        if(topLinkAtivo) {
            topLinkAtivo.classList.add('active');
            topLinkAtivo.setAttribute('aria-current', 'page');
        }
        if(bottomLinkAtivo) {
            bottomLinkAtivo.classList.add('active');
            bottomLinkAtivo.setAttribute('aria-current', 'page');
        }

        if (idSecao === 'questoes-section') {
            prepararSecaoQuestoes();
            setTimeout(atualizarSetasScrollCategorias, 150);
        } else {
            esconderElementosQuiz();
        }
        atualizarBarraProgresso();
    } else {
         console.error(`Seção com ID '${idSecao}' não encontrada.`);
    }
}

function prepararSecaoQuestoes() {
     if (elQuizSection) elQuizSection.style.display = 'none';
     if (elResultadoCard) elResultadoCard.style.display = 'none';
     if (avisoContainer) avisoContainer.style.display = 'none';
     atualizarFiltroECarregarPerguntas();
}

function esconderElementosQuiz() {
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    if (elPaginacaoControles) { elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none'; }
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
}


// --- Funções da Grade de Questões e Paginação ---
function renderizarGridEPaginacao() {
    if (!elQuestionGridContainer || !elPaginacaoControles || !perguntasFiltradas) {
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) { elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none'; }
        return;
    }
    if (perguntasFiltradas.length === 0) {
        elQuestionGridContainer.style.display = 'none';
        elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none';
        return;
    }
    elQuestionGridContainer.style.display = 'flex';
    renderizarItensDaPaginaGrid(paginaAtualGrid);
    renderizarControlesPaginacao(perguntasFiltradas.length);
    atualizarGridEstilos(perguntaAtual);
}


function renderizarItensDaPaginaGrid(pagina) {
    if (!elQuestionGridContainer) return;
    elQuestionGridContainer.innerHTML = '';
    const totalQuestoes = perguntasFiltradas.length;
    const inicio = (pagina - 1) * QUESTOES_POR_PAGINA_GRID;
    const fim = Math.min(inicio + QUESTOES_POR_PAGINA_GRID, totalQuestoes);
    for (let i = inicio; i < fim; i++) {
        const gridItem = document.createElement('button'); gridItem.classList.add('grid-item'); gridItem.textContent = i + 1; gridItem.dataset.index = i; gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`); gridItem.onclick = () => irParaQuestao(i);
        elQuestionGridContainer.appendChild(gridItem);
    }
}

function renderizarControlesPaginacao(totalQuestoes) {
    if (!elPaginacaoControles) return;
    elPaginacaoControles.innerHTML = '';
    const totalPaginas = Math.ceil(totalQuestoes / QUESTOES_POR_PAGINA_GRID);
    if (totalPaginas <= 1) { elPaginacaoControles.style.display = 'none'; return; }
    elPaginacaoControles.style.display = 'flex';
    const criarBotao = (texto, paginaDestino, isDisabled = false, isCurrent = false, isEllipsis = false, ariaLabel = '') => { /* ... código interno criarBotao ... */
        if (isEllipsis) { const span = document.createElement('span'); span.textContent = texto; span.setAttribute('aria-hidden', 'true'); span.classList.add('paginacao-ellipsis'); return span; }
        const btn = document.createElement('button'); btn.textContent = texto; btn.disabled = isDisabled || isCurrent; if (ariaLabel) btn.setAttribute('aria-label', ariaLabel); if (isCurrent) { btn.classList.add('pagina-atual'); btn.setAttribute('aria-current', 'page'); } else if (!isDisabled) { btn.onclick = () => mudarPaginaGrid(paginaDestino); } return btn;
    };
    elPaginacaoControles.appendChild(criarBotao('«', paginaAtualGrid - 1, paginaAtualGrid === 1, false, false, 'Página anterior da grade'));
    const maxVisibleButtons = 5; const halfVisible = Math.floor(maxVisibleButtons / 2);
    if (totalPaginas <= maxVisibleButtons + 2) { for (let i = 1; i <= totalPaginas; i++) elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`)); }
    else { elPaginacaoControles.appendChild(criarBotao(1, 1, false, paginaAtualGrid === 1, false, 'Ir para página 1 da grade')); if (paginaAtualGrid > halfVisible + 2) elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true)); let startPage = Math.max(2, paginaAtualGrid - halfVisible); let endPage = Math.min(totalPaginas - 1, paginaAtualGrid + halfVisible); if (paginaAtualGrid <= halfVisible + 1) endPage = Math.min(totalPaginas - 1, maxVisibleButtons); if (paginaAtualGrid >= totalPaginas - halfVisible) startPage = Math.max(2, totalPaginas - maxVisibleButtons + 1); for (let i = startPage; i <= endPage; i++) elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`)); if (paginaAtualGrid < totalPaginas - halfVisible - 1) elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true)); elPaginacaoControles.appendChild(criarBotao(totalPaginas, totalPaginas, false, paginaAtualGrid === totalPaginas, false, `Ir para página ${totalPaginas} da grade`)); }
    elPaginacaoControles.appendChild(criarBotao('»', paginaAtualGrid + 1, paginaAtualGrid === totalPaginas, false, false, 'Próxima página da grade'));
}

function mudarPaginaGrid(novaPagina) {
      const totalPaginas = Math.ceil(perguntasFiltradas.length / QUESTOES_POR_PAGINA_GRID);
     if (novaPagina >= 1 && novaPagina <= totalPaginas && novaPagina !== paginaAtualGrid) { paginaAtualGrid = novaPagina; renderizarGridEPaginacao(); }
}

function atualizarGridEstilos(indiceAtualGlobal) {
      if (!elQuestionGridContainer || !perguntasFiltradas) return;
    const items = elQuestionGridContainer.querySelectorAll('.grid-item');
    items.forEach(item => {
        const itemIndexGlobal = parseInt(item.dataset.index, 10);
        if (isNaN(itemIndexGlobal) || itemIndexGlobal < 0 || itemIndexGlobal >= perguntasFiltradas.length) return;
        const pergunta = perguntasFiltradas[itemIndexGlobal];
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect');
        if (pergunta?.hasOwnProperty('respostaDada')) { const classeEstado = pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect'; item.classList.add(classeEstado); }
        if (itemIndexGlobal === indiceAtualGlobal) { item.classList.add('grid-item--current'); }
    });
}

function irParaQuestao(indice) {
     clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;
    if (perguntasFiltradas && indice >= 0 && indice < perguntasFiltradas.length) { perguntaAtual = indice; carregarPergunta(); } else { console.error(`Tentativa de ir para questão inválida: índice ${indice}`); }
}

// --- Funções Principais do Quiz ---
function atualizarFiltroECarregarPerguntas() {
     if (!filtroCheckboxesContainer || !elQuizSection) return;
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; limparAviso();
    categoriasSelecionadas = obterCategoriasSelecionadas();
    perguntasFiltradas = filtrarPerguntas(perguntas, categoriasSelecionadas);
    reiniciarEstadoQuiz(); paginaAtualGrid = 1; renderizarGridEPaginacao(); setTimeout(atualizarSetasScrollCategorias, 100);
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    elQuizSection.style.display = 'none'; // Esconde antes
    exibirQuizOuAviso(perguntasFiltradas, categoriasSelecionadas);
    atualizarBarraProgresso();
}

function filtrarPerguntas(listaCompleta, categoriasFiltro) {
    let filtradas = []; if (!Array.isArray(listaCompleta)) { console.error('ERRO FATAL: "perguntas" não é array!'); mostrarAviso("Erro interno."); return []; }
    if (categoriasFiltro.length > 0) { filtradas = listaCompleta.filter(p => p.categorias && Array.isArray(p.categorias) && p.categorias.some(cat => categoriasFiltro.includes(cat))); } else { filtradas = []; }
    filtradas.forEach(p => delete p.respostaDada); /* shuffleArray(filtradas); */ return filtradas;
}

function reiniciarEstadoQuiz() {
    perguntaAtual = 0; usuario.resetarContadores(); atualizar_pontuacao();
    if (perguntasFiltradas && Array.isArray(perguntasFiltradas)) { perguntasFiltradas.forEach(p => delete p.respostaDada); }
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;
}

function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    limparAviso();
    if (perguntasParaExibir.length > 0) {
        elQuizSection.style.display = 'flex'; if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'block'; carregarPergunta(); renderizarGridEPaginacao(); atualizarBarraProgresso();
    } else {
        if(elQuizSection) elQuizSection.style.display = 'none'; if(elQuestionGridContainer) elQuestionGridContainer.style.display = 'none'; if(elPaginacaoControles) elPaginacaoControles.style.display = 'none'; if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none'; if(elProgressContainer) elProgressContainer.style.display = 'none'; if(elProgressText) elProgressText.style.display = 'none';
        const temCheckboxesDeCategoria = elFiltroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
        if (categoriasAtivas.length === 0 && temCheckboxesDeCategoria) mostrarAviso("Selecione pelo menos uma categoria para começar."); else if (categoriasAtivas.length > 0) mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s)."); else if (!temCheckboxesDeCategoria) mostrarAviso("Nenhuma categoria disponível."); else mostrarAviso("Selecione uma categoria para iniciar.");
    }
}

function carregarPergunta() {
    if (!elementosEssenciaisQuizExistem() || !perguntasFiltradas || perguntasFiltradas.length === 0) return;
    if (perguntaAtual < 0 || perguntaAtual >= perguntasFiltradas.length) { mostrarResultadoFinal(); return; }
    const paginaNecessaria = Math.floor(perguntaAtual / QUESTOES_POR_PAGINA_GRID) + 1; if (paginaNecessaria !== paginaAtualGrid) mudarPaginaGrid(paginaNecessaria); else atualizarGridEstilos(perguntaAtual);
    elQuizSection.style.display = 'flex'; atualizarUINavegacaoQuiz();
    const pergunta = perguntasFiltradas[perguntaAtual]; if (!pergunta) { console.error(`Erro: Pergunta ${perguntaAtual} indefinida.`); mostrarAviso("Erro ao carregar pergunta."); mostrarResultadoFinal(); return; }
    limparAreaPergunta(); preencherDetalhesQuestao(pergunta, perguntaAtual); exibirImagemQuestao(pergunta.imagem, perguntaAtual); criarBotoesResposta(pergunta); configurarBotoesNavegacao(perguntaAtual, perguntasFiltradas.length);
}

function elementosEssenciaisQuizExistem() {
     const ok = elQuizSection && elRespostasContainer && elPerguntaTexto && elIdQuestao && elCategoriaTitulo && elReferencia && elNavigationButtons && elPrevBtn && elNextBtn && elProgressBarFill && elProgressText && elProgressContainer && elQuestionGridContainer && elPaginacaoControles && elPontuacao && elAcertosNum && elErrosNum;
     if (!ok) { console.error("Erro crítico: Elementos essenciais da UI do quiz não encontrados."); if (!cacheDOMelements()) alert("Erro grave na interface. Recarregue."); } return ok;
}

function atualizarUINavegacaoQuiz() {
     clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; atualizarBarraProgresso();
}

function limparAreaPergunta() {
     if (elRespostasContainer) elRespostasContainer.innerHTML = ''; if (elPerguntaImagem) { elPerguntaImagem.style.display = 'none'; elPerguntaImagem.src = ""; elPerguntaImagem.alt = ""; }
}

function preencherDetalhesQuestao(pergunta, indice) {
    let tituloCat = "Questão"; if (pergunta.categorias && pergunta.categorias.length > 0) tituloCat = pergunta.categorias[0]; else if (categoriasSelecionadas.length === 1) tituloCat = categoriasSelecionadas[0];
    if (elCategoriaTitulo) elCategoriaTitulo.innerText = tituloCat; if (elIdQuestao) elIdQuestao.innerText = indice + 1; if (elPerguntaTexto) elPerguntaTexto.textContent = pergunta.pergunta; if (elReferencia) elReferencia.textContent = `Referência: ${pergunta.referencia || 'N/A'}`;
}

function exibirImagemQuestao(urlImagem, indice) {
    if (elPerguntaImagem) { if (urlImagem && typeof urlImagem === 'string' && urlImagem.trim() !== "") { elPerguntaImagem.src = urlImagem; elPerguntaImagem.alt = `Imagem ilustrativa da questão ${indice + 1}`; elPerguntaImagem.style.display = 'block'; elPerguntaImagem.onerror = () => { elPerguntaImagem.style.display = 'none'; console.warn(`Erro img questão ${indice + 1}`); }; } else { elPerguntaImagem.style.display = 'none'; } }
}

function criarBotoesResposta(pergunta) {
     if (!elRespostasContainer) return; elRespostasContainer.innerHTML = '';
    if (!pergunta.respostas || !Array.isArray(pergunta.respostas) || pergunta.respostas.length === 0) { console.error(`Pergunta ${pergunta.id || perguntaAtual} sem respostas.`); elRespostasContainer.innerHTML = '<p style="color: red;">Erro: Opções não encontradas.</p>'; return; }
    const jaRespondida = pergunta.hasOwnProperty('respostaDada');
    pergunta.respostas.forEach((respostaTexto) => {
        const p = document.createElement('p'); p.classList.add('answer'); p.textContent = respostaTexto; p.setAttribute('role', 'button'); p.tabIndex = 0;
        if (jaRespondida) { marcarRespostaComoJaFeita(p, pergunta, respostaTexto); } else { p.onclick = () => verificarResposta(p, pergunta); p.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); verificarResposta(p, pergunta); } }; }
        elRespostasContainer.appendChild(p);
    });
}

function marcarRespostaComoJaFeita(elementoResposta, pergunta, textoDaResposta) {
    elementoResposta.onclick = null; elementoResposta.onkeydown = null; elementoResposta.classList.add('answered'); elementoResposta.style.cursor = 'default'; elementoResposta.tabIndex = -1;
    if (textoDaResposta === pergunta.correta) elementoResposta.classList.add('correct'); else if (textoDaResposta === pergunta.respostaDada) elementoResposta.classList.add('incorrect');
}

// ===============================================
// FUNÇÃO COM LOGS DE DEBUG PARA O BOTÃO PRÓXIMA
// ===============================================
function configurarBotoesNavegacao(indiceAtual, totalPerguntas) {
     if (!elNavigationButtons || !elPrevBtn || !elNextBtn) {
         console.warn("configurarBotoesNavegacao: Botões (Prev/Next) não encontrados. Tentando recachear...");
         if (elQuizSection) {
             elNavigationButtons = elQuizSection.querySelector('.navigation-buttons');
             if (elNavigationButtons) {
                 elPrevBtn = elNavigationButtons.querySelector('#prev-btn');
                 elNextBtn = elNavigationButtons.querySelector('#next-btn');
                 console.log("configurarBotoesNavegacao: Botões recacheados.", {elPrevBtn, elNextBtn});
             }
         }
         if (!elPrevBtn || !elNextBtn) {
            console.error("configurarBotoesNavegacao: FALHA ao encontrar botões mesmo após recachear.");
            return; // Sai se não encontrar
         }
     }

    elNavigationButtons.style.display = 'flex';
    elPrevBtn.disabled = indiceAtual === 0;

    const ultimaQuestao = indiceAtual === totalPerguntas - 1;
    elNextBtn.innerText = ultimaQuestao ? 'Ver Resultado' : 'Próxima';

    // Habilita Next/Resultado apenas se a questão atual foi respondida
    // Usando ?. para segurança caso perguntasFiltradas[indiceAtual] seja undefined
    elNextBtn.disabled = false;
    console.log(`--- configurarBotoes --- Botão Próxima está ${elNextBtn.disabled ? 'DESABILITADO' : 'HABILITADO'}`); // LOG 6
}

// ===============================================
// FUNÇÃO COM LOGS DE DEBUG PARA O BOTÃO PRÓXIMA
// ===============================================
function verificarResposta(elementoClicado, pergunta) {
    console.log(`--- verificarResposta INÍCIO --- Questão: ${perguntaAtual + 1}, Elemento clicado:`, elementoClicado); // LOG 1

    // Verifica se a pergunta já foi respondida OU se os elementos necessários não existem
    if (pergunta.hasOwnProperty('respostaDada') || !elementoClicado || !elRespostasContainer) {
        console.warn("verificarResposta: Ignorando clique - Pergunta já respondida ou elemento inválido.", {
            jaRespondida: pergunta.hasOwnProperty('respostaDada'),
            elementoClicadoExiste: !!elementoClicado,
            containerRespostasExiste: !!elRespostasContainer
        }); // LOG 2 - Detalhado
        return; // Impede processamento adicional
    }

    clearTimeout(autoAvancoTimeoutId); // Cancela avanço automático anterior, se houver

    const respostaSelecionada = elementoClicado.textContent;
    pergunta.respostaDada = respostaSelecionada; // Armazena a resposta dada
    console.log(`verificarResposta: Resposta dada "${respostaSelecionada}" armazenada para questão ${perguntaAtual + 1}.`);

    desabilitarRespostas(); // Desabilita todos os botões de resposta
    aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada); // Aplica estilos correct/incorrect
    atualizarEstadoAposResposta(pergunta, respostaSelecionada); // Atualiza score e UI do aside
    atualizarGridEstilos(perguntaAtual); // Atualiza a cor na grid

    // Tenta habilitar o botão "Próxima"
    if (elNextBtn) {
        console.log("verificarResposta: HABILITANDO botão Próxima (removendo 'disabled')."); // LOG 3
        elNextBtn.disabled = false;
    } else {
        // Isso não deveria acontecer se o cache inicial funcionou, mas é uma segurança
        console.error("verificarResposta: Botão Próxima (elNextBtn) NÃO FOI ENCONTRADO no DOM ao tentar habilitar!"); // LOG 4
    }

    console.log("--- verificarResposta FIM --- Agendando próxima questão..."); // LOG FINAL da função
    agendarProximaQuestao(1500); // Agenda o avanço automático
}


function desabilitarRespostas() {
    const respostas = elRespostasContainer.querySelectorAll('.answer');
    respostas.forEach(r => {
        r.onclick = null;
        r.onkeydown = null;
        r.classList.add('answered');
        r.style.cursor = 'default';
        r.tabIndex = -1;
    });
}

function aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada) {
    const ehCorreta = respostaSelecionada === pergunta.correta;
    elementoClicado.classList.add(ehCorreta ? "correct" : "incorrect");

    if (!ehCorreta) {
        const todasRespostas = elRespostasContainer.querySelectorAll('.answer');
        todasRespostas.forEach(elResposta => {
            if (elResposta.textContent === pergunta.correta) {
                elResposta.classList.add('correct');
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
    atualizar_pontuacao();
}

function agendarProximaQuestao(delayMs) {
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = setTimeout(proximaPergunta, delayMs);
}

function proximaPergunta() {
    console.log(">>> proximaPergunta chamada <<<"); // Log para ver se a função do botão é chamada
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;

    if (perguntaAtual < perguntasFiltradas.length - 1) {
        console.log(`Avançando da questão ${perguntaAtual + 1} para ${perguntaAtual + 2}`);
        perguntaAtual++;
        carregarPergunta();
    } else {
        console.log(`Fim do quiz na questão ${perguntaAtual + 1}. Mostrando resultado.`);
        mostrarResultadoFinal();
    }
}

function perguntaAnterior() {
    console.log(">>> perguntaAnterior chamada <<<");
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;

    if (perguntaAtual > 0) {
        console.log(`Voltando da questão ${perguntaAtual + 1} para ${perguntaAtual}`);
        perguntaAtual--;
        carregarPergunta();
    }
}

function mostrarResultadoFinal() {
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;
    if (elQuizSection) elQuizSection.style.display = 'none'; if (elProgressContainer) elProgressContainer.style.display = 'none'; if (elProgressText) elProgressText.style.display = 'none'; if (avisoContainer) avisoContainer.style.display = 'none'; if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none'; if (elPaginacaoControles) elPaginacaoControles.style.display = 'none'; if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
    if (elResultadoCard) { elResultadoCard.style.display = 'block'; preencherMensagemFinal(); const tituloResultado = elResultadoCard.querySelector('.resultado-final-titulo'); if (tituloResultado) tituloResultado.focus(); } else { console.error("Card resultado não encontrado."); mostrarAviso(`Quiz Concluído! Pontos: ${usuario.pontos} (Acertos: ${usuario.acertos}, Erros: ${usuario.erros})`); }
}

function preencherMensagemFinal() {
     if (!elResultadoCard || !filtroCheckboxesContainer) return;
    const tituloEl = elResultadoCard.querySelector('.resultado-final-titulo'); const pontuacaoEl = elResultadoCard.querySelector('.pontos-valor'); const acertosEl = elResultadoCard.querySelector('.acertos-valor'); const errosEl = elResultadoCard.querySelector('.erros-valor');
    if (!tituloEl || !pontuacaoEl || !acertosEl || !errosEl) { console.error("Elementos internos card resultado não encontrados."); return; }
    tituloEl.textContent = gerarTituloResultadoFinal(); pontuacaoEl.textContent = usuario.pontos; acertosEl.textContent = usuario.acertos; errosEl.textContent = usuario.erros;
}

function gerarTituloResultadoFinal() {
     const todosCheckboxesCategorias = filtroCheckboxesContainer?.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:not([value="Todas"])'); const checkboxTodas = filtroCheckboxesContainer?.querySelector('#filtro-checkboxes-scroll input[value="Todas"]'); const categoriasAtivas = obterCategoriasSelecionadas();
    if (!todosCheckboxesCategorias || !checkboxTodas) return "Quiz Concluído!";
    const totalCategoriasDisponiveis = todosCheckboxesCategorias.length;
    if (categoriasAtivas.length === 1) return `Quiz de "${categoriasAtivas[0]}" Concluído!`; else if (categoriasAtivas.length === totalCategoriasDisponiveis && totalCategoriasDisponiveis > 0) { if (checkboxTodas.checked) return `Quiz de Todas as Categorias Concluído!`; else return `Quiz (Todas as Categorias) Concluído!`; } else if (categoriasAtivas.length > 1) return `Quiz de Múltiplas Categorias Concluído!`; else return "Quiz Finalizado!";
}


function atualizar_pontuacao() {
    if (elPontuacao) elPontuacao.textContent = usuario.pontos; if (elAcertosNum) elAcertosNum.textContent = usuario.acertos; if (elErrosNum) elErrosNum.textContent = usuario.erros;
}

// --- Funções do Modal de Confirmação ---
function showConfirmEncerrarModal() {
     if (elConfirmEncerrarOverlay) { elConfirmEncerrarOverlay.style.display = 'flex'; void elConfirmEncerrarOverlay.offsetWidth; elConfirmEncerrarOverlay.classList.add('visible'); if(elCancelEncerrarBtn) elCancelEncerrarBtn.focus(); }
}

function hideConfirmEncerrarModal() {
     if (elConfirmEncerrarOverlay) elConfirmEncerrarOverlay.classList.remove('visible');
}
// --- Fim Funções do Modal ---

// --- Carregamento Inicial e Event Listeners ---
async function carregarPerguntasJSON() {
     try { const timestamp = Date.now(); const response = await fetch(`assets/data/questions.json?t=${timestamp}`); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); const contentType = response.headers.get("content-type"); if (!contentType || !(contentType.includes("application/json") || contentType.includes("text/plain"))) console.warn(`Tipo inesperado: ${contentType}`); const data = await response.json(); if (!Array.isArray(data)) throw new Error("Formato inválido (esperava Array)."); perguntas = data; console.log(`Perguntas carregadas (${perguntas.length}).`); return true; } catch (error) { console.error("Erro CRÍTICO ao carregar perguntas:", error); if (!avisoContainer || !avisoMensagem) cacheDOMelements(); if (avisoContainer && avisoMensagem) { mostrarSecao('questoes-section'); mostrarAviso(`Falha ao carregar: ${error.message}.`); } else alert(`Falha crítica: ${error.message}`); return false; }
}

function configurarEventListeners() {
    // Navegação Principal (Superior - Desktop/Tablet)
    const topNavLinks = document.querySelectorAll('.navbar .nav-link');
    topNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); const clickedLink = e.target.closest('a'); if (!clickedLink) return; const targetSectionId = clickedLink.dataset.section;
            if (targetSectionId && targetSectionId !== secaoAtual) {
                document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => { activeLink.classList.remove('active'); activeLink.removeAttribute('aria-current'); });
                clickedLink.classList.add('active'); clickedLink.setAttribute('aria-current', 'page');
                const correspondingBottomLink = document.querySelector(`.bottom-nav-link[data-section="${targetSectionId}"]`); if (correspondingBottomLink) { correspondingBottomLink.classList.add('active'); correspondingBottomLink.setAttribute('aria-current', 'page'); }
                mostrarSecao(targetSectionId);
            }
        });
    });

    // Navegação Inferior (Mobile)
    const bottomNavLinks = document.querySelectorAll('.bottom-navbar .bottom-nav-link');
    bottomNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); const clickedLink = e.target.closest('a'); if (!clickedLink) return; const targetSectionId = clickedLink.dataset.section;
            if (targetSectionId && targetSectionId !== secaoAtual) {
                document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => { activeLink.classList.remove('active'); activeLink.removeAttribute('aria-current'); });
                clickedLink.classList.add('active'); clickedLink.setAttribute('aria-current', 'page');
                 const correspondingTopLink = document.querySelector(`.navbar .nav-link[data-section="${targetSectionId}"]`); if (correspondingTopLink) { correspondingTopLink.classList.add('active'); correspondingTopLink.setAttribute('aria-current', 'page'); }
                mostrarSecao(targetSectionId);
            }
        });
    });

    // Filtro de Categorias (Checkboxes)
    if (filtroCheckboxesContainer) {
        filtroCheckboxesContainer.addEventListener('change', (e) => {
            if (e.target?.type === 'checkbox' && e.target.closest('#filtro-checkboxes-scroll')) {
                handleCheckboxChange(e.target);
                atualizarFiltroECarregarPerguntas();
                setTimeout(atualizarSetasScrollCategorias, 100);
            }
        });
    } else { console.warn("Container de filtros não encontrado."); }

    // Botões de Navegação do Quiz (Anterior/Próximo)
    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior);
    // ----> VERIFICAÇÃO IMPORTANTE AQUI <----
    if (elNextBtn) {
        console.log("Adicionando event listener ao botão #next-btn"); // Log para confirmar adição
        elNextBtn.addEventListener('click', proximaPergunta);
    } else {
        console.error("Botão #next-btn NÃO encontrado durante configurarEventListeners!");
    }

    // Setas de Rolagem das Categorias
    if (elCatScrollLeft) elCatScrollLeft.addEventListener('click', () => rolarCategorias('left'));
    if (elCatScrollRight) elCatScrollRight.addEventListener('click', () => rolarCategorias('right'));

    // Atualiza Setas ao Rolar e Redimensionar
    if (elFiltroCheckboxesScroll) { elFiltroCheckboxesScroll.addEventListener('scroll', atualizarSetasScrollCategorias, { passive: true }); }
    let resizeTimeout; window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(atualizarSetasScrollCategorias, 150); });

    // Event Listeners do Modal
    if (elBtnEncerrarSessao) elBtnEncerrarSessao.addEventListener('click', showConfirmEncerrarModal); else console.warn("Botão Encerrar não encontrado.");
    if (elConfirmEncerrarBtn) elConfirmEncerrarBtn.addEventListener('click', () => { mostrarResultadoFinal(); hideConfirmEncerrarModal(); }); else console.warn("Botão Confirmar Modal não encontrado.");
    if (elCancelEncerrarBtn) elCancelEncerrarBtn.addEventListener('click', hideConfirmEncerrarModal); else console.warn("Botão Cancelar Modal não encontrado.");
    if (elConfirmEncerrarOverlay) elConfirmEncerrarOverlay.addEventListener('click', (event) => { if (event.target === elConfirmEncerrarOverlay) hideConfirmEncerrarModal(); }); else console.warn("Overlay Modal não encontrado.");

    // Botão Recomeçar
    if (elBtnRecomecar) elBtnRecomecar.addEventListener('click', reiniciarQuizCompleto); else console.warn("Botão Recomeçar não encontrado.");
}


function handleCheckboxChange(changedCheckbox) {
     if (!elFiltroCheckboxesScroll) return; const cbTodas = elFiltroCheckboxesScroll.querySelector('input[value="Todas"]'); const outrosCheckboxes = elFiltroCheckboxesScroll.querySelectorAll('input[type="checkbox"]:not([value="Todas"])'); if (!cbTodas || !outrosCheckboxes) return;
     if (changedCheckbox === cbTodas) { outrosCheckboxes.forEach(cb => cb.checked = cbTodas.checked); } else { let todosMarcados = true; outrosCheckboxes.forEach(cb => { if (!cb.checked) todosMarcados = false; }); cbTodas.checked = todosMarcados; }
}

// --- Função Reiniciar Quiz Completo ---
function reiniciarQuizCompleto() {
    if (!elResultadoCard || !filtroCheckboxesContainer) { if (!cacheDOMelements()) { alert("Erro ao reiniciar. Recarregue."); return; } }
    elResultadoCard.style.display = 'none'; atualizarFiltroECarregarPerguntas();
    const mainContent = document.querySelector('#questoes-section .main-content'); if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' });
}


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    const perguntasCarregadas = await carregarPerguntasJSON();

    if (perguntasCarregadas) {
        if (!cacheDOMelements()) {
            console.error("Erro Crítico: Falha ao encontrar elementos essenciais do DOM.");
            const body = document.querySelector('body');
            if (body) body.innerHTML = '<p style="color:red; padding: 20px;">Erro grave ao inicializar. Recarregue.</p>';
            return;
        }

        try {
            const categoriasUnicas = extrairCategoriasUnicas(perguntas);
            gerarCheckboxesCategoria(elFiltroCheckboxesScroll, categoriasUnicas);
            console.log("Filtros de categoria gerados.");
        } catch (error) {
            console.error("Erro ao gerar filtros de categoria:", error);
            if(avisoContainer) mostrarAviso("Erro ao configurar os filtros.");
        }

        configurarEventListeners(); // Configura todos os ouvintes

        const linkAtivoInicial = document.querySelector('.navbar .nav-link.active, .bottom-navbar .bottom-nav-link.active');
        const secaoInicialId = linkAtivoInicial?.dataset.section || 'inicio-section';
        mostrarSecao(secaoInicialId);

        setTimeout(atualizarSetasScrollCategorias, 150);
    } else {
        console.error("Inicialização interrompida: Falha ao carregar perguntas.");
    }
});