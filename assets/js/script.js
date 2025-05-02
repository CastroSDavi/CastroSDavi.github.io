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
let elBtnEncerrarSessao;     // <<< RENOMEADO: Botão Encerrar

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
        elProgressBarFill = document.getElementById('progress-bar-fill');
        elProgressText = document.getElementById('progress-text');
        elProgressContainer = document.getElementById('progress-container');
        // Container PAI dos checkboxes (para delegação de eventos)
        filtroCheckboxesContainer = document.querySelector('.filtro-categorias-container');
        // Container ROLÁVEL dos checkboxes (para manipulação de scroll e conteúdo)
        elFiltroCheckboxesScroll = document.getElementById('filtro-checkboxes-scroll');
        elCatScrollLeft = document.getElementById('cat-scroll-left');
        elCatScrollRight = document.getElementById('cat-scroll-right');
        elBtnEncerrarSessao = document.getElementById('btn-encerrar-sessao'); // <<< ATUALIZADO ID e Variável
        avisoContainer = document.getElementById('aviso-container');
        avisoMensagem = avisoContainer ? avisoContainer.querySelector('.aviso-mensagem') : null;
        elQuestionGridContainer = document.getElementById('question-grid-container');
        elPaginacaoControles = document.getElementById('paginacao-controles');

        // Adicionado elementos das setas e container rolável à verificação
        const elementos = { elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, elQuestionGridContainer, elPaginacaoControles, elFiltroCheckboxesScroll, elCatScrollLeft, elCatScrollRight, elBtnEncerrarSessao }; // <<< ATUALIZADO Variável na lista
        let missingElements = false;
        for (const key in elementos) {
            const isEssential = key !== 'elNavigationButtons' && key !== 'avisoMensagem';
            // Tornar o botão encerrar opcional
            if (!elementos[key] && isEssential && key !== 'elBtnEncerrarSessao') { // <<< ATUALIZADO Variável
                console.error(`Erro Cache DOM: Elemento ${key} não encontrado! Verifique IDs/classes no HTML.`);
                missingElements = true;
            } else if (!elementos[key] && key === 'elBtnEncerrarSessao') { // <<< ATUALIZADO Variável
                 console.warn(`Aviso Cache DOM: Elemento ${key} não encontrado. Funcionalidade de encerrar não estará disponível.`);
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
    let start = null;
    const step = (timestamp) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        if (elapsed < 400) {
             window.requestAnimationFrame(step);
        } else {
            atualizarSetasScrollCategorias();
        }
    };
    window.requestAnimationFrame(step);
}

function atualizarSetasScrollCategorias() {
    if (!elFiltroCheckboxesScroll || !elCatScrollLeft || !elCatScrollRight) {
        if(elCatScrollLeft) elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none';
        if(elCatScrollRight) elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none';
        return;
    }
    const scrollLeft = Math.round(elFiltroCheckboxesScroll.scrollLeft);
    const scrollWidth = elFiltroCheckboxesScroll.scrollWidth;
    const clientWidth = elFiltroCheckboxesScroll.clientWidth;
    const canScroll = scrollWidth > clientWidth + 1;

    if (!canScroll) {
        elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true;
        elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true;
    } else {
        elCatScrollLeft.disabled = scrollLeft <= 0;
        elCatScrollRight.disabled = scrollLeft + clientWidth >= scrollWidth - 1;
        elCatScrollLeft.style.pointerEvents = elCatScrollLeft.disabled ? 'none' : 'auto';
        elCatScrollRight.style.pointerEvents = elCatScrollRight.disabled ? 'none' : 'auto';
        elCatScrollLeft.style.opacity = '';
        elCatScrollRight.style.opacity = '';
    }
}

