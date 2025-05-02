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

// --- Elementos do DOM (cacheados) ---
let elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elNavigationButtons, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, avisoMensagem;
let elQuestionGridContainer;

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
        filtroCheckboxesContainer = document.querySelector('.filtro-checkboxes');
        avisoContainer = document.getElementById('aviso-container');
        avisoMensagem = avisoContainer ? avisoContainer.querySelector('.aviso-mensagem') : null;
        elQuestionGridContainer = document.getElementById('question-grid-container');

        const elementos = { elCategoriaTitulo, elIdQuestao, elPerguntaTexto, elPerguntaImagem, elRespostasContainer, elReferencia, elQuizSection, elPontuacao, elAcertosNum, elErrosNum, elPrevBtn, elNextBtn, elResultadoCard, elProgressBarFill, elProgressText, elProgressContainer, filtroCheckboxesContainer, avisoContainer, elQuestionGridContainer };
        let missingElements = false;
        for (const key in elementos) {
            if (!elementos[key] && key !== 'elNavigationButtons' && key !== 'avisoMensagem') { // Alguns são opcionais ou dentro de outros
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
    if (!containerElemento) {
        console.error("Container para checkboxes de categoria não encontrado!");
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
}

function obterCategoriasSelecionadas() {
    const selecionadas = [];
     if (!filtroCheckboxesContainer) return selecionadas; // Retorna vazio se container não existe

    const checkboxesCategorias = filtroCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked:not([value="Todas"])');
    checkboxesCategorias.forEach(cb => {
        selecionadas.push(cb.value);
    });
    return selecionadas;
}

// --- Funções de Barra de Progresso ---
function atualizarBarraProgresso() {
    if (!elProgressContainer || !elProgressBarFill || !elProgressText) return;

    const quizAtivo = elQuizSection && elQuizSection.style.display !== 'none';
    const temPerguntas = perguntasFiltradas && perguntasFiltradas.length > 0;

    if (quizAtivo && temPerguntas) {
        elProgressContainer.style.display = 'block';
        const totalPerguntas = perguntasFiltradas.length;
        const numQuestaoAtual = Math.min(perguntaAtual + 1, totalPerguntas);
        const progressoPercentual = totalPerguntas > 0 ? (numQuestaoAtual / totalPerguntas) * 100 : 0;
        elProgressBarFill.style.width = `${progressoPercentual}%`;
        elProgressText.textContent = `${numQuestaoAtual} / ${totalPerguntas}`;
    } else {
        elProgressContainer.style.display = 'none';
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
        const progresso = secaoQuestoes.querySelector('#progress-container');

        if (quiz) quiz.style.display = 'none';
        if (resultado) resultado.style.display = 'none';
        if (aviso) aviso.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (progresso) progresso.style.display = 'none';
    }
}

// --- Funções da Grade de Questões ---
function criarGridQuestoes(totalQuestoes) {
    if (!elQuestionGridContainer) return;
    elQuestionGridContainer.innerHTML = '';

    if (totalQuestoes === 0) {
        elQuestionGridContainer.style.display = 'none';
        return;
    }
    elQuestionGridContainer.style.display = 'grid';

    for (let i = 0; i < totalQuestoes; i++) {
        const gridItem = document.createElement('button');
        gridItem.classList.add('grid-item');
        gridItem.textContent = i + 1;
        gridItem.dataset.index = i;
        gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
        gridItem.onclick = () => irParaQuestao(i);
        elQuestionGridContainer.appendChild(gridItem);
    }
    atualizarGridQuestoes(perguntaAtual);
}

function atualizarGridQuestoes(indiceAtual) {
    if (!elQuestionGridContainer || !perguntasFiltradas) return;
    const items = elQuestionGridContainer.querySelectorAll('.grid-item');

    items.forEach(item => {
        const itemIndex = parseInt(item.dataset.index, 10);
        if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= perguntasFiltradas.length) return;

        const pergunta = perguntasFiltradas[itemIndex];
        item.classList.remove('grid-item--current', 'grid-item--correct', 'grid-item--incorrect');

        if (pergunta?.hasOwnProperty('respostaDada')) { // Optional chaining
            item.classList.add(pergunta.respostaDada === pergunta.correta ? 'grid-item--correct' : 'grid-item--incorrect');
        }
        if (itemIndex === indiceAtual) {
            item.classList.add('grid-item--current');
        }
    });
}

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

// --- Função Central: Atualiza Filtro e Carrega Perguntas --- REFAVORADA ---
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

    criarGridQuestoes(perguntasFiltradas.length); // Cria ou limpa a grade

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
         return []; // Retorna array vazio em caso de erro
     }

    if (categoriasFiltro.length > 0) {
        filtradas = listaCompleta.filter(p =>
            p.categorias && Array.isArray(p.categorias) && p.categorias.some(cat => categoriasFiltro.includes(cat))
        );
    }
    // Limpa estado 'respostaDada' da execução anterior
    filtradas.forEach(p => delete p.respostaDada);
    return filtradas;
}

