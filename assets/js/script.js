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
const QUESTOES_POR_PAGINA_GRID = 5; // MODIFICADO: Exibe até 5 questões na grid
let paginaAtualGrid = 1; // Página atual da grid (calculada dinamicamente agora)

// --- Elementos do DOM (cacheados) ---
let elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elNavigationButtons, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, avisoMensagem;
let elQuestionGridContainer;
let elPaginacaoControles; // Mantido, mas não usado para paginação numérica mais
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
        elPaginacaoControles = document.getElementById('paginacao-controles'); // Mantém referência, mas funcionalidade muda

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
        // Esconde elementos do quiz ativo
        if (elQuizSection) elQuizSection.style.display = 'none';
        if (elProgressContainer) elProgressContainer.style.display = 'none';
        if (elProgressText) elProgressText.style.display = 'none';
        // Esconde elementos do aside relacionados ao quiz ativo
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) elPaginacaoControles.style.display = 'none'; // Esconde o container da antiga paginação
        if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
        // Esconde o resultado final se o aviso for mostrado
        if (elResultadoCard) elResultadoCard.style.display = 'none';
        // Mantém os filtros visíveis por padrão quando há aviso (para seleção)
        if (filtroCheckboxesContainer) filtroCheckboxesContainer.style.display = 'flex';
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
    // Se estiver em tela pequena (onde CSS esconde as setas), não faz nada
    if (window.innerWidth <= 768) {
         if(elCatScrollLeft) { elCatScrollLeft.style.opacity = '0'; elCatScrollLeft.style.pointerEvents = 'none'; elCatScrollLeft.disabled = true; }
         if(elCatScrollRight) { elCatScrollRight.style.opacity = '0'; elCatScrollRight.style.pointerEvents = 'none'; elCatScrollRight.disabled = true; }
        return;
    }

    // Lógica original para desktop/tablet
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
        // Usa o estilo padrão do CSS (opacity: 0.6) e habilita eventos
        elCatScrollLeft.style.opacity = '';
        elCatScrollRight.style.opacity = '';
        elCatScrollLeft.style.pointerEvents = elCatScrollLeft.disabled ? 'none' : 'auto';
        elCatScrollRight.style.pointerEvents = elCatScrollRight.disabled ? 'none' : 'auto';
    }
}

// --- Funções de Barra de Progresso ---
function atualizarBarraProgresso() {
    if (!elProgressContainer || !elProgressBarFill || !elProgressText) return;
    const quizAtivo = elQuizSection && (elQuizSection.style.display === 'flex' || elQuizSection.style.display === 'block');
    const temPerguntas = perguntasFiltradas && perguntasFiltradas.length > 0;

    // Mostra a barra apenas se o quiz estiver ativo e tiver perguntas
    if (quizAtivo && temPerguntas) {
        elProgressContainer.style.display = 'block';
        elProgressText.style.display = 'block';
        const totalPerguntas = perguntasFiltradas.length;
        // Garante que o número exibido não ultrapasse o total
        const numQuestaoAtualExibicao = Math.min(perguntaAtual + 1, totalPerguntas);
        const progressoPercentual = totalPerguntas > 0 ? (numQuestaoAtualExibicao / totalPerguntas) * 100 : 0;
        elProgressBarFill.style.width = `${progressoPercentual}%`;
        elProgressText.textContent = `${numQuestaoAtualExibicao} / ${totalPerguntas}`;
    } else {
        elProgressContainer.style.display = 'none';
        elProgressText.style.display = 'none';
        // Reseta visualmente se não estiver ativo
        if(elProgressBarFill) elProgressBarFill.style.width = `0%`;
        if(elProgressText) elProgressText.textContent = `0 / 0`;
    }
}


// --- Funções de Navegação de Seção ---
function mostrarSecao(idSecao) {
    if (!elQuizSection) { // Garante que elementos foram cacheados minimamente
        if (!cacheDOMelements()) {
             console.error("Falha ao mostrar seção - elementos do DOM não encontrados.");
             alert("Erro ao carregar a interface. Tente recarregar a página.");
             return;
        }
    }
    // Esconde todas as seções principais
    document.querySelectorAll('.main-section').forEach(s => s.style.display = 'none');

    const secaoParaMostrar = document.getElementById(idSecao);
    if (secaoParaMostrar) {
        secaoParaMostrar.style.display = 'flex'; // Usa flex como padrão para layout
        secaoAtual = idSecao;
        limparAviso(); // Limpa avisos ao trocar de seção

        // Atualiza estado ativo nos links de navegação (ambas as barras)
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

        // Lógica específica ao entrar na seção de questões
        if (idSecao === 'questoes-section') {
            prepararSecaoQuestoes(); // Configura filtros, etc.
            // Atualiza visibilidade das setas após um pequeno delay para renderização
            setTimeout(atualizarSetasScrollCategorias, 150);
        } else {
            // Se sair da seção de questões, esconde elementos específicos do quiz
            esconderElementosQuiz();
        }
        // Atualiza a barra de progresso (que será escondida se não estiver no quiz)
        atualizarBarraProgresso();
    } else {
         console.error(`Seção com ID '${idSecao}' não encontrada.`);
    }
}

// Prepara a seção de questões, mostrando filtros e carregando/exibindo o quiz ou aviso
function prepararSecaoQuestoes() {
     // Garante que estados antigos (quiz, resultado, aviso) estejam limpos
     if (elQuizSection) elQuizSection.style.display = 'none';
     if (elResultadoCard) elResultadoCard.style.display = 'none';
     if (avisoContainer) avisoContainer.style.display = 'none';

     // *** AJUSTE: Garante que os filtros estejam visíveis ao preparar a seção ***
     if (filtroCheckboxesContainer) filtroCheckboxesContainer.style.display = 'flex'; // Ou 'block', verificar CSS

     // Continua com a lógica de carregar perguntas baseadas nos filtros
     atualizarFiltroECarregarPerguntas();
}

