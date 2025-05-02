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
const QUESTOES_POR_PAGINA_GRID = 30; // Número de questões por página na grid
let paginaAtualGrid = 1; // Página atual da grid

// --- Elementos do DOM (cacheados) ---
let elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elNavigationButtons, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, avisoMensagem;
let elQuestionGridContainer;
let elPaginacaoControles;
let elFiltroCheckboxesScroll; // O div rolável das categorias
let elCatScrollLeft;         // Botão seta esquerda categorias
let elCatScrollRight;        // Botão seta direita categorias

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
        avisoContainer = document.getElementById('aviso-container');
        avisoMensagem = avisoContainer ? avisoContainer.querySelector('.aviso-mensagem') : null;
        elQuestionGridContainer = document.getElementById('question-grid-container');
        elPaginacaoControles = document.getElementById('paginacao-controles');

        // Adicionado elementos das setas e container rolável à verificação
        const elementos = { elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, elQuestionGridContainer, elPaginacaoControles, elFiltroCheckboxesScroll, elCatScrollLeft, elCatScrollRight };
        let missingElements = false;
        for (const key in elementos) {
            const isEssential = key !== 'elNavigationButtons' && key !== 'avisoMensagem';
            if (!elementos[key] && isEssential) {
                console.error(`Erro Cache DOM: Elemento ${key} não encontrado! Verifique IDs/classes no HTML.`);
                missingElements = true;
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
    // O containerElemento agora é o div com id="filtro-checkboxes-scroll"
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

    // Atualiza o estado das setas após gerar as categorias
    // Usar um pequeno timeout garante que o navegador calculou as dimensões
    setTimeout(atualizarSetasScrollCategorias, 100);
}

function obterCategoriasSelecionadas() {
    const selecionadas = [];
    // Usa o container PAI para encontrar os checkboxes, não o rolável
     if (!filtroCheckboxesContainer) return selecionadas;

    // Busca checkboxes dentro do elemento rolável correto
    const checkboxesCategorias = filtroCheckboxesContainer.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:checked:not([value="Todas"])');
    checkboxesCategorias.forEach(cb => {
        selecionadas.push(cb.value);
    });
    return selecionadas;
}

// --- Funções para Rolagem das Categorias com Setas ---

// Função para rolar as categorias
function rolarCategorias(direcao) {
    if (!elFiltroCheckboxesScroll) return;

    // Calcula o quanto rolar (ex: 80% da largura visível)
    const scrollAmount = elFiltroCheckboxesScroll.clientWidth * 0.8;

    elFiltroCheckboxesScroll.scrollBy({
        left: direcao === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth' // Rolagem suave
    });

    // Atualiza o estado das setas DEPOIS da animação (ou quase)
    let start = null;
    const step = (timestamp) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        // Espera um tempo razoável para a animação terminar (pode ajustar)
        if (elapsed < 400) {
             window.requestAnimationFrame(step);
        } else {
            atualizarSetasScrollCategorias();
        }
    };
    window.requestAnimationFrame(step);
}