function reiniciarEstadoQuiz() {
    perguntaAtual = 0;
    usuario.resetarContadores();
    atualizar_pontuacao(); // Atualiza UI da pontuação
}

function exibirQuizOuAviso(perguntasParaExibir, categoriasAtivas) {
    if (perguntasParaExibir.length > 0) {
        elQuizSection.style.display = 'flex';
        carregarPergunta(); // Carrega a primeira pergunta filtrada
        limparAviso();
    } else {
        const temCheckboxes = filtroCheckboxesContainer?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length > 0;
        if (categoriasAtivas.length === 0 && temCheckboxes) {
             mostrarAviso("Selecione pelo menos uma categoria para começar o quiz.");
        } else if (categoriasAtivas.length > 0) {
            mostrarAviso("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
        } else {
             mostrarAviso("Nenhuma categoria disponível ou erro na configuração.");
        }
    }
}

// --- Função para Carregar Pergunta --- REFAVORADA ---
function carregarPergunta() {
    if (!elementosEssenciaisQuizExistem() || perguntasFiltradas.length === 0) {
         console.log("carregarPergunta: Elementos ausentes ou sem perguntas filtradas.");
         return;
     }

    elQuizSection.style.display = 'flex'; // Garante visibilidade

    atualizarUINavegacaoQuiz(); // Limpa timeout, atualiza barra e grid

    if (perguntaAtual >= perguntasFiltradas.length || perguntaAtual < 0) {
        console.warn(`Índice de pergunta (${perguntaAtual}) inválido. Mostrando resultado.`);
        mostrarResultadoFinal();
        return;
    }

    const pergunta = perguntasFiltradas[perguntaAtual];
    if (!pergunta) {
        console.error(`Erro: Pergunta não encontrada no índice ${perguntaAtual}.`);
        mostrarAviso("Erro ao carregar dados da pergunta.");
        mostrarResultadoFinal(); // Vai para o final se a pergunta não carregar
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
    // Verifica elementos cruciais para exibir uma pergunta
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
    atualizarGridQuestoes(perguntaAtual);
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
    let tituloCat = "Questão"; // Padrão
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
        elPerguntaImagem.style.display = 'none'; // Garante que está escondida se não houver URL
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
     // Assegura que os botões foram cacheados
     if (!elNavigationButtons && elQuizSection) {
        elNavigationButtons = elQuizSection.querySelector('.navigation-buttons');
        if (elNavigationButtons) {
            elPrevBtn = elNavigationButtons.querySelector('#prev-btn');
            elNextBtn = elNavigationButtons.querySelector('#next-btn');
        } else {
            console.warn("Aviso: .navigation-buttons não encontrado ao configurar botões.");
            return; // Sai se não encontrar
        }
    }
    // Continua apenas se os botões existem
     if (!elPrevBtn || !elNextBtn) {
         console.warn("Aviso: Botões prev/next não encontrados.");
         return;
     }


    elNavigationButtons.style.display = 'flex';
    elPrevBtn.disabled = indiceAtual === 0;
    elNextBtn.disabled = false; // Habilita por padrão
    elNextBtn.innerText = (indiceAtual === totalPerguntas - 1) ? 'Ver Resultado' : 'Próxima';
}

// --- Função para Verificar Resposta --- REFAVORADA ---
function verificarResposta(elementoClicado, pergunta) {
     if (pergunta.hasOwnProperty('respostaDada') || !elementoClicado || !elRespostasContainer) return;

     clearTimeout(autoAvancoTimeoutId); // Cancela avanço anterior, se houver

     const respostaSelecionada = elementoClicado.textContent;
     pergunta.respostaDada = respostaSelecionada; // Marca como respondida

     desabilitarRespostas();
     aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada);
     atualizarEstadoAposResposta(pergunta, respostaSelecionada);
     agendarProximaQuestao(1500); // Agenda avanço após 1.5s
 }

// --- Funções Auxiliares de verificarResposta ---
function desabilitarRespostas() {
    const allAnswers = elRespostasContainer.querySelectorAll('.answer');
    allAnswers.forEach(ans => {
        ans.onclick = null; // Remove click handler
        ans.classList.add('answered'); // Adiciona classe genérica de respondida
    });
}

function aplicarFeedbackVisualResposta(elementoClicado, pergunta, respostaSelecionada) {
     const correta = respostaSelecionada === pergunta.correta;
     elementoClicado.classList.add(correta ? "correct" : "incorrect");

     // Se errou, marca também a correta
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
    atualizar_pontuacao(); // Atualiza UI da pontuação na sidebar
    atualizarGridQuestoes(perguntaAtual); // Atualiza estado na grid
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

    // Esconde elementos do quiz ativo
    if (elQuizSection) elQuizSection.style.display = 'none';
    if (elProgressContainer) elProgressContainer.style.display = 'none';
    if (avisoContainer) avisoContainer.style.display = 'none';
    if (elQuestionGridContainer) elQuestionGridContainer.style.display = 'none';
    atualizarGridQuestoes(-1); // Desmarca todos na grid

    if (elResultadoCard) {
        elResultadoCard.style.display = 'block';
        preencherMensagemFinal(); // Preenche os dados no card
    } else {
        console.error("Erro: .resultado-final-card não encontrado.");
        // Fallback: mostra um aviso genérico
        mostrarAviso(`Quiz Concluído! Pontuação Final: ${usuario.pontos}, Acertos: ${usuario.acertos}, Erros: ${usuario.erros}`);
    }
}

function preencherMensagemFinal() {
    if (!elResultadoCard || !filtroCheckboxesContainer) return; // Precisa do filtro para o título

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
    const outrosCheckboxes = filtroCheckboxesContainer.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
    const categoriasAtivas = obterCategoriasSelecionadas(); // Reusa a função
    const cbTodas = filtroCheckboxesContainer.querySelector('input[value="Todas"]');

    if (categoriasAtivas.length === 1) {
        return `Quiz de ${categoriasAtivas[0]} Concluído!`;
    } else if (cbTodas?.checked && outrosCheckboxes && categoriasAtivas.length === outrosCheckboxes.length) { // Safely check cbTodas
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
        const response = await fetch('assets/data/questions.json');
        if (!response.ok) {
            throw new Error(`Falha ao buscar questions.json. Status: ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
           throw new TypeError(`Tipo de conteúdo inesperado (${contentType}). Esperado application/json.`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("O formato dos dados das perguntas é inválido (não é um Array).");
        }
        perguntas = data; // Atribui ao array global
        console.log("Perguntas carregadas com sucesso.");
        return true; // Sucesso
    } catch (error) {
        console.error("Erro CRÍTICO durante o carregamento das perguntas:", error);
        // Tenta mostrar aviso na tela, mesmo que o cache falhe depois
        if (!avisoContainer || !avisoMensagem) cacheDOMelements(); // Tenta cache para aviso
        if (avisoContainer && avisoMensagem) {
             mostrarSecao('questoes-section'); // Tenta ir para a seção de questões para mostrar o aviso
             mostrarAviso(`Falha grave ao carregar perguntas: ${error.message}. O quiz não pode iniciar.`);
        } else {
             alert(`Falha grave ao carregar as perguntas: ${error.message}`); // Fallback extremo
        }
        return false; // Falha
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

    // Listener dos Checkboxes de Filtro (delegação de evento)
    if (filtroCheckboxesContainer) {
        filtroCheckboxesContainer.addEventListener('change', (event) => {
            if (event.target?.type === 'checkbox') { // Optional chaining
                handleCheckboxChange(event.target); // Chama função dedicada
                atualizarFiltroECarregarPerguntas(); // Recarrega após qualquer mudança
            }
        });
    } else {
        console.warn("Container de filtro de categorias não encontrado para adicionar listener.");
    }

    // Listeners dos Botões de Navegação do Quiz
    if (elPrevBtn) elPrevBtn.addEventListener('click', perguntaAnterior);
    if (elNextBtn) elNextBtn.addEventListener('click', proximaPergunta);
}

// Função auxiliar para lógica dos checkboxes
function handleCheckboxChange(changedCheckbox) {
     const cbTodas = filtroCheckboxesContainer.querySelector('input[value="Todas"]');
     const outrosCheckboxes = filtroCheckboxesContainer.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');

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
    // 1. Carrega as perguntas primeiro
    const perguntasCarregadas = await carregarPerguntasJSON();

    // Só continua se as perguntas foram carregadas com sucesso
    if (perguntasCarregadas) {
        // 2. Cacheia os elementos DOM essenciais
        if (!cacheDOMelements()) {
            console.error("Erro Crítico: Falha ao encontrar elementos DOM essenciais após carregar perguntas.");
            mostrarAviso("Erro crítico na interface do quiz. Verifique o console.");
            return; // Interrompe se o DOM estiver quebrado
        }

        // 3. Gera os filtros de categoria dinamicamente
        try {
            const categoriasUnicas = extrairCategoriasUnicas(perguntas);
            gerarCheckboxesCategoria(filtroCheckboxesContainer, categoriasUnicas);
            console.log("Filtros de categoria gerados.");
        } catch(error) {
            console.error("Erro ao gerar filtros de categoria:", error);
            mostrarAviso("Erro ao configurar filtros de categoria.");
            // Pode decidir continuar ou parar aqui dependendo da importância dos filtros
        }

        // 4. Configura todos os event listeners
        configurarEventListeners();

        // 5. Define e mostra a seção inicial
        const linkInicialAtivo = document.querySelector('.navbar .nav-link.active');
        const secaoInicialId = linkInicialAtivo?.dataset.section || 'inicio-section'; // Usa optional chaining e default
        mostrarSecao(secaoInicialId); // Mostra a seção inicial (pode já chamar atualizarFiltroECarregarPerguntas se for 'questoes-section')
    }
    // Se perguntasCarregadas for false, o erro já foi tratado em carregarPerguntasJSON
});