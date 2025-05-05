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

let perguntas = [];
let perguntaAtual = 0;
let perguntasFiltradas = [];
let categoriasSelecionadas = [];
const usuario = new Usuario();
let secaoAtual = 'inicio-section';
const QUESTOES_POR_PAGINA_GRID = 5;
let paginaAtualGrid = 1;

let elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elNavigationButtons, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, avisoMensagem;
let elQuestionGridContainer;
let elPaginacaoControles;
let elFiltroCheckboxesScroll;
let elCatScrollLeft;
let elCatScrollRight;
let elBtnEncerrarSessao;
let elBtnRecomecar;
let elConfirmEncerrarOverlay, elConfirmEncerrarBtn, elCancelEncerrarBtn;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

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
        elConfirmEncerrarOverlay = document.getElementById('confirm-encerrar-overlay');
        elConfirmEncerrarBtn = document.getElementById('confirm-encerrar-btn');
        elCancelEncerrarBtn = document.getElementById('cancel-encerrar-btn');

        const elementos = {
            elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, elQuestionGridContainer, elPaginacaoControles, elFiltroCheckboxesScroll, elCatScrollLeft, elCatScrollRight, elBtnEncerrarSessao, elBtnRecomecar,
            elConfirmEncerrarOverlay, elConfirmEncerrarBtn, elCancelEncerrarBtn
        };
        let missingElements = false;
        for (const key in elementos) {
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

function mostrarAviso(texto) {
    if (!avisoContainer || !avisoMensagem) {
        console.warn("Tentativa de mostrar aviso, mas elementos não encontrados.");
        return;
    }
    avisoMensagem.textContent = texto;
    avisoContainer.style.display = 'block';
    if (secaoAtual === 'questoes-section') {
        if (elQuizSection) elQuizSection.style.display = 'none';
        if (elProgressContainer) elProgressContainer.style.display = 'none';
        if (elProgressText) elProgressText.style.display = 'none';
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) elPaginacaoControles.style.display = 'none';
        if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
        if (elResultadoCard) elResultadoCard.style.display = 'none';
        if (filtroCheckboxesContainer) filtroCheckboxesContainer.style.display = 'flex';
    }
}
function limparAviso() {
    if (avisoContainer) {
        avisoContainer.style.display = 'none';
    }
}

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
    containerElemento.innerHTML = '';

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