// Função auxiliar para esconder elementos específicos do quiz/resultado
function esconderElementosQuiz() {
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elResultadoCard) elResultadoCard.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    // Esconde também elementos do aside relacionados ao quiz
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    if (elPaginacaoControles) { elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none'; } // Esconde container antigo
    if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
    // E a barra de progresso
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
    // Os filtros NÃO são escondidos aqui, pois pertencem à seção 'questoes' em geral
}

// --- Funções da Grade de Questões e Navegação Direta (MODIFICADO) ---
function renderizarGridEPaginacao() {
    // Verifica se os elementos existem e se há perguntas filtradas
    if (!elQuestionGridContainer || !elPaginacaoControles || !perguntasFiltradas) {
        if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if (elPaginacaoControles) { elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none'; }
        return;
    }
    // Esconde se não houver perguntas
    if (perguntasFiltradas.length === 0) {
        elQuestionGridContainer.style.display = 'none';
        elPaginacaoControles.innerHTML = ''; elPaginacaoControles.style.display = 'none';
        return;
    }

    // Mostra o container da grade (será flex) e limpa o container da paginação antiga
    elQuestionGridContainer.style.display = 'flex';
    elQuestionGridContainer.innerHTML = ''; // Limpa a grade antes de redesenhar
    elPaginacaoControles.innerHTML = ''; // Limpa os controles de paginação antigos
    elPaginacaoControles.style.display = 'none'; // Esconde o container de paginação antigo

    // Calcula o índice inicial da página atual da grade
    // A página é baseada na 'perguntaAtual'
    paginaAtualGrid = Math.floor(perguntaAtual / QUESTOES_POR_PAGINA_GRID) + 1;
    const inicio = (paginaAtualGrid - 1) * QUESTOES_POR_PAGINA_GRID;
    const fim = Math.min(inicio + QUESTOES_POR_PAGINA_GRID, perguntasFiltradas.length);

    // --- Criação dos Botões de Navegação (Setas) ---
    const criarSetaNavegacao = (direcao, ariaLabel) => {
        const setaBtn = document.createElement('button');
        setaBtn.classList.add('grid-nav-arrow'); // Classe para estilização
        setaBtn.setAttribute('aria-label', ariaLabel);

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("height", "24px");
        svg.setAttribute("viewBox", "0 -960 960 960");
        svg.setAttribute("width", "24px");
        svg.setAttribute("fill", "currentColor");

        const path = document.createElementNS(svgNS, "path");
        if (direcao === 'prev') {
            path.setAttribute("d", "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"); // Seta Esquerda
            setaBtn.onclick = () => irParaQuestao(perguntaAtual - 1);
            setaBtn.disabled = perguntaAtual === 0; // Desabilita se for a primeira questão
        } else { // next
            path.setAttribute("d", "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"); // Seta Direita
            setaBtn.onclick = () => irParaQuestao(perguntaAtual + 1);
            setaBtn.disabled = perguntaAtual === perguntasFiltradas.length - 1; // Desabilita se for a última questão
        }
        svg.appendChild(path);
        setaBtn.appendChild(svg);
        return setaBtn;
    };

    // Adiciona a seta "Anterior"
    elQuestionGridContainer.appendChild(criarSetaNavegacao('prev', 'Questão Anterior'));

    // Cria os itens da grade (bolinhas numeradas)
    for (let i = inicio; i < fim; i++) {
        const gridItem = document.createElement('button');
        gridItem.classList.add('grid-item');
        gridItem.textContent = i + 1; // Número da questão (1-based)
        gridItem.dataset.index = i; // Armazena índice 0-based
        gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
        gridItem.onclick = () => irParaQuestao(i); // Define ação de clique
        elQuestionGridContainer.appendChild(gridItem);
    }

    // Adiciona a seta "Próxima"
    elQuestionGridContainer.appendChild(criarSetaNavegacao('next', 'Próxima Questão'));

    // Aplica estilos iniciais (correto/incorreto/atual)
    atualizarGridEstilos(perguntaAtual);
}

// Função renderizarItensDaPaginaGrid não é mais necessária separadamente
// Função renderizarControlesPaginacao não é mais necessária para números de página
// Função mudarPaginaGrid não é mais necessária

// Aplica estilos (correto/incorreto/atual) aos itens da grade visíveis
function atualizarGridEstilos(indiceAtualGlobal) {
      if (!elQuestionGridContainer || !perguntasFiltradas) return;
    // Seleciona APENAS os itens numéricos da grade, não as setas
    const items = elQuestionGridContainer.querySelectorAll('.grid-item');
    items.forEach(item => {
        const itemIndexGlobal = parseInt(item.dataset.index, 10); // Pega o índice global do item
        // Validação básica do índice
        if (isNaN(itemIndexGlobal) || itemIndexGlobal < 0 || itemIndexGlobal >= perguntasFiltradas.length) return;

        const pergunta = perguntasFiltradas[itemIndexGlobal]; // Acessa a pergunta correspondente
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect'); // Limpa estilos anteriores

        // Aplica estilo de respondida (correto/incorreto)
        if (pergunta?.hasOwnProperty('respostaDada')) { // Se a pergunta foi respondida
             const classeEstado = pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect';
             item.classList.add(classeEstado);
        }
        // Aplica estilo de questão atual
        if (itemIndexGlobal === indiceAtualGlobal) {
            item.classList.add('grid-item--current');
        }
    });

    // Atualiza o estado (disabled) das setas também
    const setaPrev = elQuestionGridContainer.querySelector('.grid-nav-arrow[aria-label="Questão Anterior"]');
    const setaNext = elQuestionGridContainer.querySelector('.grid-nav-arrow[aria-label="Próxima Questão"]');
    if (setaPrev) setaPrev.disabled = indiceAtualGlobal === 0;
    if (setaNext) setaNext.disabled = indiceAtualGlobal === perguntasFiltradas.length - 1;
}

// Navega para uma questão específica clicada na grade ou pelas setas (MODIFICADO)
function irParaQuestao(indice) {
     clearTimeout(autoAvancoTimeoutId); // Cancela auto-avanço se houver
     autoAvancoTimeoutId = null;

     // Valida o índice
     if (perguntasFiltradas && indice >= 0 && indice < perguntasFiltradas.length) {
         perguntaAtual = indice;
         carregarPergunta(); // Carrega os dados da questão (texto, imagem, respostas)
         renderizarGridEPaginacao(); // <<< REDESENHA a grade/setas para o novo índice
      } else {
          // Opcional: Lógica para quando o índice é inválido (ex: fim do quiz)
          if (perguntasFiltradas && indice >= perguntasFiltradas.length) {
               // Se tentou avançar da última, vai para o resultado
               // (proximaPergunta já faz isso, mas é bom ter aqui caso venha de clique direto)
              mostrarResultadoFinal();
          }
          // Não faz nada se tentar ir para antes da primeira (índice < 0)
          console.warn(`Tentativa de ir para questão com índice inválido ou fora dos limites: ${indice}`);
      }
}

// --- Funções Principais do Quiz ---

// Atualiza a lista de perguntas filtradas e reinicia o quiz
function atualizarFiltroECarregarPerguntas() {
     if (!filtroCheckboxesContainer || !elQuizSection) return; // Verifica elementos essenciais

     clearTimeout(autoAvancoTimeoutId); autoAvancoTimeoutId = null; // Limpa timer
     limparAviso(); // Limpa avisos anteriores

     categoriasSelecionadas = obterCategoriasSelecionadas(); // Pega categorias marcadas
     perguntasFiltradas = filtrarPerguntas(perguntas, categoriasSelecionadas); // Filtra as perguntas

     reiniciarEstadoQuiz(); // Reseta contadores, respostas dadas
     paginaAtualGrid = 1; // Reseta cálculo da página
     renderizarGridEPaginacao(); // Renderiza a grade inicial (ou esconde se vazia)
     setTimeout(atualizarSetasScrollCategorias, 100); // Atualiza setas (para desktop)

     if (elResultadoCard) elResultadoCard.style.display = 'none'; // Esconde resultado final
     if (elQuizSection) elQuizSection.style.display = 'none'; // Esconde quiz antes de decidir

     // Decide se mostra o quiz ou uma mensagem de aviso
     exibirQuizOuAviso(perguntasFiltradas, categoriasSelecionadas);

     atualizarBarraProgresso(); // Atualiza a barra (pode ficar oculta)
}

// Filtra a lista completa de perguntas com base nas categorias selecionadas
function filtrarPerguntas(listaCompleta, categoriasFiltro) {
    let filtradas = [];
    if (!Array.isArray(listaCompleta)) {
        console.error('ERRO FATAL: "perguntas" não é array!');
        mostrarAviso("Erro interno ao carregar perguntas.");
        return []; // Retorna array vazio em caso de erro grave
    }

    if (categoriasFiltro.length > 0) {
        // Filtra perguntas que tenham PELO MENOS UMA das categorias selecionadas
        filtradas = listaCompleta.filter(p =>
            p.categorias && Array.isArray(p.categorias) && p.categorias.some(cat => categoriasFiltro.includes(cat))
        );
    } else {
        // Se nenhuma categoria selecionada, retorna array vazio
        filtradas = [];
    }

    // Limpa o estado 'respostaDada' das perguntas filtradas antes de começar
    filtradas.forEach(p => delete p.respostaDada);
    // shuffleArray(filtradas); // Descomente para embaralhar a ordem das perguntas filtradas
    return filtradas;
}

// Reseta o estado do quiz (contadores, índice da pergunta, respostas dadas)
function reiniciarEstadoQuiz() {
    perguntaAtual = 0;
    usuario.resetarContadores(); // Reseta acertos, erros, pontos
    atualizar_pontuacao(); // Atualiza a UI da pontuação

    // Limpa o estado 'respostaDada' de todas as perguntas filtradas (se houver)
    if (perguntasFiltradas && Array.isArray(perguntasFiltradas)) {
        perguntasFiltradas.forEach(p => delete p.respostaDada);
    }

    clearTimeout(autoAvancoTimeoutId); // Cancela qualquer avanço pendente
    autoAvancoTimeoutId = null;
}

// Mostra a seção do quiz ou uma mensagem de aviso se não houver perguntas
function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    limparAviso(); // Garante que não haja avisos antigos

    if (perguntasParaExibir.length > 0) { // Se houver perguntas para mostrar
        if(elQuizSection) elQuizSection.style.display = 'flex'; // Mostra a seção do quiz
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'block'; // Mostra botão Encerrar
        carregarPergunta(); // Carrega a primeira pergunta
        renderizarGridEPaginacao(); // Mostra a grade/setas (agora no aside)
        atualizarBarraProgresso(); // Mostra/atualiza a barra de progresso
    } else { // Se não houver perguntas
        // Esconde todos os elementos relacionados ao quiz ativo
        if(elQuizSection) elQuizSection.style.display = 'none';
        if(elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
        if(elPaginacaoControles) elPaginacaoControles.style.display = 'none'; // Esconde container antigo
        if(elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none';
        if(elProgressContainer) elProgressContainer.style.display = 'none';
        if(elProgressText) elProgressText.style.display = 'none';

        // Define a mensagem de aviso apropriada
        const temCheckboxesDeCategoria = elFiltroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
        if (categoriasAtivas.length === 0 && temCheckboxesDeCategoria) {
            mostrarAviso("Selecione pelo menos uma categoria para começar.");
        } else if (categoriasAtivas.length > 0) {
            mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
        } else if (!temCheckboxesDeCategoria) {
            mostrarAviso("Nenhuma categoria de pergunta disponível."); // Caso o JSON esteja vazio ou mal formatado
        } else {
            mostrarAviso("Selecione uma categoria para iniciar."); // Fallback
        }
    }
}

// Carrega e exibe a pergunta atual na interface (MODIFICADO)
function carregarPergunta() {
    // Verifica se os elementos essenciais e as perguntas existem
    if (!elementosEssenciaisQuizExistem() || !perguntasFiltradas || perguntasFiltradas.length === 0) {
         console.error("Tentativa de carregar pergunta sem elementos/perguntas.");
         return; // Não faz nada se algo essencial faltar
    }

    // Verifica se o índice da pergunta é válido, senão mostra o resultado final
    if (perguntaAtual < 0 || perguntaAtual >= perguntasFiltradas.length) {
        mostrarResultadoFinal();
        return;
    }

    // A LÓGICA DE MUDAR PÁGINA FOI MOVIDA PARA irParaQuestao e renderizarGridEPaginacao

    if(elQuizSection) elQuizSection.style.display = 'flex'; // Garante que a seção do quiz esteja visível
    atualizarUINavegacaoQuiz(); // Atualiza barra de progresso, cancela timer

    const pergunta = perguntasFiltradas[perguntaAtual]; // Pega o objeto da pergunta atual
    if (!pergunta) { // Validação extra
        console.error(`Erro: Pergunta ${perguntaAtual} indefinida no array filtrado.`);
        mostrarAviso("Erro ao carregar dados da pergunta.");
        mostrarResultadoFinal(); // Vai para o fim se der erro
        return;
    }

    limparAreaPergunta(); // Limpa respostas e imagem da pergunta anterior
    preencherDetalhesQuestao(pergunta, perguntaAtual); // Coloca número, categoria, texto, referência
    exibirImagemQuestao(pergunta.imagem, perguntaAtual); // Mostra imagem se houver URL
    criarBotoesResposta(pergunta); // Cria os botões de resposta
    configurarBotoesNavegacao(perguntaAtual, perguntasFiltradas.length); // Configura "Anterior" e "Próxima/Resultado"

    // A atualização da grade (atualizarGridEstilos) agora é feita por renderizarGridEPaginacao
}


function elementosEssenciaisQuizExistem() {
     // Verifica se todos os elementos cacheados necessários para o quiz existem
     const ok = elQuizSection && elRespostasContainer && elPerguntaTexto && elIdQuestao && elCategoriaTitulo && elReferencia && elNavigationButtons && elPrevBtn && elNextBtn && elProgressBarFill && elProgressText && elProgressContainer && elQuestionGridContainer && elPaginacaoControles && elPontuacao && elAcertosNum && elErrosNum;
     if (!ok) {
          console.error("Erro crítico: Elementos essenciais da UI do quiz não encontrados no DOM.");
          // Tenta recachear uma vez em caso de erro tardio (embora improvável se o cache inicial funcionou)
          if (!cacheDOMelements()) {
               alert("Erro grave na interface do quiz. Por favor, recarregue a página.");
          }
     }
     return ok;
}

// Atualiza elementos que mudam durante a navegação (progresso, timer)
function atualizarUINavegacaoQuiz() {
     clearTimeout(autoAvancoTimeoutId); // Cancela timer de avanço anterior
     autoAvancoTimeoutId = null;
     atualizarBarraProgresso(); // Atualiza a barra linear
     // A atualização da grade é feita em renderizarGridEPaginacao()
}

// Limpa a área de respostas e imagem antes de carregar nova pergunta
function limparAreaPergunta() {
     if (elRespostasContainer) elRespostasContainer.innerHTML = '';
     if (elPerguntaImagem) {
          elPerguntaImagem.style.display = 'none'; // Esconde
          elPerguntaImagem.src = ""; // Limpa src
          elPerguntaImagem.alt = ""; // Limpa alt
      }
}

// Preenche os textos da pergunta (número, categoria, texto, referência)
function preencherDetalhesQuestao(pergunta, indice) {
    // Define o título da categoria (usa a primeira da pergunta ou a única selecionada)
    let tituloCat = "Questão"; // Padrão
    if (pergunta.categorias && pergunta.categorias.length > 0) {
        tituloCat = pergunta.categorias[0]; // Usa a primeira categoria da pergunta
    } else if (categoriasSelecionadas.length === 1) {
        tituloCat = categoriasSelecionadas[0]; // Usa a única categoria selecionada no filtro
    }

    if (elCategoriaTitulo) elCategoriaTitulo.innerText = tituloCat;
    if (elIdQuestao) elIdQuestao.innerText = indice + 1; // Número 1-based
    if (elPerguntaTexto) elPerguntaTexto.textContent = pergunta.pergunta; // Texto da pergunta
    if (elReferencia) elReferencia.textContent = `Referência: ${pergunta.referencia || 'N/A'}`; // Referência ou N/A
}

// Exibe a imagem da questão, se houver URL válida
function exibirImagemQuestao(urlImagem, indice) {
    if (elPerguntaImagem) {
        if (urlImagem && typeof urlImagem === 'string' && urlImagem.trim() !== "") {
            elPerguntaImagem.src = urlImagem;
            elPerguntaImagem.alt = `Imagem ilustrativa da questão ${indice + 1}`;
            elPerguntaImagem.style.display = 'block'; // Mostra a imagem
            // Fallback caso a imagem não carregue
            elPerguntaImagem.onerror = () => {
                 elPerguntaImagem.style.display = 'none';
                 console.warn(`Erro ao carregar imagem para questão ${indice + 1}: ${urlImagem}`);
            };
        } else {
            elPerguntaImagem.style.display = 'none'; // Esconde se não houver URL
        }
    }
}

// Cria os botões de resposta para a pergunta atual
function criarBotoesResposta(pergunta) {
     if (!elRespostasContainer) return;
     elRespostasContainer.innerHTML = ''; // Limpa container

     // Valida se há respostas na pergunta
     if (!pergunta.respostas || !Array.isArray(pergunta.respostas) || pergunta.respostas.length === 0) {
          console.error(`Pergunta ${pergunta.id || perguntaAtual} sem array de respostas válido.`);
          elRespostasContainer.innerHTML = '<p style="color: var(--color-accent-red);">Erro: Opções de resposta não encontradas.</p>';
          return;
     }

     const jaRespondida = pergunta.hasOwnProperty('respostaDada'); // Verifica se já foi respondida

     // Cria um botão para cada resposta
     pergunta.respostas.forEach((respostaTexto) => {
          const p = document.createElement('p'); // Usa <p> mas estiliza como botão
          p.classList.add('answer');
          p.textContent = respostaTexto;
          p.setAttribute('role', 'button'); // Semântica de botão
          p.tabIndex = 0; // Permite foco por teclado

          if (jaRespondida) {
               // Se já respondida, marca visualmente e remove interatividade
               marcarRespostaComoJaFeita(p, pergunta, respostaTexto);
          } else {
               // Se não respondida, adiciona eventos de clique e teclado
               p.onclick = () => verificarResposta(p, pergunta);
               p.onkeydown = (e) => {
                    // Permite acionar com Enter ou Espaço
                    if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault(); // Previne scroll da página com espaço
                         verificarResposta(p, pergunta);
                    }
               };
          }
          elRespostasContainer.appendChild(p);
     });
}

// Aplica estilos a um botão de resposta que já foi respondido anteriormente
function marcarRespostaComoJaFeita(elementoResposta, pergunta, textoDaResposta) {
    elementoResposta.onclick = null; // Remove clique
    elementoResposta.onkeydown = null; // Remove interação teclado
    elementoResposta.classList.add('answered'); // Classe para indicar respondida
    elementoResposta.style.cursor = 'default'; // Cursor padrão
    elementoResposta.tabIndex = -1; // Remove do foco do teclado

    // Aplica estilo correto/incorreto baseado na resposta dada anteriormente
    if (textoDaResposta === pergunta.correta) {
         elementoResposta.classList.add('correct');
    } else if (textoDaResposta === pergunta.respostaDada) { // Marca a que foi escolhida incorretamente
         elementoResposta.classList.add('incorrect');
    }
}

// Configura os botões "Anterior" e "Próxima/Resultado"
function configurarBotoesNavegacao(indiceAtual, totalPerguntas) {
     // Verifica se os botões existem (com fallback de recacheamento)
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

    if(elNavigationButtons) elNavigationButtons.style.display = 'flex'; // Mostra container dos botões

    // Habilita/Desabilita "Anterior"
    if(elPrevBtn) elPrevBtn.disabled = indiceAtual === 0;

    // Configura texto e estado do botão "Próxima"
    if(elNextBtn) {
         const ultimaQuestao = indiceAtual === totalPerguntas - 1;
         elNextBtn.innerText = ultimaQuestao ? 'Ver Resultado' : 'Próxima';

         // Desabilita "Próxima" APENAS se a pergunta atual AINDA não foi respondida
         elNextBtn.disabled = !perguntasFiltradas[indiceAtual]?.hasOwnProperty('respostaDada');
         // Log de depuração removido na versão final
    }
}

// Processa a resposta dada pelo usuário
function verificarResposta(elementoClicado, pergunta) {
    // Impede múltiplos cliques ou processamento se elemento não existir
    if (pergunta.hasOwnProperty('respostaDada') || !elementoClicado || !elRespostasContainer) {
        return;
    }

    clearTimeout(autoAvancoTimeoutId); // Cancela avanço automático anterior

    const respostaSelecionada = elementoClicado.textContent;
    pergunta.respostaDada = respostaSelecionada; // Armazena a resposta dada na pergunta

    desabilitarRespostas(); // Desabilita todos os botões de resposta para esta pergunta
    aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada); // Aplica estilos correct/incorrect
    atualizarEstadoAposResposta(pergunta, respostaSelecionada); // Atualiza score e UI do aside
    atualizarGridEstilos(perguntaAtual); // Atualiza a cor na grade do aside (e estado das setas)

    // Habilita o botão "Próxima" ou "Ver Resultado"
    if (elNextBtn) {
        elNextBtn.disabled = false;
    } else {
        console.error("verificarResposta: Botão Próxima (elNextBtn) não encontrado para habilitar!");
    }

    // Agenda o avanço automático para a próxima pergunta após um delay
    agendarProximaQuestao(1500); // 1.5 segundos de delay
}