// --- Funções de Barra de Progresso ---
function atualizarBarraProgresso() {
    if (!elProgressContainer || !elProgressBarFill || !elProgressText) return;
    const quizAtivo = elQuizSection && elQuizSection.style.display !== 'none';
    const temPerguntas = perguntasFiltradas && perguntasFiltradas.length > 0;

    if (quizAtivo && temPerguntas) {
        elProgressContainer.style.display = 'block';
        elProgressText.style.display = 'block';
        const totalPerguntas = perguntasFiltradas.length;
        const numQuestaoAtual = Math.min(perguntaAtual + 1, totalPerguntas);
        const progressoPercentual = totalPerguntas > 0 ? (numQuestaoAtual / totalPerguntas) * 100 : 0;
        elProgressBarFill.style.width = `${progressoPercentual}%`;
        elProgressText.textContent = `${numQuestaoAtual} / ${totalPerguntas}`;
    } else {
        elProgressContainer.style.display = 'none';
        elProgressText.style.display = 'none';
        if(elProgressBarFill) elProgressBarFill.style.width = `0%`;
        if(elProgressText) elProgressText.textContent = `0 / 0`;
    }
}

// --- Funções de Navegação de Seção ---
function mostrarSecao(idSecao) {
    if (!elQuizSection) {
        if (!cacheDOMelements()) return;
    }
    document.querySelectorAll('.main-section').forEach(s => s.style.display = 'none');
    const secaoParaMostrar = document.getElementById(idSecao);
    if (secaoParaMostrar) {
        secaoParaMostrar.style.display = 'flex';
        secaoAtual = idSecao;
        limparAviso();
        if (idSecao === 'questoes-section') {
            prepararSecaoQuestoes();
            setTimeout(atualizarSetasScrollCategorias, 100);
        } else {
            esconderElementosQuiz();
        }
        atualizarBarraProgresso();
    } else { console.error(`Seção ${idSecao} não encontrada.`); }
}

function prepararSecaoQuestoes() {
     if (elQuizSection) elQuizSection.style.display = 'none';
     if (elResultadoCard) elResultadoCard.style.display = 'none';
     if (avisoContainer) avisoContainer.style.display = 'none';
     atualizarFiltroECarregarPerguntas();
}

function esconderElementosQuiz() {
    const secaoQuestoes = document.getElementById('questoes-section');
    if (secaoQuestoes) {
        const quiz = secaoQuestoes.querySelector('#quiz-section');
        const resultado = secaoQuestoes.querySelector('.resultado-final-card');
        const aviso = secaoQuestoes.querySelector('#aviso-container');
        const grid = secaoQuestoes.querySelector('#question-grid-container');
        const progressoContainer = secaoQuestoes.querySelector('#progress-container');
        const progressoTexto = secaoQuestoes.querySelector('#progress-text');
        const paginacao = secaoQuestoes.querySelector('#paginacao-controles');

        if (quiz) quiz.style.display = 'none';
        if (resultado) resultado.style.display = 'none';
        if (aviso) aviso.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (progressoContainer) progressoContainer.style.display = 'none';
        if (progressoTexto) progressoTexto.style.display = 'none';
        if (paginacao) paginacao.innerHTML = ''; paginacao.style.display = 'none';
        if(elCatScrollLeft) elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none';
        if(elCatScrollRight) elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none';
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none'; // <<< ATUALIZADO Variável
    }
}

// --- Funções da Grade de Questões e Paginação ---
function renderizarGridEPaginacao() {
    if (!elQuestionGridContainer || !elPaginacaoControles || !perguntasFiltradas) {
        console.warn("Elementos da grid/paginação ou perguntas filtradas não disponíveis.");
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) elPaginacaoControles.innerHTML = '';
        return;
    }
    if (perguntasFiltradas.length === 0) {
        elQuestionGridContainer.style.display = 'none';
        elPaginacaoControles.innerHTML = '';
        elPaginacaoControles.style.display = 'none';
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
        const gridItem = document.createElement('button');
        gridItem.classList.add('grid-item');
        gridItem.textContent = i + 1;
        gridItem.dataset.index = i;
        gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
        gridItem.onclick = () => irParaQuestao(i);
        elQuestionGridContainer.appendChild(gridItem);
    }
}