function rolarCategorias(direcao) {
    if (!elFiltroCheckboxesScroll) return;
    const scrollAmount = elFiltroCheckboxesScroll.clientWidth * 0.8;
    elFiltroCheckboxesScroll.scrollBy({ left: direcao === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(atualizarSetasScrollCategorias, 400);
}

function atualizarSetasScrollCategorias() {
    if (window.innerWidth <= 768) {
         if(elCatScrollLeft) { elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true; }
         if(elCatScrollRight) { elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true; }
        return;
    }

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
        elCatScrollLeft.style.opacity = '';
        elCatScrollRight.style.opacity = '';
        elCatScrollLeft.style.pointerEvents = elCatScrollLeft.disabled ? 'none' : 'auto';
        elCatScrollRight.style.pointerEvents = elCatScrollRight.disabled ? 'none' : 'auto';
    }
}

function atualizarBarraProgresso() {
    if (!elProgressContainer || !elProgressBarFill || !elProgressText) return;
    const quizAtivo = elQuizSection && (elQuizSection.style.display === 'flex' || elQuizSection.style.display === 'block');
    const temPerguntas = perguntasFiltradas && perguntasFiltradas.length > 0;

    if (quizAtivo && temPerguntas) {
        elProgressContainer.style.display = 'block';
        elProgressText.style.display = 'block';
        const totalPerguntas = perguntasFiltradas.length;
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
     if (filtroCheckboxesContainer) filtroCheckboxesContainer.style.display = 'flex';
     atualizarFiltroECarregarPerguntas();
}

function esconderElementosQuiz() {
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    if (elPaginacaoControles) { elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none'; }
    if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
}

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
    elQuestionGridContainer.innerHTML = '';
    elPaginacaoControles.innerHTML = '';
    elPaginacaoControles.style.display = 'none';

    paginaAtualGrid = Math.floor(perguntaAtual / QUESTOES_POR_PAGINA_GRID) + 1;
    const inicio = (paginaAtualGrid - 1) * QUESTOES_POR_PAGINA_GRID;
    const fim = Math.min(inicio + QUESTOES_POR_PAGINA_GRID, perguntasFiltradas.length);

    const criarSetaNavegacao = (direcao, ariaLabel) => {
        const setaBtn = document.createElement('button');
        setaBtn.classList.add('grid-nav-arrow');
        setaBtn.setAttribute('aria-label', ariaLabel);

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("height", "24px");
        svg.setAttribute("viewBox", "0 -960 960 960");
        svg.setAttribute("width", "24px");
        svg.setAttribute("fill", "currentColor");

        const path = document.createElementNS(svgNS, "path");
        if (direcao === 'prev') {
            path.setAttribute("d", "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z");
            setaBtn.onclick = () => irParaQuestao(perguntaAtual - 1);
            setaBtn.disabled = perguntaAtual === 0;
        } else {
            path.setAttribute("d", "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z");
            setaBtn.onclick = () => irParaQuestao(perguntaAtual + 1);
            setaBtn.disabled = perguntaAtual === perguntasFiltradas.length - 1;
        }
        svg.appendChild(path);
        setaBtn.appendChild(svg);
        return setaBtn;
    };

    elQuestionGridContainer.appendChild(criarSetaNavegacao('prev', 'Questão Anterior'));

    for (let i = inicio; i < fim; i++) {
        const gridItem = document.createElement('button');
        gridItem.classList.add('grid-item');
        gridItem.textContent = i + 1;
        gridItem.dataset.index = i;
        gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
        gridItem.onclick = () => irParaQuestao(i);
        elQuestionGridContainer.appendChild(gridItem);
    }

    elQuestionGridContainer.appendChild(criarSetaNavegacao('next', 'Próxima Questão'));
    atualizarGridEstilos(perguntaAtual);
}

function atualizarGridEstilos(indiceAtualGlobal) {
      if (!elQuestionGridContainer || !perguntasFiltradas) return;
    const items = elQuestionGridContainer.querySelectorAll('.grid-item');
    items.forEach(item => {
        const itemIndexGlobal = parseInt(item.dataset.index, 10);
        if (isNaN(itemIndexGlobal) || itemIndexGlobal < 0 || itemIndexGlobal >= perguntasFiltradas.length) return;

        const pergunta = perguntasFiltradas[itemIndexGlobal];
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect');

        if (pergunta?.hasOwnProperty('respostaDada')) {
             const classeEstado = pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect';
             item.classList.add(classeEstado);
        }
        if (itemIndexGlobal === indiceAtualGlobal) {
            item.classList.add('grid-item--current');
        }
    });

    const setaPrev = elQuestionGridContainer.querySelector('.grid-nav-arrow[aria-label="Questão Anterior"]');
    const setaNext = elQuestionGridContainer.querySelector('.grid-nav-arrow[aria-label="Próxima Questão"]');
    if (setaPrev) setaPrev.disabled = indiceAtualGlobal === 0;
    if (setaNext) setaNext.disabled = indiceAtualGlobal === perguntasFiltradas.length - 1;
}

function irParaQuestao(indice) {
     if (perguntasFiltradas && indice >= 0 && indice < perguntasFiltradas.length) {
         perguntaAtual = indice;
         carregarPergunta();
         renderizarGridEPaginacao();
      } else {
          if (perguntasFiltradas && indice >= perguntasFiltradas.length) {
              mostrarResultadoFinal();
          }
          console.warn(`Tentativa de ir para questão com índice inválido ou fora dos limites: ${indice}`);
      }
}

function atualizarFiltroECarregarPerguntas() {
     if (!filtroCheckboxesContainer || !elQuizSection) return;
     limparAviso();
     categoriasSelecionadas = obterCategoriasSelecionadas();
     perguntasFiltradas = filtrarPerguntas(perguntas, categoriasSelecionadas);
     reiniciarEstadoQuiz();
     paginaAtualGrid = 1;
     renderizarGridEPaginacao();
     setTimeout(atualizarSetasScrollCategorias, 100);
     if (elResultadoCard) elResultadoCard.style.display = 'none';
     if (elQuizSection) elQuizSection.style.display = 'none';
     exibirQuizOuAviso(perguntasFiltradas, categoriasSelecionadas);
     atualizarBarraProgresso();
}

function filtrarPerguntas(listaCompleta, categoriasFiltro) {
    let filtradas = [];
    if (!Array.isArray(listaCompleta)) {
        console.error('ERRO FATAL: "perguntas" não é array!');
        mostrarAviso("Erro interno ao carregar perguntas.");
        return [];
    }
    if (categoriasFiltro.length > 0) {
        filtradas = listaCompleta.filter(p =>
            p.categorias && Array.isArray(p.categorias) && p.categorias.some(cat => categoriasFiltro.includes(cat))
        );
    } else {
        filtradas = [];
    }
    filtradas.forEach(p => delete p.respostaDada);
    return filtradas;
}

function reiniciarEstadoQuiz() {
    perguntaAtual = 0;
    usuario.resetarContadores();
    atualizar_pontuacao();
    if (perguntasFiltradas && Array.isArray(perguntasFiltradas)) {
        perguntasFiltradas.forEach(p => delete p.respostaDada);
    }
}

function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    limparAviso();
    if (perguntasParaExibir.length > 0) {
        if(elQuizSection) elQuizSection.style.display = 'flex';
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'block';
        carregarPergunta();
        renderizarGridEPaginacao();
        atualizarBarraProgresso();
    } else {
        if(elQuizSection) elQuizSection.style.display = 'none';
        if(elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if(elPaginacaoControles) elPaginacaoControles.style.display = 'none';
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
        if(elProgressContainer) elProgressContainer.style.display = 'none';
        if(elProgressText) elProgressText.style.display = 'none';

        const temCheckboxesDeCategoria = elFiltroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
        if (categoriasAtivas.length === 0 && temCheckboxesDeCategoria) {
            mostrarAviso("Selecione pelo menos uma categoria para começar.");
        } else if (categoriasAtivas.length > 0) {
            mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
        } else if (!temCheckboxesDeCategoria) {
            mostrarAviso("Nenhuma categoria de pergunta disponível.");
        } else {
            mostrarAviso("Selecione uma categoria para iniciar.");
        }
    }
}

function carregarPergunta() {
    if (!elementosEssenciaisQuizExistem() || !perguntasFiltradas || perguntasFiltradas.length === 0) {
         console.error("Tentativa de carregar pergunta sem elementos/perguntas.");
         return;
    }
    if (perguntaAtual < 0 || perguntaAtual >= perguntasFiltradas.length) {
        mostrarResultadoFinal();
        return;
    }
    if(elQuizSection) elQuizSection.style.display = 'flex';
    atualizarUINavegacaoQuiz();
    const pergunta = perguntasFiltradas[perguntaAtual];
    if (!pergunta) {
        console.error(`Erro: Pergunta ${perguntaAtual} indefinida no array filtrado.`);
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

function elementosEssenciaisQuizExistem() {
     const ok = elQuizSection && elRespostasContainer && elPerguntaTexto && elIdQuestao && elCategoriaTitulo && elReferencia && elNavigationButtons && elPrevBtn && elNextBtn && elProgressBarFill && elProgressText && elProgressContainer && elQuestionGridContainer && elPaginacaoControles && elPontuacao && elAcertosNum && elErrosNum;
     if (!ok) {
          console.error("Erro crítico: Elementos essenciais da UI do quiz não encontrados no DOM.");
          if (!cacheDOMelements()) {
               alert("Erro grave na interface do quiz. Por favor, recarregue a página.");
          }
     }
     return ok;
}

function atualizarUINavegacaoQuiz() {
     atualizarBarraProgresso();
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
    const categoriasDaQuestao = pergunta.categorias || [];
    const checkboxTodas = document.getElementById('cat-todas');

    if (checkboxTodas && checkboxTodas.checked && categoriasDaQuestao.length > 0) {
        tituloCat = categoriasDaQuestao.join(' / ');
    } else {
        const categoriaFiltradaAtiva = categoriasSelecionadas.find(catFiltro => categoriasDaQuestao.includes(catFiltro));
        if (categoriaFiltradaAtiva) {
            tituloCat = categoriaFiltradaAtiva;
        } else if (categoriasDaQuestao.length > 0) {
            tituloCat = categoriasDaQuestao[0];
        }
    }

    if (elCategoriaTitulo) elCategoriaTitulo.innerText = tituloCat;
    if (elIdQuestao) elIdQuestao.innerText = indice + 1;
    if (elPerguntaTexto) elPerguntaTexto.textContent = pergunta.pergunta;
    if (elReferencia) elReferencia.textContent = `Referência: ${pergunta.referencia || 'N/A'}`;
}

function exibirImagemQuestao(urlImagem, indice) {
    if (elPerguntaImagem) {
        if (urlImagem && typeof urlImagem === 'string' && urlImagem.trim() !== "") {
            elPerguntaImagem.src = urlImagem;
            elPerguntaImagem.alt = `Imagem ilustrativa da questão ${indice + 1}`;
            elPerguntaImagem.style.display = 'block';
            elPerguntaImagem.onerror = () => {
                 elPerguntaImagem.style.display = 'none';
                 console.warn(`Erro ao carregar imagem para questão ${indice + 1}: ${urlImagem}`);
            };
        } else {
            elPerguntaImagem.style.display = 'none';
        }
    }
}

function criarBotoesResposta(pergunta) {
     if (!elRespostasContainer) return;
     elRespostasContainer.innerHTML = '';

     if (!pergunta.respostas || !Array.isArray(pergunta.respostas) || pergunta.respostas.length === 0) {
          console.error(`Pergunta ${pergunta.id || perguntaAtual} sem array de respostas válido.`);
          elRespostasContainer.innerHTML = '<p style="color: var(--color-accent-red);">Erro: Opções de resposta não encontradas.</p>';
          return;
     }

     const jaRespondida = pergunta.hasOwnProperty('respostaDada');

     pergunta.respostas.forEach((respostaTexto) => {
          const p = document.createElement('p');
          p.classList.add('answer');
          p.textContent = respostaTexto;
          p.setAttribute('role', 'button');
          p.tabIndex = 0;

          if (jaRespondida) {
               marcarRespostaComoJaFeita(p, pergunta, respostaTexto);
          } else {
               p.onclick = () => verificarResposta(p, pergunta);
               p.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault();
                         verificarResposta(p, pergunta);
                    }
               };
          }
          elRespostasContainer.appendChild(p);
     });
}

function marcarRespostaComoJaFeita(elementoResposta, pergunta, textoDaResposta) {
    elementoResposta.onclick = null;
    elementoResposta.onkeydown = null;
    elementoResposta.classList.add('answered');
    elementoResposta.style.cursor = 'default';
    elementoResposta.tabIndex = -1;
    if (textoDaResposta === pergunta.correta) {
         elementoResposta.classList.add('correct');
    } else if (textoDaResposta === pergunta.respostaDada) {
         elementoResposta.classList.add('incorrect');
    }
}

function configurarBotoesNavegacao(indiceAtual, totalPerguntas) {
     if (!elNavigationButtons || !elPrevBtn || !elNextBtn) {
         console.warn("configurarBotoesNavegacao: Botões (Prev/Next) não encontrados.");
         if (elQuizSection) {
             elNavigationButtons = elQuizSection.querySelector('.navigation-buttons');
             if (elNavigationButtons) {
                 elPrevBtn = elNavigationButtons.querySelector('#prev-btn');
                 elNextBtn = elNavigationButtons.querySelector('#next-btn');
             }
         }
         if (!elPrevBtn || !elNextBtn) {
            console.error("configurarBotoesNavegacao: FALHA ao encontrar botões.");
            return;
         }
     }

    if(elNavigationButtons) elNavigationButtons.style.display = 'flex';
    if(elPrevBtn) elPrevBtn.disabled = indiceAtual === 0;

    if(elNextBtn) {
         const ultimaQuestao = indiceAtual === totalPerguntas - 1;
         elNextBtn.innerText = ultimaQuestao ? 'Ver Resultado' : 'Próxima';
         elNextBtn.disabled = false;
    }
}

function verificarResposta(elementoClicado, pergunta) {
    if (pergunta.hasOwnProperty('respostaDada') || !elementoClicado || !elRespostasContainer) {
        return;
    }

    const respostaSelecionada = elementoClicado.textContent;
    pergunta.respostaDada = respostaSelecionada;

    desabilitarRespostas();
    aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada);
    atualizarEstadoAposResposta(pergunta, respostaSelecionada);
    atualizarGridEstilos(perguntaAtual);
}

function desabilitarRespostas() {
    if (!elRespostasContainer) return;
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
    if (!ehCorreta && elRespostasContainer) {
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

function proximaPergunta() {
    if (!perguntasFiltradas) return;
    irParaQuestao(perguntaAtual + 1);
}

function perguntaAnterior() {
    irParaQuestao(perguntaAtual - 1);
}

function mostrarResultadoFinal() {
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    if (elPaginacaoControles) elPaginacaoControles.style.display = 'none';
    if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
    if (filtroCheckboxesContainer) filtroCheckboxesContainer.style.display = 'none';

    if (elResultadoCard) {
        elResultadoCard.style.display = 'block';
        preencherMensagemFinal();
        const tituloResultado = elResultadoCard.querySelector('.resultado-final-titulo');
        if (tituloResultado) tituloResultado.focus();
    } else {
        console.error("Elemento .resultado-final-card não encontrado.");
        mostrarAviso(`Quiz Concluído! Pontos: ${usuario.pontos} (Acertos: ${usuario.acertos}, Erros: ${usuario.erros})`);
    }
}

function preencherMensagemFinal() {
     if (!elResultadoCard || !filtroCheckboxesContainer) return;
     const tituloEl = elResultadoCard.querySelector('.resultado-final-titulo');
     const pontuacaoEl = elResultadoCard.querySelector('.pontos-valor');
     const acertosEl = elResultadoCard.querySelector('.acertos-valor');
     const errosEl = elResultadoCard.querySelector('.erros-valor');
     if (!tituloEl || !pontuacaoEl || !acertosEl || !errosEl) {
          console.error("Elementos internos do card de resultado final não encontrados.");
          return;
     }
     tituloEl.textContent = gerarTituloResultadoFinal();
     pontuacaoEl.textContent = usuario.pontos;
     acertosEl.textContent = usuario.acertos;
     errosEl.textContent = usuario.erros;
}

function gerarTituloResultadoFinal() {
     const todosCheckboxesCategorias = filtroCheckboxesContainer?.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:not([value="Todas"])');
     const checkboxTodas = filtroCheckboxesContainer?.querySelector('#filtro-checkboxes-scroll input[value="Todas"]');
     const categoriasAtivas = obterCategoriasSelecionadas();

     if (!todosCheckboxesCategorias || !checkboxTodas) return "Quiz Concluído!";

     const totalCategoriasDisponiveis = todosCheckboxesCategorias.length;

     if (categoriasAtivas.length === 1) {
          return `Quiz de "${categoriasAtivas[0]}" Concluído!`;
     } else if (categoriasAtivas.length === totalCategoriasDisponiveis && totalCategoriasDisponiveis > 0) {
          if (checkboxTodas.checked) {
                return `Quiz de Todas as Categorias Concluído!`;
           } else {
                return `Quiz (Todas as Categorias) Concluído!`;
           }
     } else if (categoriasAtivas.length > 1) {
          return `Quiz de Múltiplas Categorias Concluído!`;
     } else {
          return "Quiz Finalizado!";
     }
}

function atualizar_pontuacao() {
    if (elPontuacao) elPontuacao.textContent = usuario.pontos;
    if (elAcertosNum) elAcertosNum.textContent = usuario.acertos;
    if (elErrosNum) elErrosNum.textContent = usuario.erros;
}

function showConfirmEncerrarModal() {
     if (elConfirmEncerrarOverlay) {
          elConfirmEncerrarOverlay.style.display = 'flex';
          void elConfirmEncerrarOverlay.offsetWidth;
          elConfirmEncerrarOverlay.classList.add('visible');
          if(elCancelEncerrarBtn) elCancelEncerrarBtn.focus();
      }
}
function hideConfirmEncerrarModal() {
     if (elConfirmEncerrarOverlay) {
          elConfirmEncerrarOverlay.classList.remove('visible');
      }
}

async function carregarPerguntasJSON() {
     try {
          const timestamp = Date.now();
          const response = await fetch(`assets/data/questions.json?t=${timestamp}`);
          if (!response.ok) {
               throw new Error(`Falha ao carregar: ${response.status} ${response.statusText}`);
          }
          const contentType = response.headers.get("content-type");
          if (!contentType || !(contentType.includes("application/json") || contentType.includes("text/plain"))) {
               console.warn(`Aviso: Content-Type inesperado ao carregar perguntas: ${contentType}`);
          }
          const data = await response.json();
          if (!Array.isArray(data)) {
               throw new Error("Formato de dados inválido (esperava um Array).");
          }
          perguntas = data;
          console.log(`Perguntas carregadas com sucesso (${perguntas.length} perguntas).`);
          return true;
     } catch (error) {
          console.error("Erro CRÍTICO ao carregar ou processar 'questions.json':", error);
          if (!avisoContainer || !avisoMensagem) cacheDOMelements();
          if (avisoContainer && avisoMensagem) {
               mostrarSecao('questoes-section');
               mostrarAviso(`Falha ao carregar as perguntas: ${error.message}. Verifique o arquivo 'questions.json' e a conexão.`);
          } else {
               alert(`Falha crítica ao carregar perguntas: ${error.message}`);
          }
          return false;
     }
}

function configurarEventListeners() {
    const topNavLinks = document.querySelectorAll('.navbar .nav-link');
    topNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedLink = e.target.closest('a');
            if (!clickedLink) return;
            const targetSectionId = clickedLink.dataset.section;
            if (targetSectionId && targetSectionId !== secaoAtual) {
                document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => {
                    activeLink.classList.remove('active');
                    activeLink.removeAttribute('aria-current');
                });
                clickedLink.classList.add('active');
                clickedLink.setAttribute('aria-current', 'page');
                const correspondingBottomLink = document.querySelector(`.bottom-navbar .bottom-nav-link[data-section="${targetSectionId}"]`);
                if (correspondingBottomLink) {
                    correspondingBottomLink.classList.add('active');
                    correspondingBottomLink.setAttribute('aria-current', 'page');
                }
                mostrarSecao(targetSectionId);
            }
        });
    });

    const bottomNavLinks = document.querySelectorAll('.bottom-navbar .bottom-nav-link');
    bottomNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedLink = e.target.closest('a');
            if (!clickedLink) return;
            const targetSectionId = clickedLink.dataset.section;
            if (targetSectionId && targetSectionId !== secaoAtual) {
                 document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => {
                     activeLink.classList.remove('active');
                     activeLink.removeAttribute('aria-current');
                 });
                 clickedLink.classList.add('active');
                 clickedLink.setAttribute('aria-current', 'page');
                 const correspondingTopLink = document.querySelector(`.navbar .nav-link[data-section="${targetSectionId}"]`);
                 if (correspondingTopLink) {
                     correspondingTopLink.classList.add('active');
                     correspondingTopLink.setAttribute('aria-current', 'page');
                 }
                 mostrarSecao(targetSectionId);
            }
        });
    });

    if (filtroCheckboxesContainer) {
        filtroCheckboxesContainer.addEventListener('change', (e) => {
            if (e.target?.type === 'checkbox' && e.target.closest('#filtro-checkboxes-scroll')) {
                handleCheckboxChange(e.target);
                atualizarFiltroECarregarPerguntas();
                setTimeout(atualizarSetasScrollCategorias, 100);
            }
        });
    } else {
        console.warn("Container de filtros de categoria não encontrado para adicionar listener.");
    }

    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior);
    if (elNextBtn) {
        elNextBtn.addEventListener('click', proximaPergunta);
    } else {
        console.error("Botão Próxima/Resultado (#next-btn) não encontrado durante configuração de listeners.");
    }

    if (elCatScrollLeft) elCatScrollLeft.addEventListener('click', () => rolarCategorias('left'));
    if (elCatScrollRight) elCatScrollRight.addEventListener('click', () => rolarCategorias('right'));

    if (elFiltroCheckboxesScroll) {
        elFiltroCheckboxesScroll.addEventListener('scroll', atualizarSetasScrollCategorias, { passive: true });
    }
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            atualizarSetasScrollCategorias();
        }, 150);
    });

    if (elBtnEncerrarSessao) {
         elBtnEncerrarSessao.addEventListener('click', showConfirmEncerrarModal);
    } else { console.warn("Botão Encerrar Sessão não encontrado."); }

    if (elConfirmEncerrarBtn) {
         elConfirmEncerrarBtn.addEventListener('click', () => {
              mostrarResultadoFinal();
              hideConfirmEncerrarModal();
          });
    } else { console.warn("Botão Confirmar (Modal) não encontrado."); }

    if (elCancelEncerrarBtn) {
         elCancelEncerrarBtn.addEventListener('click', hideConfirmEncerrarModal);
    } else { console.warn("Botão Cancelar (Modal) não encontrado."); }

    if (elConfirmEncerrarOverlay) {
         elConfirmEncerrarOverlay.addEventListener('click', (event) => {
              if (event.target === elConfirmEncerrarOverlay) {
                   hideConfirmEncerrarModal();
              }
         });
    } else { console.warn("Overlay do Modal não encontrado."); }

    if (elBtnRecomecar) {
        elBtnRecomecar.addEventListener('click', reiniciarQuizCompleto);
    } else {
        console.warn("Botão Recomeçar não encontrado.");
    }
}