// Desabilita interatividade de todos os botões de resposta da pergunta atual
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

// Aplica os estilos visuais de correto/incorreto às respostas
function aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada) {
    const ehCorreta = respostaSelecionada === pergunta.correta;
    // Aplica classe correta ou incorreta ao elemento clicado
    elementoClicado.classList.add(ehCorreta ? "correct" : "incorrect");

    // Se a resposta foi incorreta, também destaca a resposta correta
    if (!ehCorreta && elRespostasContainer) {
        const todasRespostas = elRespostasContainer.querySelectorAll('.answer');
        todasRespostas.forEach(elResposta => {
            if (elResposta.textContent === pergunta.correta) {
                // Adiciona a classe 'correct' para destacar a opção certa
                elResposta.classList.add('correct');
                // Não remove a classe 'answered' para manter desabilitado
            }
        });
    }
}

// Atualiza a pontuação do usuário e a interface do aside
function atualizarEstadoAposResposta(pergunta, respostaSelecionada) {
    if (respostaSelecionada === pergunta.correta) {
        usuario.acertos += 1;
    } else {
        usuario.erros += 1;
    }
    atualizar_pontuacao(); // Recalcula pontos e atualiza UI
}

// Agenda a chamada da função proximaPergunta após um delay
function agendarProximaQuestao(delayMs) {
    clearTimeout(autoAvancoTimeoutId); // Limpa timer anterior se existir
    autoAvancoTimeoutId = setTimeout(proximaPergunta, delayMs);
}