// Função para atualizar o estado (visível/habilitado) das setas
function atualizarSetasScrollCategorias() {
    if (!elFiltroCheckboxesScroll || !elCatScrollLeft || !elCatScrollRight) {
        if(elCatScrollLeft) elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none';
        if(elCatScrollRight) elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none';
        return;
    }

    const scrollLeft = Math.round(elFiltroCheckboxesScroll.scrollLeft); // Arredonda para evitar problemas de float
    const scrollWidth = elFiltroCheckboxesScroll.scrollWidth;
    const clientWidth = elFiltroCheckboxesScroll.clientWidth;

    // Verifica se há conteúdo para rolar (com uma pequena margem de erro)
    const canScroll = scrollWidth > clientWidth + 1;

    if (!canScroll) {
        elCatScrollLeft.style.opacity = '0';
        elCatScrollLeft.style.pointerEvents = 'none';
        elCatScrollLeft.disabled = true;
        elCatScrollRight.style.opacity = '0';
        elCatScrollRight.style.pointerEvents = 'none';
        elCatScrollRight.disabled = true;
    } else {
        // Lógica para habilitar/desabilitar baseado na posição
        elCatScrollLeft.disabled = scrollLeft <= 0;
        elCatScrollRight.disabled = scrollLeft + clientWidth >= scrollWidth - 1; // Tolerância de 1px

        // O CSS controla a opacidade via :hover e :disabled
        // Apenas garantimos que pointer-events esteja correto
        elCatScrollLeft.style.pointerEvents = elCatScrollLeft.disabled ? 'none' : 'auto';
        elCatScrollRight.style.pointerEvents = elCatScrollRight.disabled ? 'none' : 'auto';
        // Reseta opacidade para deixar CSS :hover/:disabled controlar
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
        elProgressText.style.display = 'block'; // Garante que o texto apareça
        const totalPerguntas = perguntasFiltradas.length;
        const numQuestaoAtual = Math.min(perguntaAtual + 1, totalPerguntas); // Usa perguntaAtual (índice global)
        const progressoPercentual = totalPerguntas > 0 ? (numQuestaoAtual / totalPerguntas) * 100 : 0;
        elProgressBarFill.style.width = `${progressoPercentual}%`;
        elProgressText.textContent = `${numQuestaoAtual} / ${totalPerguntas}`;
    } else {
        elProgressContainer.style.display = 'none';
        elProgressText.style.display = 'none'; // Esconde o texto também
        if(elProgressBarFill) elProgressBarFill.style.width = `0%`;
        if(elProgressText) elProgressText.textContent = `0 / 0`;
    }
}

// --- Funções de Navegação de Seção ---
function mostrarSecao(idSecao) {
    if (!elQuizSection) { // Garante cache
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
            // Atualiza estado das setas quando a seção é mostrada
            setTimeout(atualizarSetasScrollCategorias, 100);
        } else {
            esconderElementosQuiz();
        }
        atualizarBarraProgresso(); // Atualiza (esconde se não for quiz)

    } else { console.error(`Seção ${idSecao} não encontrada.`); }
}

function prepararSecaoQuestoes() {
     if (elQuizSection) elQuizSection.style.display = 'none';
     if (elResultadoCard) elResultadoCard.style.display = 'none';
     if (avisoContainer) avisoContainer.style.display = 'none';
     atualizarFiltroECarregarPerguntas(); // Chama a lógica principal do quiz
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
        // Esconder setas das categorias também ao sair da seção
        if(elCatScrollLeft) elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none';
        if(elCatScrollRight) elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none';
    }
}

// --- Funções da Grade de Questões e Paginação ---

// Função PRINCIPAL para renderizar a grid e seus controles
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
        elPaginacaoControles.style.display = 'none'; // Garante que fica escondido
        return;
    }

    elQuestionGridContainer.style.display = 'grid'; // Mostra o container da grid
    renderizarItensDaPaginaGrid(paginaAtualGrid);
    renderizarControlesPaginacao(perguntasFiltradas.length); // <<< MODIFICADA para lógica de elipses
    atualizarGridEstilos(perguntaAtual); // Aplica estilos após renderizar
}