function handleCheckboxChange(changedCheckbox) {
     if (!elFiltroCheckboxesScroll) return;
     const cbTodas = elFiltroCheckboxesScroll.querySelector('input[value="Todas"]');
     const outrosCheckboxes = elFiltroCheckboxesScroll.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
     if (!cbTodas || !outrosCheckboxes) return;

     if (changedCheckbox === cbTodas) {
          outrosCheckboxes.forEach(cb => cb.checked = cbTodas.checked);
     } else {
          let todosMarcados = true;
          outrosCheckboxes.forEach(cb => {
               if (!cb.checked) todosMarcados = false;
          });
          cbTodas.checked = todosMarcados;
     }
}

function reiniciarQuizCompleto() {
    if (!elResultadoCard || !filtroCheckboxesContainer) {
         console.error("Tentativa de reiniciar sem elementos de resultado/filtro.");
         if (!cacheDOMelements()) {
              alert("Erro ao tentar reiniciar o quiz. Por favor, recarregue a página.");
              return;
          }
     }

    if(elResultadoCard) elResultadoCard.style.display = 'none';
    prepararSecaoQuestoes();

    const mainContent = document.querySelector('#questoes-section .main-content');
    if (mainContent) {
         mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const perguntasCarregadas = await carregarPerguntasJSON();
    if (perguntasCarregadas) {
        if (!cacheDOMelements()) {
            console.error("Erro Crítico: Falha ao encontrar elementos essenciais do DOM na inicialização.");
            const body = document.querySelector('body');
            if (body) body.innerHTML = '<p style="color:red; padding: 20px; font-family: sans-serif;">Erro grave ao inicializar a interface. Verifique o console e recarregue a página.</p>';
            return;
        }

        try {
            const categoriasUnicas = extrairCategoriasUnicas(perguntas);
            gerarCheckboxesCategoria(elFiltroCheckboxesScroll, categoriasUnicas);
            console.log("Filtros de categoria gerados.");
        } catch (error) {
            console.error("Erro ao gerar filtros de categoria:", error);
            if(avisoContainer) mostrarAviso("Erro ao configurar os filtros de categoria.");
        }

        configurarEventListeners();
        console.log("Event listeners configurados.");

        const linkAtivoInicial = document.querySelector('.navbar .nav-link.active, .bottom-navbar .bottom-nav-link.active');
        const secaoInicialId = linkAtivoInicial?.dataset.section || 'inicio-section';
        mostrarSecao(secaoInicialId);
        console.log(`Seção inicial exibida: ${secaoInicialId}`);

        setTimeout(atualizarSetasScrollCategorias, 150);

    } else {
        console.error("Inicialização interrompida: Falha ao carregar perguntas.");
    }
});