// Carrega a próxima pergunta ou mostra o resultado final
function proximaPergunta() {
    clearTimeout(autoAvancoTimeoutId); // Limpa o timer atual
    autoAvancoTimeoutId = null;

    if (!perguntasFiltradas) return; // Segurança

    // Usa irParaQuestao para centralizar a lógica de navegação e redesenho da grade
    irParaQuestao(perguntaAtual + 1);
}

// Carrega a pergunta anterior
function perguntaAnterior() {
    clearTimeout(autoAvancoTimeoutId); // Cancela auto-avanço
    autoAvancoTimeoutId = null;

    // Usa irParaQuestao para centralizar a lógica de navegação e redesenho da grade
    irParaQuestao(perguntaAtual - 1);
}

// Exibe a tela de resultado final
function mostrarResultadoFinal() {
    clearTimeout(autoAvancoTimeoutId); // Cancela auto-avanço
    autoAvancoTimeoutId = null;

    // Esconde elementos do quiz e relacionados
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (elProgressText) elProgressText.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none'; // Grid/setas no aside
    if (elPaginacaoControles) elPaginacaoControles.style.display = 'none'; // Container antigo da paginação
    if (elBtnEncerrarSessao) elBtnEncerrarSessao.style.display = 'none'; // Botão Encerrar no aside

    // *** AJUSTE: Esconder também o container dos filtros ***
    if (filtroCheckboxesContainer) filtroCheckboxesContainer.style.display = 'none';

    // Mostra o card de resultado
    if (elResultadoCard) {
        elResultadoCard.style.display = 'block'; // Mostra o card
        preencherMensagemFinal(); // Preenche com os dados
        // Foca no título para acessibilidade/navegação por teclado
        const tituloResultado = elResultadoCard.querySelector('.resultado-final-titulo');
        if (tituloResultado) tituloResultado.focus();
    } else {
        // Fallback caso o card de resultado não exista
        console.error("Elemento .resultado-final-card não encontrado.");
        // Mostra um aviso genérico se o card falhar, mas garante que filtros foram escondidos
        mostrarAviso(`Quiz Concluído! Pontos: ${usuario.pontos} (Acertos: ${usuario.acertos}, Erros: ${usuario.erros})`);
    }
}