function renderizarControlesPaginacao(totalQuestoes) {
    if (!elPaginacaoControles) return;
    elPaginacaoControles.innerHTML = '';
    const totalPaginas = Math.ceil(totalQuestoes / QUESTOES_POR_PAGINA_GRID);
    if (totalPaginas <= 1) {
         elPaginacaoControles.style.display = 'none';
         return;
    }
    elPaginacaoControles.style.display = 'flex';
    const criarBotao = (texto, pagina, isDisabled = false, isCurrent = false, isEllipsis = false, ariaLabel = '') => {
        if (isEllipsis) {
            const span = document.createElement('span');
            span.textContent = texto; span.setAttribute('aria-hidden', 'true'); return span;
        }
        const btn = document.createElement('button'); btn.textContent = texto; btn.disabled = isDisabled || isCurrent;
        if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
        if (isCurrent) { btn.classList.add('pagina-atual'); btn.setAttribute('aria-current', 'page'); }
        else if (!isDisabled) { btn.onclick = () => mudarPaginaGrid(pagina); }
        return btn;
    };
    elPaginacaoControles.appendChild(criarBotao('«', paginaAtualGrid - 1, paginaAtualGrid === 1, false, false, 'Página anterior da grade'));
    const maxVisibleButtons = 5; const halfVisible = Math.floor(maxVisibleButtons / 2);
    if (totalPaginas <= maxVisibleButtons + 2) {
        for (let i = 1; i <= totalPaginas; i++) { elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`)); }
    } else {
        elPaginacaoControles.appendChild(criarBotao(1, 1, false, paginaAtualGrid === 1, false, 'Ir para página 1 da grade'));
        if (paginaAtualGrid > halfVisible + 2) { elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true)); }
        let startPage = Math.max(2, paginaAtualGrid - halfVisible); let endPage = Math.min(totalPaginas - 1, paginaAtualGrid + halfVisible);
        if (paginaAtualGrid <= halfVisible + 1) { endPage = Math.min(totalPaginas - 1, maxVisibleButtons); }
        if (paginaAtualGrid >= totalPaginas - halfVisible) { startPage = Math.max(2, totalPaginas - maxVisibleButtons + 1); }
        for (let i = startPage; i <= endPage; i++) { elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`)); }
        if (paginaAtualGrid < totalPaginas - halfVisible - 1) { elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true)); }
        elPaginacaoControles.appendChild(criarBotao(totalPaginas, totalPaginas, false, paginaAtualGrid === totalPaginas, false, `Ir para página ${totalPaginas} da grade`));
    }
    elPaginacaoControles.appendChild(criarBotao('»', paginaAtualGrid + 1, paginaAtualGrid === totalPaginas, false, false, 'Próxima página da grade'));
}

function mudarPaginaGrid(novaPagina) {
     const totalPaginas = Math.ceil(perguntasFiltradas.length / QUESTOES_POR_PAGINA_GRID);
     if (novaPagina >= 1 && novaPagina <= totalPaginas && novaPagina !== paginaAtualGrid) {
         paginaAtualGrid = novaPagina;
         renderizarGridEPaginacao();
     }
}