// Função para renderizar APENAS os botões da página atual
function renderizarItensDaPaginaGrid(pagina) {
    if (!elQuestionGridContainer) return;
    elQuestionGridContainer.innerHTML = ''; // Limpa a grid atual

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

// --- MODIFICADO: Função para renderizar controles com lógica de elipses ---
function renderizarControlesPaginacao(totalQuestoes) {
    if (!elPaginacaoControles) return;
    elPaginacaoControles.innerHTML = ''; // Limpa controles existentes

    const totalPaginas = Math.ceil(totalQuestoes / QUESTOES_POR_PAGINA_GRID);

    if (totalPaginas <= 1) {
         elPaginacaoControles.style.display = 'none'; // Esconde se não precisa
         return;
    }
    elPaginacaoControles.style.display = 'flex'; // Garante visibilidade

    const criarBotao = (texto, pagina, isDisabled = false, isCurrent = false, isEllipsis = false, ariaLabel = '') => {
        if (isEllipsis) {
            const span = document.createElement('span');
            span.textContent = texto;
            span.setAttribute('aria-hidden', 'true'); // Esconde de leitores de tela
            return span;
        }

        const btn = document.createElement('button');
        btn.textContent = texto;
        btn.disabled = isDisabled || isCurrent;
        if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);

        if (isCurrent) {
            btn.classList.add('pagina-atual');
            btn.setAttribute('aria-current', 'page');
        } else if (!isDisabled) {
            btn.onclick = () => mudarPaginaGrid(pagina);
        }
        return btn;
    };

    // Botão Anterior
    elPaginacaoControles.appendChild(criarBotao('«', paginaAtualGrid - 1, paginaAtualGrid === 1, false, false, 'Página anterior da grade'));

    // Lógica de Elipses e Números de Página
    const maxVisibleButtons = 5; // Quantos botões de número mostrar (ideal ímpar)
    const halfVisible = Math.floor(maxVisibleButtons / 2);

    if (totalPaginas <= maxVisibleButtons + 2) { // Mostra todos se couber (ex: <= 7 para maxVisible 5)
        for (let i = 1; i <= totalPaginas; i++) {
            elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`));
        }
    } else {
        // Lógica mais complexa com elipses

        // Botão Primeira Página (sempre mostrar)
        elPaginacaoControles.appendChild(criarBotao(1, 1, false, paginaAtualGrid === 1, false, 'Ir para página 1 da grade'));

        // Elipse inicial?
        if (paginaAtualGrid > halfVisible + 2) {
            elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true));
        }

        // Números do meio
        let startPage = Math.max(2, paginaAtualGrid - halfVisible);
        let endPage = Math.min(totalPaginas - 1, paginaAtualGrid + halfVisible);

        // Ajusta start/end para garantir maxVisibleButtons (ou menos se perto das bordas)
         if (paginaAtualGrid <= halfVisible + 1) {
             endPage = Math.min(totalPaginas - 1, maxVisibleButtons);
         }
         if (paginaAtualGrid >= totalPaginas - halfVisible) {
             startPage = Math.max(2, totalPaginas - maxVisibleButtons + 1);
         }

        for (let i = startPage; i <= endPage; i++) {
            elPaginacaoControles.appendChild(criarBotao(i, i, false, i === paginaAtualGrid, false, `Ir para página ${i} da grade`));
        }

        // Elipse final?
        if (paginaAtualGrid < totalPaginas - halfVisible - 1) {
             elPaginacaoControles.appendChild(criarBotao('...', 0, true, false, true));
        }

        // Botão Última Página (sempre mostrar)
        elPaginacaoControles.appendChild(criarBotao(totalPaginas, totalPaginas, false, paginaAtualGrid === totalPaginas, false, `Ir para página ${totalPaginas} da grade`));
    }

    // Botão Próximo
    elPaginacaoControles.appendChild(criarBotao('»', paginaAtualGrid + 1, paginaAtualGrid === totalPaginas, false, false, 'Próxima página da grade'));
}


// Função para mudar de página na grid
function mudarPaginaGrid(novaPagina) {
     const totalPaginas = Math.ceil(perguntasFiltradas.length / QUESTOES_POR_PAGINA_GRID);
     if (novaPagina >= 1 && novaPagina <= totalPaginas && novaPagina !== paginaAtualGrid) {
         paginaAtualGrid = novaPagina;
         renderizarGridEPaginacao(); // Re-renderiza a grid e os controles
     }
}

// Função para aplicar estilos aos itens da grid VISÍVEIS
function atualizarGridEstilos(indiceAtualGlobal) {
    if (!elQuestionGridContainer || !perguntasFiltradas) return;
    const items = elQuestionGridContainer.querySelectorAll('.grid-item');

    items.forEach(item => {
        const itemIndexGlobal = parseInt(item.dataset.index, 10);
        if (isNaN(itemIndexGlobal) || itemIndexGlobal < 0 || itemIndexGlobal >= perguntasFiltradas.length) return;

        const pergunta = perguntasFiltradas[itemIndexGlobal];
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect');

        if (pergunta?.hasOwnProperty('respostaDada')) {
            item.classList.add(pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect');
        }
        if (itemIndexGlobal === indiceAtualGlobal) {
            item.classList.add('grid-item--current');
        }
    });
}

// --- Função para ir para uma questão específica (clicando na grid) ---
function irParaQuestao(indice) {
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;

    if (perguntasFiltradas && indice >= 0 && indice < perguntasFiltradas.length) {
        perguntaAtual = indice;
        carregarPergunta();
    } else {
        console.error(`Tentativa de ir para questão inválida: índice ${indice}`);
    }
}


// --- Função Central: Atualiza Filtro e Carrega Perguntas ---
function atualizarFiltroECarregarPerguntas() {
    if (!filtroCheckboxesContainer || !elQuizSection) {
        console.error("Erro: Elementos de filtro ou quiz não encontrados para atualizar.");
        mostrarAviso("Erro ao configurar o quiz. Tente recarregar.");
        return;
    }

    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;
    limparAviso();

    categoriasSelecionadas = obterCategoriasSelecionadas();
    perguntasFiltradas = filtrarPerguntas(perguntas, categoriasSelecionadas);
    reiniciarEstadoQuiz();
    paginaAtualGrid = 1; // Reseta a página da grid

    // Renderiza a grid e a paginação
    renderizarGridEPaginacao();
    // Atualiza estado das setas das categorias
    setTimeout(atualizarSetasScrollCategorias, 100);

    // Esconde resultado e quiz antes de decidir o que mostrar
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    elQuizSection.style.display = 'none';

    exibirQuizOuAviso(perguntasFiltradas, categoriasSelecionadas);
    atualizarBarraProgresso(); // Atualiza barra (pode esconder)
}

// --- Funções Auxiliares de atualizarFiltroECarregarPerguntas ---
function filtrarPerguntas(listaCompleta, categoriasFiltro) {
    let filtradas = [];
     if (!Array.isArray(listaCompleta)) {
         console.error('ERRO FATAL: A variável "perguntas" não é um array no momento de filtrar!');
         mostrarAviso("Erro interno ao processar perguntas. Verifique o console.");
         return [];
     }

    if (categoriasFiltro.length > 0) {
        filtradas = listaCompleta.filter(p =>
            p.categorias && Array.isArray(p.categorias) && p.categorias.some(cat => categoriasFiltro.includes(cat))
        );
    }
    filtradas.forEach(p => delete p.respostaDada);
    return filtradas;
}

function reiniciarEstadoQuiz() {
    perguntaAtual = 0;
    usuario.resetarContadores();
    atualizar_pontuacao();
}

function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    if (perguntasParaExibir.length > 0) {
        elQuizSection.style.display = 'flex';
        carregarPergunta();
        limparAviso();
    } else {
        // Verifica checkboxes DENTRO da área rolável
        const temCheckboxes = elFiltroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
        if (categoriasAtivas.length === 0 && temCheckboxes) {
             mostrarAviso("Selecione pelo menos uma categoria para começar o quiz.");
        } else if (categoriasAtivas.length > 0) {
            mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
        } else {
             mostrarAviso("Nenhuma categoria disponível ou erro na configuração.");
        }
        if(elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if(elPaginacaoControles) elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none';
    }
}

// --- Função para Carregar Pergunta ---
function carregarPergunta() {
    if (!elementosEssenciaisQuizExistem() || perguntasFiltradas.length === 0) {
         console.log("carregarPergunta: Elementos ausentes ou sem perguntas filtradas.");
         return;
     }

    // Garante que a página correta da grid esteja visível
    const paginaNecessaria = Math.floor(perguntaAtual / QUESTOES_POR_PAGINA_GRID) + 1;
    if (paginaNecessaria !== paginaAtualGrid) {
        mudarPaginaGrid(paginaNecessaria);
        // A mudança de página já vai renderizar a grid e atualizar os estilos
    }

    elQuizSection.style.display = 'flex';
    atualizarUINavegacaoQuiz(); // Atualiza barra e estilos da grid atual

    if (perguntaAtual >= perguntasFiltradas.length || perguntaAtual < 0) {
        console.warn(`Índice de pergunta (${perguntaAtual}) inválido. Mostrando resultado.`);
        mostrarResultadoFinal();
        return;
    }

    const pergunta = perguntasFiltradas[perguntaAtual];
    if (!pergunta) {
        console.error(`Erro: Pergunta não encontrada no índice ${perguntaAtual}.`);
        mostrarAviso("Erro ao carregar dados da pergunta.");
        mostrarResultadoFinal();
        return;
    }

    limparAreaPergunta();
    preencherDetalhesQuestao(pergunta, perguntaAtual);
    exibirImagemQuestao(pergunta.imagem, perguntaAtual);
    criarBotoesResposta(pergunta);
    configurarBotoesNavegacao(perguntaAtual, perguntasFiltradas.length);
}

// --- Funções Auxiliares de carregarPergunta ---
function elementosEssenciaisQuizExistem() {
    const ok = elQuizSection && elRespostasContainer && elPerguntaTexto && elIdQuestao && elCategoriaTitulo && elReferencia && elNavigationButtons && elPrevBtn && elNextBtn;
     if (!ok) {
         console.error("Erro crítico: Elementos essenciais do quiz não encontrados/cacheados.");
     }
    return ok;
}

function atualizarUINavegacaoQuiz() {
    clearTimeout(autoAvancoTimeoutId);
    autoAvancoTimeoutId = null;
    atualizarBarraProgresso();
    atualizarGridEstilos(perguntaAtual); // Atualiza estilos da grid visível
}

function limparAreaPergunta() {
    if (elRespostasContainer) elRespostasContainer.innerHTML = '';
    if (elPerguntaImagem) {
        elPerguntaImagem.style.display = 'none';
        elPerguntaImagem.src = "";
        elPerguntaImagem.alt = "";
    }
}

function preencherDetalhesQuestao(pergunta, indice) {
    let tituloCat = "Questão";
    if (pergunta.categorias && pergunta.categorias.length > 0) {
        tituloCat = pergunta.categorias[0];
    } else if (categoriasSelecionadas.length === 1) {
        tituloCat = categoriasSelecionadas[0];
    }
    if (elCategoriaTitulo) elCategoriaTitulo.innerText = tituloCat;
    if (elIdQuestao) elIdQuestao.innerText = indice + 1;
    if (elPerguntaTexto) elPerguntaTexto.textContent = pergunta.pergunta;
    if (elReferencia) elReferencia.textContent = `Referência: ${pergunta.referencia || 'N/A'}`;
}

function exibirImagemQuestao(urlImagem, indice) {
    if (elPerguntaImagem && urlImagem && urlImagem.trim() !== "") {
        elPerguntaImagem.src = urlImagem;
        elPerguntaImagem.alt = `Imagem da questão ${indice + 1}`;
        elPerguntaImagem.style.display = 'block';
        elPerguntaImagem.onerror = () => {
            elPerguntaImagem.style.display = 'none';
            console.warn(`Erro ao carregar imagem: ${urlImagem}`);
        };
    } else if (elPerguntaImagem) {
        elPerguntaImagem.style.display = 'none';
    }
}

function criarBotoesResposta(pergunta) {
    if (!elRespostasContainer) return;
    if (!pergunta.respostas || !Array.isArray(pergunta.respostas)) {
        console.error(`Pergunta ID ${pergunta.id} não possui array de respostas válido.`);
        elRespostasContainer.innerHTML = '<p class="aviso-mensagem erro">Erro: Opções de resposta não encontradas.</p>';
        return;
    }

    const jaRespondida = pergunta.hasOwnProperty('respostaDada');

    pergunta.respostas.forEach((respostaTexto) => {
        const p = document.createElement('p');
        p.classList.add('answer');
        p.textContent = respostaTexto;

        if (jaRespondida) {
            marcarRespostaComoJaFeita(p, pergunta, respostaTexto);
        } else {
            p.onclick = () => verificarResposta(p, pergunta);
        }
        elRespostasContainer.appendChild(p);
    });
}

function marcarRespostaComoJaFeita(elementoP, pergunta, textoResposta) {
     elementoP.onclick = null;
     elementoP.classList.add('answered');
     if (textoResposta === pergunta.correta) elementoP.classList.add('correct');
     if (textoResposta === pergunta.respostaDada && textoResposta !== pergunta.correta) elementoP.classList.add('incorrect');
}

function configurarBotoesNavegacao(indiceAtual, totalPerguntas) {
     if (!elNavigationButtons && elQuizSection) {
        elNavigationButtons = elQuizSection.querySelector('.navigation-buttons');
        if (elNavigationButtons) {
            elPrevBtn = elNavigationButtons.querySelector('#prev-btn');
            elNextBtn = elNavigationButtons.querySelector('#next-btn');
        } else {
            console.warn("Aviso: .navigation-buttons não encontrado ao configurar botões.");
            return;
        }
    }
     if (!elPrevBtn || !elNextBtn) {
         console.warn("Aviso: Botões prev/next não encontrados.");
         return;
     }

    elNavigationButtons.style.display = 'flex';
    elPrevBtn.disabled = indiceAtual === 0;
    elNextBtn.disabled = false;
    elNextBtn.innerText = (indiceAtual === totalPerguntas - 1) ? 'Ver Resultado' : 'Próxima';
}

// --- Função para Verificar Resposta ---
function verificarResposta(elementoClicado, pergunta) {
     if (pergunta.hasOwnProperty('respostaDada') || !elementoClicado || !elRespostasContainer) return;

     clearTimeout(autoAvancoTimeoutId);

     const respostaSelecionada = elementoClicado.textContent;
     pergunta.respostaDada = respostaSelecionada;

     desabilitarRespostas();
     aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada);
     atualizarEstadoAposResposta(pergunta, respostaSelecionada);
     atualizarGridEstilos(perguntaAtual); // Atualiza estilo na grid
     agendarProximaQuestao(1500);
 }

// --- Funções Auxiliares de verificarResposta ---
function desabilitarRespostas() {
    const allAnswers = elRespostasContainer.querySelectorAll('.answer');
    allAnswers.forEach(ans => {
        ans.onclick = null;
        ans.classList.add('answered');
    });
}

function aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada) {
     const correta = respostaSelecionada === pergunta.correta;
     elementoClicado.classList.add(correta ? "correct" : "incorrect");
     if (!correta) {
         const allAnswers = elRespostasContainer.querySelectorAll('.answer');
         allAnswers.forEach(ans => {
             if (ans.textContent === pergunta.correta) {
                 ans.classList.add('correct');
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
    autoAvancoTimeoutId = setTimeout(proximaPergunta, delayMs);
}


// --- Funções de Navegação do Quiz (Botões) ---
function proximaPergunta() {
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;
    if (perguntaAtual < perguntasFiltradas.length - 1) {
        perguntaAtual++;
        carregarPergunta();
    } else {
        mostrarResultadoFinal();
    }
}

function perguntaAnterior() {
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;
    if (perguntaAtual > 0) {
        perguntaAtual--;
        carregarPergunta();
    }
}

// --- Funções de Resultado Final ---
function mostrarResultadoFinal() {
    clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null;

    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    if (elPaginacaoControles) elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none';

    if (elResultadoCard) {
        elResultadoCard.style.display = 'block';
        preencherMensagemFinal();
    } else {
        console.error("Erro: .resultado-final-card não encontrado.");
        mostrarAviso(`Quiz Concluído! Pontuação Final: ${usuario.pontos}, Acertos: ${usuario.acertos}, Erros: ${usuario.erros}`);
    }
}

function preencherMensagemFinal() {
    if (!elResultadoCard || !filtroCheckboxesContainer) return;

    const tit = elResultadoCard.querySelector('.resultado-final-titulo');
    const pont = elResultadoCard.querySelector('.resultado-final-pontuacao .pontos-valor');
    const acert = elResultadoCard.querySelector('.resultado-final-detalhes .acertos-valor');
    const err = elResultadoCard.querySelector('.resultado-final-detalhes .erros-valor');

    if (!tit || !pont || !acert || !err) {
        console.error("Erro ao preencher resultado: Elementos internos do card não encontrados.");
        return;
    }

    tit.textContent = gerarTituloResultadoFinal();
    pont.textContent = usuario.pontos;
    acert.textContent = usuario.acertos;
    err.textContent = usuario.erros;
}

function gerarTituloResultadoFinal() {
    // Usa o container PAI para pegar os checkboxes originais
    const outrosCheckboxes = filtroCheckboxesContainer?.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:not([value="Todas"])');
    const categoriasAtivas = obterCategoriasSelecionadas();
    const cbTodas = filtroCheckboxesContainer?.querySelector('#filtro-checkboxes-scroll input[value="Todas"]');

    if (categoriasAtivas.length === 1) {
        return `Quiz de ${categoriasAtivas[0]} Concluído!`;
    } else if (cbTodas?.checked && outrosCheckboxes && categoriasAtivas.length === outrosCheckboxes.length) {
        return `Quiz de Todas as Categorias Concluído!`;
    } else if (categoriasAtivas.length > 1) {
        return `Quiz de Múltiplas Categorias Concluído!`;
    }
    return "Quiz Concluído!"; // Título Padrão
}

// --- Função para Atualizar Pontuação na Sidebar ---
function atualizar_pontuacao() {
    if (elPontuacao) elPontuacao.textContent = usuario.pontos;
    if (elAcertosNum) elAcertosNum.textContent = usuario.acertos;
    if (elErrosNum) elErrosNum.textContent = usuario.erros;
}

// --- Carregamento Inicial e Event Listeners ---
async function carregarPerguntasJSON() {
    try {
        // Adiciona um timestamp para tentar evitar cache do JSON
        const timestamp = Date.now();
        const response = await fetch(`assets/data/questions.json?t=${timestamp}`);
        if (!response.ok) {
            throw new Error(`Falha ao buscar questions.json. Status: ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !(contentType.includes("application/json") || contentType.includes("text/plain"))) {
           console.warn(`Tipo de conteúdo (${contentType}) não é estritamente application/json, mas tentando processar...`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("O formato dos dados das perguntas é inválido (não é um Array).");
        }
        perguntas = data;
        console.log(`Perguntas carregadas com sucesso (${perguntas.length} perguntas).`);
        return true;
    } catch (error) {
        console.error("Erro CRÍTICO durante o carregamento das perguntas:", error);
        if (!avisoContainer || !avisoMensagem) cacheDOMelements();
        if (avisoContainer && avisoMensagem) {
             mostrarSecao('questoes-section');
             mostrarAviso(`Falha grave ao carregar perguntas: ${error.message}. O quiz não pode iniciar.`);
        } else {
             alert(`Falha grave ao carregar as perguntas: ${error.message}`);
        }
        return false;
    }
}

function configurarEventListeners() {
    // Listener da Navbar
    document.querySelectorAll('.navbar .nav-link').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const clickedLink = event.target.closest('a');
            if (!clickedLink) return;
            const secaoId = clickedLink.dataset.section;
            if (secaoId && secaoId !== secaoAtual) {
                document.querySelectorAll('.navbar .nav-link.active').forEach(al => al.classList.remove('active'));
                clickedLink.classList.add('active');
                mostrarSecao(secaoId);
            }
        });
    });

    // Listener dos Checkboxes de Filtro (delegação no container PAI)
    if (filtroCheckboxesContainer) {
        // O listener é no container PAI, mas verificamos se o alvo está DENTRO do rolável
        filtroCheckboxesContainer.addEventListener('change', (event) => {
            // Verifica se o evento ocorreu num checkbox dentro da área rolável
            if (event.target?.type === 'checkbox' && event.target.closest('#filtro-checkboxes-scroll')) {
                handleCheckboxChange(event.target);
                atualizarFiltroECarregarPerguntas();
                // Atualiza setas após mudança de filtro
                setTimeout(atualizarSetasScrollCategorias, 100);
            }
        });
    } else {
        console.warn("Container PAI de filtro de categorias não encontrado para adicionar listener.");
    }

    // Listeners dos Botões de Navegação do Quiz
    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior);
    if (elNextBtn) elNextBtn.addEventListener('click', proximaPergunta);

    // Listeners para as Setas de Rolagem das Categorias
    if (elCatScrollLeft) {
        elCatScrollLeft.addEventListener('click', () => rolarCategorias('left'));
    }
    if (elCatScrollRight) {
        elCatScrollRight.addEventListener('click', () => rolarCategorias('right'));
    }

    // Listener para atualizar setas durante rolagem por toque/outros meios
    if (elFiltroCheckboxesScroll) {
        // Usar { passive: true } pode melhorar performance de scroll
        elFiltroCheckboxesScroll.addEventListener('scroll', atualizarSetasScrollCategorias, { passive: true });
    }

    // Listener para atualizar setas em redimensionamento da janela
    // Usar debounce/throttle aqui seria ideal para performance, mas para simplicidade:
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(atualizarSetasScrollCategorias, 150);
    });
}