// Preenche os dados no card de resultado final
function preencherMensagemFinal() {
     if (!elResultadoCard || !filtroCheckboxesContainer) return; // Verifica elementos necessários

     // Pega elementos internos do card de resultado
     const tituloEl = elResultadoCard.querySelector('.resultado-final-titulo');
     const pontuacaoEl = elResultadoCard.querySelector('.pontos-valor');
     const acertosEl = elResultadoCard.querySelector('.acertos-valor');
     const errosEl = elResultadoCard.querySelector('.erros-valor');

     // Valida se os elementos internos existem
     if (!tituloEl || !pontuacaoEl || !acertosEl || !errosEl) {
          console.error("Elementos internos do card de resultado final não encontrados.");
          return;
     }

     // Define o texto do título, pontuação, acertos e erros
     tituloEl.textContent = gerarTituloResultadoFinal(); // Gera título dinâmico
     pontuacaoEl.textContent = usuario.pontos;
     acertosEl.textContent = usuario.acertos;
     errosEl.textContent = usuario.erros;
}

// Gera um título dinâmico para o card de resultado baseado nas categorias
function gerarTituloResultadoFinal() {
     // Verifica se os elementos dos filtros existem
     const todosCheckboxesCategorias = filtroCheckboxesContainer?.querySelectorAll('#filtro-checkboxes-scroll input[type="checkbox"]:not([value="Todas"])');
     const checkboxTodas = filtroCheckboxesContainer?.querySelector('#filtro-checkboxes-scroll input[value="Todas"]');
     const categoriasAtivas = obterCategoriasSelecionadas(); // Pega as categorias que foram usadas no quiz

     if (!todosCheckboxesCategorias || !checkboxTodas) return "Quiz Concluído!"; // Título padrão

     const totalCategoriasDisponiveis = todosCheckboxesCategorias.length;

     if (categoriasAtivas.length === 1) { // Se jogou apenas uma categoria
          return `Quiz de "${categoriasAtivas[0]}" Concluído!`;
     } else if (categoriasAtivas.length === totalCategoriasDisponiveis && totalCategoriasDisponiveis > 0) { // Se jogou todas as categorias
           // Verifica se o checkbox "Todas" foi explicitamente marcado ou se todas as outras foram
          if (checkboxTodas.checked) {
                return `Quiz de Todas as Categorias Concluído!`;
           } else {
                // Caso raro onde todas foram marcadas individualmente
                return `Quiz (Todas as Categorias) Concluído!`;
           }
     } else if (categoriasAtivas.length > 1) { // Se jogou múltiplas categorias (mas não todas)
          return `Quiz de Múltiplas Categorias Concluído!`;
     } else { // Caso não tenha jogado nenhuma (improvável chegar aqui, mas por segurança)
          return "Quiz Finalizado!";
     }
}