function atualizarGridEstilos(indiceAtualGlobal) {
    if (!elQuestionGridContainer || !perguntasFiltradas) return;
    const items = elQuestionGridContainer.querySelectorAll('.grid-item');
    items.forEach(item => {
        const itemIndexGlobal = parseInt(item.dataset.index, 10);
        if (isNaN(itemIndexGlobal) || itemIndexGlobal < 0 || itemIndexGlobal >= perguntasFiltradas.length) return;
        const pergunta = perguntasFiltradas[itemIndexGlobal];
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect');
        if (pergunta?.hasOwnProperty('respostaDada')) { item.classList.add(pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect'); }
        if (itemIndexGlobal === indiceAtualGlobal) { item.classList.add('grid-item--current'); }
    });
}

function irParaQuestao(indice) {
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;
    if (perguntasFiltradas && indice >= 0 && indice < perguntasFiltradas.length) {
        perguntaAtual = indice;
        carregarPergunta();
    } else { console.error(`Tentativa de ir para questão inválida: índice ${indice}`); }
}

function atualizarFiltroECarregarPerguntas() {
    if (!filtroCheckboxesContainer || !elQuizSection) { console.error("Erro: Elementos de filtro ou quiz não encontrados para atualizar."); mostrarAviso("Erro ao configurar o quiz. Tente recarregar."); return; }
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; limparAviso();
    categoriasSelecionadas = obterCategoriasSelecionadas();
    perguntasFiltradas = filtrarPerguntas(perguntas, categoriasSelecionadas);
    reiniciarEstadoQuiz(); paginaAtualGrid = 1;
    renderizarGridEPaginacao(); setTimeout(atualizarSetasScrollCategorias, 100);
    if (elResultadoCard) elResultadoCard.style.display = 'none'; elQuizSection.style.display = 'none';
    exibirQuizOuAviso(perguntasFiltradas, categoriasSelecionadas); atualizarBarraProgresso();
}

function filtrarPerguntas(listaCompleta, categoriasFiltro) {
    let filtradas = [];
     if (!Array.isArray(listaCompleta)) { console.error('ERRO FATAL: A variável "perguntas" não é um array!'); mostrarAviso("Erro interno ao processar perguntas."); return []; }
    if (categoriasFiltro.length > 0) { filtradas = listaCompleta.filter(p => p.categorias && Array.isArray(p.categorias) && p.categorias.some(cat => categoriasFiltro.includes(cat))); }
    filtradas.forEach(p => delete p.respostaDada); return filtradas;
}

function reiniciarEstadoQuiz() { perguntaAtual = 0; usuario.resetarContadores(); atualizar_pontuacao(); }

function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    if (perguntasParaExibir.length > 0) {
        elQuizSection.style.display = 'flex';
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'block'; // <<< ATUALIZADO Variável
        carregarPergunta(); limparAviso();
    } else {
        const temCheckboxes = elFiltroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
        if (categoriasAtivas.length === 0 && temCheckboxes) { mostrarAviso("Selecione pelo menos uma categoria para começar o quiz."); }
        else if (categoriasAtivas.length > 0) { mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s)."); }
        else { mostrarAviso("Nenhuma categoria disponível ou erro na configuração."); }
        if(elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if(elPaginacaoControles) elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none';
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none'; // <<< ATUALIZADO Variável
    }
}

function carregarPergunta() {
    if (!elementosEssenciaisQuizExistem() || perguntasFiltradas.length === 0) { console.log("carregarPergunta: Elementos ausentes ou sem perguntas."); return; }
    const paginaNecessaria = Math.floor(perguntaAtual / QUESTOES_POR_PAGINA_GRID) + 1;
    if (paginaNecessaria !== paginaAtualGrid) { mudarPaginaGrid(paginaNecessaria); }
    elQuizSection.style.display = 'flex'; atualizarUINavegacaoQuiz();
    if (perguntaAtual >= perguntasFiltradas.length || perguntaAtual < 0) { console.warn(`Índice (${perguntaAtual}) inválido.`); mostrarResultadoFinal(); return; }
    const pergunta = perguntasFiltradas[perguntaAtual];
    if (!pergunta) { console.error(`Erro: Pergunta ${perguntaAtual} não encontrada.`); mostrarAviso("Erro ao carregar dados da pergunta."); mostrarResultadoFinal(); return; }
    limparAreaPergunta(); preencherDetalhesQuestao(pergunta, perguntaAtual); exibirImagemQuestao(pergunta.imagem, perguntaAtual); criarBotoesResposta(pergunta); configurarBotoesNavegacao(perguntaAtual, perguntasFiltradas.length);
}

function elementosEssenciaisQuizExistem() {
    const ok = elQuizSection && elRespostasContainer && elPerguntaTexto && elIdQuestao && elCategoriaTitulo && elReferencia && elNavigationButtons && elPrevBtn && elNextBtn;
     if (!ok) { console.error("Erro crítico: Elementos essenciais do quiz não encontrados."); } return ok;
}

function atualizarUINavegacaoQuiz() { clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; atualizarBarraProgresso(); atualizarGridEstilos(perguntaAtual); }
function limparAreaPergunta() { if (elRespostasContainer) elRespostasContainer.innerHTML = ''; if (elPerguntaImagem) { elPerguntaImagem.style.display = 'none'; elPerguntaImagem.src = ""; elPerguntaImagem.alt = ""; } }

function preencherDetalhesQuestao(pergunta, indice) {
    let tituloCat = "Questão"; if (pergunta.categorias && pergunta.categorias.length > 0) { tituloCat = pergunta.categorias[0]; } else if (categoriasSelecionadas.length === 1) { tituloCat = categoriasSelecionadas[0]; }
    if (elCategoriaTitulo) elCategoriaTitulo.innerText = tituloCat; if (elIdQuestao) elIdQuestao.innerText = indice + 1; if (elPerguntaTexto) elPerguntaTexto.textContent = pergunta.pergunta; if (elReferencia) elReferencia.textContent = `Referência: ${pergunta.referencia || 'N/A'}`;
}

function exibirImagemQuestao(urlImagem, indice) {
    if (elPerguntaImagem && urlImagem && urlImagem.trim() !== "") { elPerguntaImagem.src = urlImagem; elPerguntaImagem.alt = `Imagem da questão ${indice + 1}`; elPerguntaImagem.style.display = 'block'; elPerguntaImagem.onerror = () => { elPerguntaImagem.style.display = 'none'; console.warn(`Erro img: ${urlImagem}`); }; }
    else if (elPerguntaImagem) { elPerguntaImagem.style.display = 'none'; }
}

function criarBotoesResposta(pergunta) {
    if (!elRespostasContainer) return; if (!pergunta.respostas || !Array.isArray(pergunta.respostas)) { console.error(`Pergunta ${pergunta.id} sem respostas.`); elRespostasContainer.innerHTML = '<p>Erro: Opções não encontradas.</p>'; return; }
    const jaRespondida = pergunta.hasOwnProperty('respostaDada');
    pergunta.respostas.forEach((respostaTexto) => { const p = document.createElement('p'); p.classList.add('answer'); p.textContent = respostaTexto; if (jaRespondida) { marcarRespostaComoJaFeita(p, pergunta, respostaTexto); } else { p.onclick = () => verificarResposta(p, pergunta); } elRespostasContainer.appendChild(p); });
}

function marcarRespostaComoJaFeita(el, p, rt) { el.onclick = null; el.classList.add('answered'); if (rt === p.correta) el.classList.add('correct'); if (rt === p.respostaDada && rt !== p.correta) el.classList.add('incorrect'); }

function configurarBotoesNavegacao(idx, total) {
     if (!elNavigationButtons && elQuizSection) { elNavigationButtons = elQuizSection.querySelector('.navigation-buttons'); if (elNavigationButtons) { elPrevBtn = elNavigationButtons.querySelector('#prev-btn'); elNextBtn = elNavigationButtons.querySelector('#next-btn'); } else { console.warn("Nav buttons não encontrados."); return; } } if (!elPrevBtn || !elNextBtn) { console.warn("Prev/next não encontrados."); return; }
    elNavigationButtons.style.display = 'flex'; elPrevBtn.disabled = idx === 0; elNextBtn.disabled = false; elNextBtn.innerText = (idx === total - 1) ? 'Ver Resultado' : 'Próxima';
}

function verificarResposta(elClicado, pergunta) {
     if (pergunta.hasOwnProperty('respostaDada') || !elClicado || !elRespostasContainer) return; clearTimeout(autoAvancoTimeoutId);
     const respostaSel = elClicado.textContent; pergunta.respostaDada = respostaSel;
     desabilitarRespostas(); aplicarFeedbackVisualResposta(elClicado, pergunta, respostaSel); atualizarEstadoAposResposta(pergunta, respostaSel); atualizarGridEstilos(perguntaAtual); agendarProximaQuestao(1500);
 }

function desabilitarRespostas() { const ans = elRespostasContainer.querySelectorAll('.answer'); ans.forEach(a => { a.onclick = null; a.classList.add('answered'); }); }

function aplicarFeedbackVisualResposta(elClicado, p, respSel) {
     const correta = respSel === p.correta; elClicado.classList.add(correta ? "correct" : "incorrect");
     if (!correta) { const all = elRespostasContainer.querySelectorAll('.answer'); all.forEach(ans => { if (ans.textContent === p.correta) { ans.classList.add('correct'); } }); }
}

function atualizarEstadoAposResposta(pergunta, respostaSelecionada) { if (respostaSelecionada === pergunta.correta) { usuario.acertos += 1; } else { usuario.erros += 1; } atualizar_pontuacao(); }
function agendarProximaQuestao(delayMs) { autoAvancoTimeoutId = setTimeout(proximaPergunta, delayMs); }

function proximaPergunta() { clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; if (perguntaAtual < perguntasFiltradas.length - 1) { perguntaAtual++; carregarPergunta(); } else { mostrarResultadoFinal(); } }
function perguntaAnterior() { clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; if (perguntaAtual > 0) { perguntaAtual--; carregarPergunta(); } }

function mostrarResultadoFinal() {
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;
    if (elQuizSection) elQuizSection.style.display = 'none'; if (elProgressContainer) elProgressContainer.style.display = 'none'; if (elProgressText) elProgressText.style.display = 'none'; if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none'; if (elPaginacaoControles) elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none';
    if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none'; // <<< ATUALIZADO Variável

    if (elResultadoCard) { elResultadoCard.style.display = 'block'; preencherMensagemFinal(); }
    else { console.error("Card resultado não encontrado."); mostrarAviso(`Quiz Concluído! Pontuação: ${usuario.pontos}, Acertos: ${usuario.acertos}, Erros: ${usuario.erros}`); }
}

function preencherMensagemFinal() {
    if (!elResultadoCard || !filtroCheckboxesContainer) return;
    const tit = elResultadoCard.querySelector('.resultado-final-titulo'); const pont = elResultadoCard.querySelector('.pontos-valor'); const acert = elResultadoCard.querySelector('.acertos-valor'); const err = elResultadoCard.querySelector('.erros-valor');
    if (!tit || !pont || !acert || !err) { console.error("Elementos internos do card não encontrados."); return; }
    tit.textContent = gerarTituloResultadoFinal(); pont.textContent = usuario.pontos; acert.textContent = usuario.acertos; err.textContent = usuario.erros;
}

function gerarTituloResultadoFinal() {
    const outros = filtroCheckboxesContainer?.querySelectorAll('#filtro-checkboxes-scroll input:not([value="Todas"])'); const ativas = obterCategoriasSelecionadas(); const cbTodas = filtroCheckboxesContainer?.querySelector('#filtro-checkboxes-scroll input[value="Todas"]');
    if (ativas.length === 1) return `Quiz de ${ativas[0]} Concluído!`;
    else if (cbTodas?.checked && outros && ativas.length === outros.length) return `Quiz de Todas as Categorias Concluído!`;
    else if (ativas.length > 1) return `Quiz de Múltiplas Categorias Concluído!`; return "Quiz Concluído!";
}

function atualizar_pontuacao() { if (elPontuacao) elPontuacao.textContent = usuario.pontos; if (elAcertosNum) elAcertosNum.textContent = usuario.acertos; if (elErrosNum) elErrosNum.textContent = usuario.erros; }

async function carregarPerguntasJSON() {
    try {
        const timestamp = Date.now(); const response = await fetch(`assets/data/questions.json?t=${timestamp}`); if (!response.ok) throw new Error(`Falha: ${response.status}`);
        const contentType = response.headers.get("content-type"); if (!contentType || !(contentType.includes("json") || contentType.includes("text/plain"))) console.warn(`Tipo (${contentType}) inesperado.`);
        const data = await response.json(); if (!Array.isArray(data)) throw new Error("Formato inválido (não Array).");
        perguntas = data; console.log(`Perguntas carregadas (${perguntas.length}).`); return true;
    } catch (error) {
        console.error("Erro CRÍTICO carregamento perguntas:", error); if (!avisoContainer || !avisoMensagem) cacheDOMelements();
        if (avisoContainer && avisoMensagem) { mostrarSecao('questoes-section'); mostrarAviso(`Falha: ${error.message}.`); } else { alert(`Falha: ${error.message}`); } return false;
    }
}

function configurarEventListeners() {
    document.querySelectorAll('.navbar .nav-link').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const cl = e.target.closest('a'); if (!cl) return; const id = cl.dataset.section; if (id && id !== secaoAtual) { document.querySelectorAll('.navbar .nav-link.active').forEach(al => al.classList.remove('active')); cl.classList.add('active'); mostrarSecao(id); } }); });
    if (filtroCheckboxesContainer) { filtroCheckboxesContainer.addEventListener('change', (e) => { if (e.target?.type === 'checkbox' && e.target.closest('#filtro-checkboxes-scroll')) { handleCheckboxChange(e.target); atualizarFiltroECarregarPerguntas(); setTimeout(atualizarSetasScrollCategorias, 100); } }); } else { console.warn("Container filtro não encontrado."); }
    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior); if (elNextBtn) elNextBtn.addEventListener('click', proximaPergunta);
    if (elCatScrollLeft) { elCatScrollLeft.addEventListener('click', () => rolarCategorias('left')); } if (elCatScrollRight) { elCatScrollRight.addEventListener('click', () => rolarCategorias('right')); }
    if (elFiltroCheckboxesScroll) { elFiltroCheckboxesScroll.addEventListener('scroll', atualizarSetasScrollCategorias, { passive: true }); }
    let resizeTimeout; window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(atualizarSetasScrollCategorias, 150); });

    // <<< ATUALIZADO Variável e ID >>>
    if (elBtnEncerrarSessao) {
        elBtnEncerrarSessao.addEventListener('click', () => {
            if (confirm("Tem certeza que deseja encerrar esta tentativa? Sua pontuação atual será exibida.")) {
                mostrarResultadoFinal();
            }
        });
    }
}