// Função auxiliar para lógica dos checkboxes
function handleCheckboxChange(changedCheckbox) {
     // Seleciona os checkboxes dentro do container rolável
     if (!elFiltroCheckboxesScroll) return;
     const cbTodas = elFiltroCheckboxesScroll.querySelector('input[value="Todas"]');
     const outrosCheckboxes = elFiltroCheckboxesScroll.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');

     if (!cbTodas || !outrosCheckboxes) {
          console.error("Não foi possível encontrar os checkboxes de filtro dinamicamente.");
          return;
     }

     if (changedCheckbox === cbTodas) {
         outrosCheckboxes.forEach(cb => { cb.checked = cbTodas.checked; });
     } else {
         let todosMarcados = true;
         outrosCheckboxes.forEach(cb => { if (!cb.checked) todosMarcados = false; });
         cbTodas.checked = todosMarcados;
     }
}


// --- Inicialização Principal ---
document.addEventListener('DOMContentLoaded', async () => {
    const perguntasCarregadas = await carregarPerguntasJSON();

    if (perguntasCarregadas) {
        if (!cacheDOMelements()) {
             console.error("Erro Crítico: Falha ao encontrar elementos DOM essenciais.");
             mostrarAviso("Erro crítico na interface do quiz. Verifique o console.");
            return;
        }

        try {
            const categoriasUnicas = extrairCategoriasUnicas(perguntas);
            // Passa o elemento rolável correto para gerar os checkboxes DENTRO dele
            gerarCheckboxesCategoria(elFiltroCheckboxesScroll, categoriasUnicas);
            console.log("Filtros de categoria gerados.");
        } catch(error) {
            console.error("Erro ao gerar filtros de categoria:", error);
            mostrarAviso("Erro ao configurar filtros de categoria.");
        }

        configurarEventListeners();

        const linkInicialAtivo = document.querySelector('.navbar .nav-link.active');
        const secaoInicialId = linkInicialAtivo?.dataset.section || 'inicio-section';
        mostrarSecao(secaoInicialId);

        // Chama uma vez para garantir estado inicial correto das setas
        setTimeout(atualizarSetasScrollCategorias, 150);
    }
});