// Atualiza os números de pontuação, acertos e erros na UI (no aside)
function atualizar_pontuacao() {
    if (elPontuacao) elPontuacao.textContent = usuario.pontos;
    if (elAcertosNum) elAcertosNum.textContent = usuario.acertos;
    if (elErrosNum) elErrosNum.textContent = usuario.erros;
}

// --- Funções do Modal de Confirmação ---
function showConfirmEncerrarModal() {
     if (elConfirmEncerrarOverlay) {
          elConfirmEncerrarOverlay.style.display = 'flex'; // Mostra o overlay
          // Força reflow para garantir que a transição de opacidade funcione
          void elConfirmEncerrarOverlay.offsetWidth;
          elConfirmEncerrarOverlay.classList.add('visible'); // Adiciona classe para animar opacidade/escala
          if(elCancelEncerrarBtn) elCancelEncerrarBtn.focus(); // Foca no botão Cancelar por padrão
      }
}

function hideConfirmEncerrarModal() {
     if (elConfirmEncerrarOverlay) {
          elConfirmEncerrarOverlay.classList.remove('visible'); // Remove classe para animar fade-out
          // Poderia adicionar um event listener para 'transitionend' e só então setar display: none,
          // mas para simplificar, o CSS já faz visibility: hidden após a transição.
      }
}
// --- Fim Funções do Modal ---

// --- Carregamento Inicial e Event Listeners ---