function handleCheckboxChange(changedCheckbox) {
     if (!elFiltroCheckboxesScroll) return;
     const cbTodas = elFiltroCheckboxesScroll.querySelector('input[value="Todas"]'); const outrosCheckboxes = elFiltroCheckboxesScroll.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
     if (!cbTodas || !outrosCheckboxes) { console.error("Checkboxes não encontrados."); return; }
     if (changedCheckbox === cbTodas) { outrosCheckboxes.forEach(cb => { cb.checked = cbTodas.checked; }); }
     else { let todosMarcados = true; outrosCheckboxes.forEach(cb => { if (!cb.checked) todosMarcados = false; }); cbTodas.checked = todosMarcados; }
}

document.addEventListener('DOMContentLoaded', async () => {
    const perguntasCarregadas = await carregarPerguntasJSON();
    if (perguntasCarregadas) {
        if (!cacheDOMelements()) { console.error("Erro Crítico: Falha DOM."); mostrarAviso("Erro interface."); return; }
        try { const catUnicas = extrairCategoriasUnicas(perguntas); gerarCheckboxesCategoria(elFiltroCheckboxesScroll, catUnicas); console.log("Filtros gerados."); }
        catch(error) { console.error("Erro gerar filtros:", error); mostrarAviso("Erro filtros."); }
        configurarEventListeners();
        const linkAtivo = document.querySelector('.navbar .nav-link.active'); const secaoId = linkAtivo?.dataset.section || 'inicio-section'; mostrarSecao(secaoId);
        setTimeout(atualizarSetasScrollCategorias, 150);
    }
});