// Carrega as perguntas do arquivo JSON
async function carregarPerguntasJSON() {
     try {
          const timestamp = Date.now(); // Evita cache agressivo
          const response = await fetch(`assets/data/questions.json?t=${timestamp}`);
          if (!response.ok) { // Verifica se a requisição foi bem sucedida
               throw new Error(`Falha ao carregar: ${response.status} ${response.statusText}`);
          }
          // Verifica o tipo de conteúdo (opcional, mas bom para depuração)
          const contentType = response.headers.get("content-type");
          if (!contentType || !(contentType.includes("application/json") || contentType.includes("text/plain"))) {
               console.warn(`Aviso: Content-Type inesperado ao carregar perguntas: ${contentType}`);
          }
          const data = await response.json(); // Faz o parse do JSON
          if (!Array.isArray(data)) { // Valida se o resultado é um array
               throw new Error("Formato de dados inválido (esperava um Array).");
          }
          perguntas = data; // Armazena as perguntas globalmente
          console.log(`Perguntas carregadas com sucesso (${perguntas.length} perguntas).`);
          return true; // Indica sucesso
     } catch (error) {
          console.error("Erro CRÍTICO ao carregar ou processar 'questions.json':", error);
          // Tenta mostrar o erro na interface se os elementos de aviso existirem
          if (!avisoContainer || !avisoMensagem) cacheDOMelements(); // Tenta carregar elementos se ainda não carregados
          if (avisoContainer && avisoMensagem) {
               mostrarSecao('questoes-section'); // Vai para a seção de questões para mostrar o aviso
               mostrarAviso(`Falha ao carregar as perguntas: ${error.message}. Verifique o arquivo 'questions.json' e a conexão.`);
          } else {
               // Fallback se nem os elementos de aviso funcionarem
               alert(`Falha crítica ao carregar perguntas: ${error.message}`);
          }
          return false; // Indica falha
     }
}

// Configura todos os event listeners da aplicação
function configurarEventListeners() {
    // Navegação Principal (Superior - Desktop/Tablet)
    const topNavLinks = document.querySelectorAll('.navbar .nav-link');
    topNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedLink = e.target.closest('a');
            if (!clickedLink) return;
            const targetSectionId = clickedLink.dataset.section;
            // Muda de seção apenas se for diferente da atual
            if (targetSectionId && targetSectionId !== secaoAtual) {
                // Remove 'active' de todos os links (top e bottom)
                document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => {
                    activeLink.classList.remove('active');
                    activeLink.removeAttribute('aria-current');
                });
                // Adiciona 'active' ao link clicado (top)
                clickedLink.classList.add('active');
                clickedLink.setAttribute('aria-current', 'page');
                // Adiciona 'active' ao link correspondente (bottom)
                const correspondingBottomLink = document.querySelector(`.bottom-navbar .bottom-nav-link[data-section="${targetSectionId}"]`);
                if (correspondingBottomLink) {
                    correspondingBottomLink.classList.add('active');
                    correspondingBottomLink.setAttribute('aria-current', 'page');
                }
                mostrarSecao(targetSectionId); // Mostra a seção alvo
            }
        });
    });

    // Navegação Inferior (Mobile)
    const bottomNavLinks = document.querySelectorAll('.bottom-navbar .bottom-nav-link');
    bottomNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedLink = e.target.closest('a');
            if (!clickedLink) return;
            const targetSectionId = clickedLink.dataset.section;
            // Muda de seção apenas se for diferente da atual
            if (targetSectionId && targetSectionId !== secaoAtual) {
                 // Remove 'active' de todos os links (top e bottom)
                 document.querySelectorAll('.nav-link.active, .bottom-nav-link.active').forEach(activeLink => {
                     activeLink.classList.remove('active');
                     activeLink.removeAttribute('aria-current');
                 });
                 // Adiciona 'active' ao link clicado (bottom)
                 clickedLink.classList.add('active');
                 clickedLink.setAttribute('aria-current', 'page');
                 // Adiciona 'active' ao link correspondente (top)
                 const correspondingTopLink = document.querySelector(`.navbar .nav-link[data-section="${targetSectionId}"]`);
                 if (correspondingTopLink) {
                     correspondingTopLink.classList.add('active');
                     correspondingTopLink.setAttribute('aria-current', 'page');
                 }
                 mostrarSecao(targetSectionId); // Mostra a seção alvo
            }
        });
    });

    // Filtro de Categorias (Checkboxes)
    if (filtroCheckboxesContainer) {
        // Usa delegação de eventos no container
        filtroCheckboxesContainer.addEventListener('change', (e) => {
            // Verifica se o evento veio de um checkbox dentro da área de scroll
            if (e.target?.type === 'checkbox' && e.target.closest('#filtro-checkboxes-scroll')) {
                handleCheckboxChange(e.target); // Lógica para marcar/desmarcar "Todas"
                atualizarFiltroECarregarPerguntas(); // Recarrega as perguntas com base na nova seleção
                setTimeout(atualizarSetasScrollCategorias, 100); // Atualiza visibilidade das setas
            }
        });
    } else {
        console.warn("Container de filtros de categoria não encontrado para adicionar listener.");
    }

    // Botões de Navegação do Quiz (Anterior/Próximo) - Usam as funções proxima/anteriorPergunta
    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior);
    if (elNextBtn) {
        elNextBtn.addEventListener('click', proximaPergunta);
    } else {
        console.error("Botão Próxima/Resultado (#next-btn) não encontrado durante configuração de listeners.");
    }

    // Setas de Rolagem das Categorias
    if (elCatScrollLeft) elCatScrollLeft.addEventListener('click', () => rolarCategorias('left'));
    if (elCatScrollRight) elCatScrollRight.addEventListener('click', () => rolarCategorias('right'));

    // Atualiza Visibilidade das Setas de Rolagem ao Rolar e Redimensionar
    if (elFiltroCheckboxesScroll) {
        // Ouve o evento de scroll na área das categorias
        elFiltroCheckboxesScroll.addEventListener('scroll', atualizarSetasScrollCategorias, { passive: true });
    }
    // Ouve o redimensionamento da janela (com debounce simples)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            atualizarSetasScrollCategorias(); // Atualiza setas após redimensionar
            // Outras lógicas de responsividade podem ser adicionadas aqui se necessário
        }, 150); // Espera 150ms após parar de redimensionar
    });

    // Event Listeners do Modal de Confirmação para Encerrar
    if (elBtnEncerrarSessao) {
         elBtnEncerrarSessao.addEventListener('click', showConfirmEncerrarModal);
    } else { console.warn("Botão Encerrar Sessão não encontrado."); }

    if (elConfirmEncerrarBtn) {
         elConfirmEncerrarBtn.addEventListener('click', () => {
              mostrarResultadoFinal(); // Mostra resultado
              hideConfirmEncerrarModal(); // Esconde modal
          });
    } else { console.warn("Botão Confirmar (Modal) não encontrado."); }

    if (elCancelEncerrarBtn) {
         elCancelEncerrarBtn.addEventListener('click', hideConfirmEncerrarModal); // Apenas esconde modal
    } else { console.warn("Botão Cancelar (Modal) não encontrado."); }

    // Fecha modal se clicar fora do conteúdo
    if (elConfirmEncerrarOverlay) {
         elConfirmEncerrarOverlay.addEventListener('click', (event) => {
              // Verifica se o clique foi no overlay (fundo) e não no conteúdo
              if (event.target === elConfirmEncerrarOverlay) {
                   hideConfirmEncerrarModal();
              }
         });
    } else { console.warn("Overlay do Modal não encontrado."); }

    // Botão Recomeçar (na tela de resultado)
    if (elBtnRecomecar) {
        elBtnRecomecar.addEventListener('click', reiniciarQuizCompleto);
    } else {
        console.warn("Botão Recomeçar não encontrado.");
    }
}


// Lida com a lógica de marcar/desmarcar o checkbox "Todas"
function handleCheckboxChange(changedCheckbox) {
     if (!elFiltroCheckboxesScroll) return; // Segurança
     const cbTodas = elFiltroCheckboxesScroll.querySelector('input[value="Todas"]');
     const outrosCheckboxes = elFiltroCheckboxesScroll.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
     if (!cbTodas || !outrosCheckboxes) return; // Segurança

     if (changedCheckbox === cbTodas) { // Se clicou em "Todas"
          // Marca/desmarca todos os outros igual a "Todas"
          outrosCheckboxes.forEach(cb => cb.checked = cbTodas.checked);
     } else { // Se clicou em uma categoria individual
          // Verifica se TODOS os outros estão marcados para marcar "Todas"
          let todosMarcados = true;
          outrosCheckboxes.forEach(cb => {
               if (!cb.checked) todosMarcados = false;
          });
          cbTodas.checked = todosMarcados; // Marca "Todas" se todos os outros estiverem marcados
     }
}

// Reinicia o quiz a partir da tela de resultados
function reiniciarQuizCompleto() {
    // Verifica se elementos essenciais existem
    if (!elResultadoCard || !filtroCheckboxesContainer) {
         console.error("Tentativa de reiniciar sem elementos de resultado/filtro.");
         // Tenta recachear se algo falhou
         if (!cacheDOMelements()) {
              alert("Erro ao tentar reiniciar o quiz. Por favor, recarregue a página.");
              return;
          }
     }

    if(elResultadoCard) elResultadoCard.style.display = 'none'; // Esconde o card de resultado
    // Chamar prepararSecaoQuestoes garante que os filtros voltem a aparecer
    // e que atualizarFiltroECarregarPerguntas seja chamado para recarregar
    // baseado nos filtros atuais (ou limpar se nenhum filtro selecionado)
    prepararSecaoQuestoes();

    // Scroll para o topo da área de conteúdo principal para melhor UX
    const mainContent = document.querySelector('#questoes-section .main-content');
    if (mainContent) {
         mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
         // Fallback para scroll da janela inteira se o container não for encontrado
         window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carrega as perguntas do JSON
    const perguntasCarregadas = await carregarPerguntasJSON();

    // 2. Procede apenas se as perguntas foram carregadas com sucesso
    if (perguntasCarregadas) {
        // 3. Garante que os elementos do DOM foram encontrados
        if (!cacheDOMelements()) {
            console.error("Erro Crítico: Falha ao encontrar elementos essenciais do DOM na inicialização.");
            // Mostra mensagem de erro grave diretamente no body se o cache falhar
            const body = document.querySelector('body');
            if (body) body.innerHTML = '<p style="color:red; padding: 20px; font-family: sans-serif;">Erro grave ao inicializar a interface. Verifique o console e recarregue a página.</p>';
            return; // Interrompe a execução
        }

        // 4. Gera os checkboxes de categoria dinamicamente
        try {
            const categoriasUnicas = extrairCategoriasUnicas(perguntas); // Extrai categorias do JSON
            gerarCheckboxesCategoria(elFiltroCheckboxesScroll, categoriasUnicas); // Cria os checkboxes
            console.log("Filtros de categoria gerados.");
        } catch (error) {
            console.error("Erro ao gerar filtros de categoria:", error);
            // Mostra aviso se a geração de filtros falhar
            if(avisoContainer) mostrarAviso("Erro ao configurar os filtros de categoria.");
        }

        // 5. Configura todos os event listeners (cliques, mudanças, etc.)
        configurarEventListeners();
        console.log("Event listeners configurados.");

        // 6. Define a seção inicial a ser exibida (baseado no link ativo ou padrão 'inicio')
        const linkAtivoInicial = document.querySelector('.navbar .nav-link.active, .bottom-navbar .bottom-nav-link.active');
        const secaoInicialId = linkAtivoInicial?.dataset.section || 'inicio-section';
        mostrarSecao(secaoInicialId);
        console.log(`Seção inicial exibida: ${secaoInicialId}`);

        // 7. Atualiza estado inicial das setas de rolagem das categorias
        setTimeout(atualizarSetasScrollCategorias, 150); // Pequeno delay

    } else {
        // Mensagem se o carregamento das perguntas falhou (já tratada em carregarPerguntasJSON)
        console.error("Inicialização interrompida: Falha ao carregar perguntas.");
    }
});