/**
 * script.js - Refatorado para Modularidade e Melhor Aderência ao OCP
 *
 * Melhorias aplicadas:
 * - Refatoração de showSection para usar objeto de configuração (melhora OCP).
 * - Generalização de seletores para elementos de navegação (melhora OCP).
 * - Acessibilidade: Foco, feedback aria-live, roles.
 * - Estado: fullReset, validação.
 * - Performance: Lazy loading, requestAnimationFrame.
 * - Manutenção: Classes CSS visibilidade, nomes métodos, SRP.
 * - Scroll: Suave ('nearest'), condicional, margem CSS.
 * - UX: Transição Fade-in/out para suavizar mudança de altura da questão.
 */

// --- Módulo: UserData ---
class UserData {
    constructor() {
        this.reset();
    }

    get acertos() { return this._acertos; }
    get erros() { return this._erros; }
    get pontos() { return this._pontos; }

    incrementarAcertos() {
        this._acertos++;
        this._atualizarPontos();
    }

    incrementarErros() {
        this._erros++;
        this._atualizarPontos();
    }

    _atualizarPontos() {
        // Pontuação: +15 por acerto, -5 por erro (mínimo 0)
        this._pontos = (15 * this._acertos) - (5 * this._erros);
        if (this._pontos < 0) this._pontos = 0;
    }

    reset() {
        this._acertos = 0;
        this._erros = 0;
        this._pontos = 0;
    }
}

// --- Módulo: QuizData ---
class QuizData {
    constructor(url = 'assets/data/questions.json') {
        this.url = url;
        this.allQuestions = [];
    }

    async loadQuestions() {
        try {
            const timestamp = Date.now(); // Cache busting simples
            const response = await fetch(`${this.url}?t=${timestamp}`);
            if (!response.ok) throw new Error(`Falha ao carregar: ${response.status} ${response.statusText}`);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Formato de dados inválido (esperava um Array).");
            this.allQuestions = data;
            console.log(`Perguntas carregadas com sucesso (${this.allQuestions.length} perguntas).`);
            return true;
        } catch (error) {
            console.error("Erro CRÍTICO ao carregar ou processar 'questions.json':", error);
            this.allQuestions = []; // Garante estado limpo em caso de erro
            throw error; // Propaga o erro para tratamento na inicialização
        }
    }

    getQuestions() {
        // Retorna uma cópia rasa para evitar modificação externa da lista original
        return [...this.allQuestions];
    }

    extractUniqueCategories() {
        const categorias = new Set();
        this.allQuestions.forEach(pergunta => {
            pergunta.categorias?.forEach(cat => {
                if (cat && typeof cat === 'string') categorias.add(cat.trim());
            });
        });
        // Retorna um array ordenado de categorias únicas
        return [...categorias].sort((a, b) => a.localeCompare(b));
    }
}

// --- Módulo: QuizState ---
class QuizState {
    constructor() {
        this.allQuestions = [];
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.selectedCategories = [];
        this.isInitialQuestionLoad = true; // Para controlar a animação de fade inicial
    }

    initialize(allQuestions) {
        this.allQuestions = allQuestions;
        this.resetQuizState(); // Inicia com estado zerado
    }

    resetQuizState() {
        this.filteredQuestions = [];
        this.currentQuestionIndex = 0;
        this.isInitialQuestionLoad = true; // Sempre reseta a flag ao resetar o quiz
        // Remove o estado de resposta das perguntas originais (se houver)
        this.allQuestions.forEach(q => delete q.respostaDada);
    }

    // Reset completo, incluindo categorias selecionadas (usado ao sair da seção, talvez?)
    fullReset() {
        this.resetQuizState();
        this.selectedCategories = [];
        // Idealmente, a UI também desmarcaria os checkboxes aqui
    }

    filterQuestions() {
        this.resetQuizState(); // Importante para resetar índice e flag de animação
        if (this.selectedCategories.length > 0) {
            this.filteredQuestions = this.allQuestions.filter(p =>
                p.categorias?.some(cat => this.selectedCategories.includes(cat))
            );
        } else {
             this.filteredQuestions = []; // Nenhuma categoria selecionada, nenhuma questão filtrada
        }
        // console.log(`Filtradas ${this.filteredQuestions.length} questões.`);
        return this.filteredQuestions;
    }

    setSelectedCategories(categories) {
        // Garante que seja sempre um array
        this.selectedCategories = Array.isArray(categories) ? categories : [];
    }

    getCurrentQuestion() {
        return this.filteredQuestions[this.currentQuestionIndex] ?? null;
    }

    getCurrentQuestionNumberForDisplay() {
        // Número para exibição (1-based)
        return this.currentQuestionIndex + 1;
    }

    getTotalFilteredQuestions() {
        return this.filteredQuestions.length;
    }

    isQuizComplete() {
        // O quiz está completo se o índice for maior ou igual ao número de questões filtradas
        return this.currentQuestionIndex >= this.filteredQuestions.length;
    }

    isFirstQuestion() {
        return this.currentQuestionIndex === 0;
    }

    isLastQuestion() {
        // É a última questão se o índice for o último elemento do array
        return this.currentQuestionIndex === this.filteredQuestions.length - 1;
    }

    recordAnswer(answer) {
        const question = this.getCurrentQuestion();
        // Só registra se a questão existe, ainda não foi respondida e a resposta é válida
        if (question && !question.hasOwnProperty('respostaDada') && question.respostas?.includes(answer)) {
            question.respostaDada = answer;
            return true; // Indica que a resposta foi registrada
        }
         if (question && !question.hasOwnProperty('respostaDada') && !question.respostas?.includes(answer)) {
              console.warn(`Tentativa de registrar resposta inválida: "${answer}" para a questão ${this.currentQuestionIndex}`);
         }
        return false; // Indica que a resposta não foi registrada
    }

    // Chamado ao navegar (avançar/voltar/ir para), marca que não é mais o load inicial
    markNavigated() {
        this.isInitialQuestionLoad = false;
    }

    goToQuestion(index) {
        if (index >= 0 && index < this.filteredQuestions.length) {
            this.currentQuestionIndex = index;
            this.markNavigated();
            return true;
        }
        return false;
    }

    goToNextQuestion() {
        // Avança apenas se não estiver após a última questão
        if (this.currentQuestionIndex < this.filteredQuestions.length) {
            this.currentQuestionIndex++;
            this.markNavigated();
            return true;
        }
        return false; // Não pode avançar (já está completo ou além)
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.markNavigated();
            return true;
        }
        return false; // Já está na primeira questão
    }
}


// --- Módulo: QuizUI ---
class QuizUI {
    constructor() {
        this.cacheDOMelements();
        this.currentSection = 'inicio-section'; // Seção inicial padrão
        this.QUESTOES_POR_PAGINA_GRID = 5; // Itens na paginação do grid
        this.TRANSITION_DURATION = 400; // ms - Duração da animação de fade (CSS)
    }

    cacheDOMelements() {
        this.elements = {
            // Seções Principais
            inicioSection: document.getElementById('inicio-section'),
            questoesSection: document.getElementById('questoes-section'),
            contaSection: document.getElementById('conta-section'), // Seção Conta

            // Elementos de Navegação (Geral)
            navElements: document.querySelectorAll('[data-section]'), // Todos os links/botões com data-section

            // Elementos Específicos da Seção 'Questões'
            mainContentQuestoes: document.querySelector('#questoes-section .main-content'),
            filtroContainer: document.querySelector('.filtro-categorias-container'),
            filtroLabel: document.getElementById('categorias-label'), // Opcional
            filtroCheckboxesScroll: document.getElementById('filtro-checkboxes-scroll'),
            catScrollLeft: document.getElementById('cat-scroll-left'),
            catScrollRight: document.getElementById('cat-scroll-right'),
            avisoContainer: document.getElementById('aviso-container'),
            avisoMensagem: document.querySelector('#aviso-container .aviso-mensagem'),
            quizSectionContent: document.getElementById('quiz-section'), // Container do quiz
            questionWrap: document.querySelector('#quiz-section .question-wrap'),
            progressContainer: document.getElementById('progress-container'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressText: document.getElementById('progress-text'),
            questionTitle: document.getElementById('question-title'),
            categoriaTitulo: document.getElementById('categoria-titulo'),
            idQuestao: document.getElementById('id-questao'),
            perguntaTexto: document.getElementById('pergunta-texto'),
            perguntaImagem: document.getElementById('pergunta-imagem'),
            respostasContainer: document.getElementById('respostas-container'),
            referenciaQuestao: document.getElementById('referencia-questao'),
            navigationButtons: document.querySelector('#quiz-section .navigation-buttons'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            feedbackAcessivel: document.getElementById('feedback-acessivel'), // Opcional
            questionGridContainer: document.getElementById('question-grid-container'),
            btnEncerrarSessao: document.getElementById('btn-encerrar-sessao'), // Botão do aside

            // Resultado Final
            resultadoCard: document.querySelector('.resultado-final-card'),
            resultadoTitulo: document.querySelector('.resultado-final-titulo'),
            resultadoPontos: document.querySelector('.pontos-valor'),
            resultadoAcertos: document.querySelector('.acertos-valor'),
            resultadoErros: document.querySelector('.erros-valor'),
            btnRecomecar: document.getElementById('btn-recomecar'),

            // Aside (Elementos de pontuação)
            pontuacaoDisplay: document.getElementById('pontuacao'),
            acertosNumDisplay: document.getElementById('acertos-numero'),
            errosNumDisplay: document.getElementById('erros-numero'),

            // Modal
            confirmEncerrarOverlay: document.getElementById('confirm-encerrar-overlay'),
            confirmEncerrarBtn: document.getElementById('confirm-encerrar-btn'),
            cancelEncerrarBtn: document.getElementById('cancel-encerrar-btn')
        };

        // Cache dos elementos raiz das seções para facilitar show/hide geral
        this.sectionElements = {
            'inicio-section': this.elements.inicioSection,
            'questoes-section': this.elements.questoesSection,
            'conta-section': this.elements.contaSection
        };

        // Validação Simples do Cache (Opcional)
        this._validateCache();
    }

    _validateCache() {
        const optionalElements = ['feedbackAcessivel', 'filtroLabel']; // Elementos que podem não existir
        for (const key in this.elements) {
            if (!this.elements[key] && !optionalElements.includes(key) && !(key in this.sectionElements)) {
                // Avisa apenas se não for opcional e não for um elemento de seção já cacheado
                console.warn(`QuizUI Cache DOM: Elemento ${key} não encontrado!`);
            }
        }
        for (const key in this.sectionElements) {
             if (!this.sectionElements[key]) {
                  console.warn(`QuizUI Cache DOM: Elemento de Seção ${key} não encontrado!`);
             }
        }
    }

    // --- Gerenciamento de Visibilidade (Helpers) ---
    showElement(element) { element?.classList.remove('is-hidden'); }
    hideElement(element) { element?.classList.add('is-hidden'); }

    // --- Configuração da UI por Seção (Melhora OCP) ---
    getSectionUIConfig() {
        // Define o estado padrão (visível/oculto) de elementos específicos para cada seção
        return {
            'inicio-section': {
                visible: [],
                hidden: [
                    this.elements.filtroContainer, this.elements.quizSectionContent,
                    this.elements.resultadoCard, this.elements.btnEncerrarSessao,
                    this.elements.questionGridContainer, this.elements.progressContainer,
                    this.elements.progressText, this.elements.avisoContainer
                ],
                 onEnter: null // Nenhuma ação extra ao entrar
            },
            'questoes-section': {
                visible: [
                    this.elements.filtroContainer // Mostra filtros por padrão
                ],
                hidden: [
                    this.elements.quizSectionContent, this.elements.resultadoCard,
                    this.elements.btnEncerrarSessao, // Decida se este botão aparece sempre ou só com quiz ativo
                    this.elements.questionGridContainer, this.elements.progressContainer,
                    this.elements.progressText
                    // Aviso é tratado separadamente pela lógica do quiz
                ],
                onEnter: () => this.updateFilterScrollArrows() // Atualiza setas do filtro ao entrar
            },
            'conta-section': {
                visible: [],
                hidden: [
                    this.elements.filtroContainer, this.elements.quizSectionContent,
                    this.elements.resultadoCard, this.elements.btnEncerrarSessao,
                    this.elements.questionGridContainer, this.elements.progressContainer,
                    this.elements.progressText, this.elements.avisoContainer
                ],
                 onEnter: null
            }
            // --- Adicionar futuras seções aqui ---
            // 'ranking-section': { visible: [...], hidden: [...], onEnter: ... }
        };
    }


    // --- Gerenciamento de Seções (Refatorado) ---
    showSection(sectionId) {
        // 1. Esconder todas as seções principais
        Object.values(this.sectionElements).forEach(sectionEl => this.hideElement(sectionEl));

        // 2. Encontrar e mostrar a seção alvo
        const sectionToShow = this.sectionElements[sectionId];
        if (sectionToShow) {
            this.showElement(sectionToShow);
            this.currentSection = sectionId;
            this._updateActiveNavLinks(sectionId); // Atualiza links/ícones ativos

            // 3. Aplicar configuração de UI específica da seção
            const config = this.getSectionUIConfig()[sectionId];
            if (config) {
                config.visible?.forEach(el => this.showElement(el));
                config.hidden?.forEach(el => this.hideElement(el));
                config.onEnter?.(); // Executa ação extra, se definida
            } else {
                 console.warn(`Configuração de UI para a seção '${sectionId}' não encontrada.`);
                 // Fallback: Esconder elementos comuns para evitar estados inconsistentes
                 this.hideQuizElements();
                 this.hideElement(this.elements.filtroContainer);
                 this.hideElement(this.elements.avisoContainer);
            }

            // 4. Limpar aviso geral (a lógica do quiz tratará avisos específicos da seção 'questoes')
            if (sectionId !== 'questoes-section') {
                 this.clearWarning();
            }

        } else {
            console.error(`QuizUI: Seção com ID '${sectionId}' não encontrada.`);
            // Considerar redirecionar para 'inicio-section' como fallback seguro?
            if (this.currentSection !== 'inicio-section') {
                 // this.showSection('inicio-section');
            }
        }
    }

    // --- Atualização de Links/Ícones Ativos (Refatorado) ---
    _updateActiveNavLinks(activeSectionId) {
        // Itera sobre TODOS os elementos de navegação cacheados com data-section
        this.elements.navElements?.forEach(link => {
            if (!link) return;
            const isActive = link.dataset.section === activeSectionId;

            // Aplica/Remove classe 'active' para estilização (comum em links de navegação)
             if (link.classList.contains('nav-link') || link.classList.contains('bottom-nav-link')) {
                 link.classList.toggle('active', isActive);
             }
            // Poderia adicionar uma classe específica para o ícone do header ativo, se necessário
            // Ex: link.classList.toggle('header-icon--active', isActive && link.classList.contains('header-icon-link'));

            // Define aria-current para acessibilidade
            if (isActive) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    // --- Aviso ---
    showWarning(message) {
        const container = this.elements.avisoContainer;
        const msgElement = this.elements.avisoMensagem;
        if (container && msgElement) {
            msgElement.textContent = message;
            msgElement.setAttribute('role', 'alert'); // Informa leitores de tela
            this.showElement(container);

            // Se estiver na seção de questões, garante que o quiz e grid estejam escondidos
            if (this.currentSection === 'questoes-section') {
                 this.hideElement(this.elements.quizSectionContent);
                 this.hideElement(this.elements.questionGridContainer);
                 this.hideElement(this.elements.btnEncerrarSessao); // Esconde botão encerrar
                 this.hideProgressBar(); // Esconde barra de progresso
            }
        }
    }

    clearWarning() {
        this.hideElement(this.elements.avisoContainer);
        // Remove role=alert quando não há aviso
        this.elements.avisoMensagem?.removeAttribute('role');
    }

     // --- Conteúdo do Quiz (Mostrar/Esconder Bloco Principal) ---
    displayQuizContent(show = true) {
         // Controla a visibilidade dos containers GERAIS do quiz ativo
         if (show) {
             this.showElement(this.elements.quizSectionContent); // Mostra bloco da pergunta/respostas
             this.showElement(this.elements.btnEncerrarSessao); // Mostra botão de encerrar
             this.showElement(this.elements.progressContainer); // Mostra container da barra
             this.showElement(this.elements.progressText); // Mostra texto do progresso
             this.showElement(this.elements.questionGridContainer); // Mostra grid de navegação
             this.clearWarning(); // Limpa qualquer aviso anterior
             this.hideElement(this.elements.resultadoCard); // Esconde card de resultado final
             // Filtro já deve estar visível pela config de 'questoes-section'
         } else {
             // Esconde todos os elementos relacionados ao quiz ativo
             this.hideElement(this.elements.quizSectionContent);
             this.hideElement(this.elements.btnEncerrarSessao);
             this.hideProgressBar(); // Inclui barra e texto
             this.hideElement(this.elements.questionGridContainer);
             // Não mexe no aviso nem no resultado aqui, são controlados separadamente
         }
     }

    // Esconde elementos específicos do quiz (usado ao sair da seção ou mostrar resultado/aviso)
    hideQuizElements() {
        this.hideElement(this.elements.quizSectionContent);
        this.hideElement(this.elements.resultadoCard);
        // this.hideElement(this.elements.avisoContainer); // Aviso é tratado separadamente
        this.hideElement(this.elements.questionGridContainer);
        this.hideElement(this.elements.btnEncerrarSessao);
        this.hideProgressBar();
    }

    // --- Exibição da Questão (Atualiza Dados Visuais) ---
    displayQuestion(question, questionNumber, totalQuestions, selectedCategories) {
        if (!question) {
             console.error("Tentativa de exibir questão nula.");
             return; // Sai se a questão não for válida
        }

        // Atualiza Título e Referência
        let tituloCat = this.determineCategoryTitle(question, selectedCategories);
        this.elements.categoriaTitulo && (this.elements.categoriaTitulo.innerText = tituloCat);
        this.elements.idQuestao && (this.elements.idQuestao.innerText = questionNumber);
        this.elements.perguntaTexto && (this.elements.perguntaTexto.textContent = question.pergunta);
        this.elements.referenciaQuestao && (this.elements.referenciaQuestao.textContent = `Referência: ${question.referencia || 'N/A'}`);

        // Atualiza Imagem
        this.displayQuestionImage(question.imagem, questionNumber);

        // Atualiza Barra de Progresso
        this.updateProgressBar(questionNumber, totalQuestions);

        // Foco no título para acessibilidade (sem scroll automático inicial)
        this.elements.questionTitle?.focus({ preventScroll: true });
    }


    determineCategoryTitle(question, selectedCategories) {
        let tituloCat = "Questão"; // Título padrão
        const categoriasDaQuestao = question.categorias || [];
        const checkboxTodas = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]');

        if (checkboxTodas?.checked && categoriasDaQuestao.length > 0) {
            // Se 'Todas' está marcado e a questão tem categorias, mostra todas
            tituloCat = categoriasDaQuestao.join(' / ');
        } else if (selectedCategories?.length > 0) {
            // Se categorias específicas foram selecionadas
            const categoriaFiltradaAtiva = selectedCategories.find(catFiltro => categoriasDaQuestao.includes(catFiltro));
            if (categoriaFiltradaAtiva) {
                // Usa a primeira categoria correspondente ao filtro
                tituloCat = categoriaFiltradaAtiva;
            } else if (categoriasDaQuestao.length > 0) {
                // Fallback: se não corresponder ao filtro mas tiver categoria, mostra a primeira
                 tituloCat = categoriasDaQuestao[0];
             }
        } else if (categoriasDaQuestao.length > 0) {
             // Se nenhuma categoria foi selecionada (filtro 'Todas' desmarcado) e a questão tem categoria
             tituloCat = categoriasDaQuestao[0];
        }
        // Se não cair em nenhuma condição, mantém "Questão"

        return tituloCat;
    }

    displayQuestionImage(imageUrl, questionNumber) {
        const imgElement = this.elements.perguntaImagem;
        if (!imgElement) return; // Sai se o elemento img não existir

        if (imageUrl?.trim()) { // Verifica se a URL não é vazia ou só espaços
            imgElement.src = imageUrl;
            imgElement.alt = `Imagem ilustrativa da questão ${questionNumber}`;
            imgElement.loading = 'lazy'; // Carregamento preguiçoso
            this.showElement(imgElement); // Mostra o elemento img
            // Tratamento de erro no carregamento da imagem
            imgElement.onerror = () => {
                this.hideElement(imgElement); // Esconde se der erro
                console.warn(`Erro ao carregar imagem: ${imageUrl}`);
                imgElement.onerror = null; // Evita loop de erro se a imagem padrão também falhar
            };
        } else {
            // Se não há URL, esconde o elemento e limpa atributos
            this.hideElement(imgElement);
            imgElement.src = "";
            imgElement.alt = "";
        }
    }

    // --- Geração dos Botões de Resposta ---
    generateAnswerButtons(question, answerClickHandler) {
        const container = this.elements.respostasContainer;
        if (!container) return; // Sai se o container não existir
        container.innerHTML = ''; // Limpa respostas anteriores

        if (!question || !question.respostas?.length) {
            // Exibe mensagem de erro se não houver respostas
            container.innerHTML = '<p class="error-message">Erro: Opções de resposta não encontradas para esta questão.</p>';
            console.error("Questão inválida ou sem respostas:", question);
            return;
        }

        const jaRespondida = question.hasOwnProperty('respostaDada');

        question.respostas.forEach((respostaTexto) => {
            const p = document.createElement('p'); // Usando <p> como botão por questão de estilo anterior
            p.className = 'answer';
            p.textContent = respostaTexto;
            p.setAttribute('role', 'button'); // Semântica para acessibilidade
            p.tabIndex = jaRespondida ? -1 : 0; // Permite foco apenas se não respondida

            if (jaRespondida) {
                // Marca visualmente respostas já dadas (correta/incorreta)
                this.markAnswerAsAlreadyDone(p, question, respostaTexto);
            } else if (answerClickHandler) {
                // Adiciona handlers de clique e teclado apenas se não respondida
                const clickHandler = () => answerClickHandler(respostaTexto);
                p.onclick = clickHandler;
                p.onkeydown = (e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault(); // Evita scroll ou ativação dupla
                          clickHandler();
                     }
                };
            }
            container.appendChild(p);
        });
    }

    // Marca visualmente uma resposta que já foi dada anteriormente
    markAnswerAsAlreadyDone(answerElement, question, answerText) {
        answerElement.onclick = null; // Remove handlers
        answerElement.onkeydown = null;
        answerElement.classList.add('answered'); // Classe geral para desabilitadas
        answerElement.style.cursor = 'default'; // Cursor padrão
        answerElement.tabIndex = -1; // Remove do foco

        // Adiciona classe de correto/incorreto conforme o caso
        if (answerText === question.correta) {
            answerElement.classList.add('correct');
        } else if (answerText === question.respostaDada) { // Apenas se esta foi a resposta DADA
            answerElement.classList.add('incorrect');
        }
    }

    // Desabilita todas as opções de resposta após uma ser selecionada
    disableAnswers() {
        this.elements.respostasContainer?.querySelectorAll('.answer').forEach(answer => {
            answer.onclick = null;
            answer.onkeydown = null;
            answer.classList.add('answered');
            answer.style.cursor = 'default';
            answer.tabIndex = -1;
        });
    }

    // Aplica feedback visual (correto/incorreto) após a resposta
    applyAnswerFeedback(selectedAnswerText, correctAnswerText, isCorrect) {
        this.elements.respostasContainer?.querySelectorAll('.answer').forEach(answerEl => {
            const currentAnswerText = answerEl.textContent;
            if (currentAnswerText === selectedAnswerText) {
                // Marca a selecionada como correta ou incorreta
                answerEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
            // Se a resposta foi incorreta, marca também qual era a correta
            if (!isCorrect && currentAnswerText === correctAnswerText) {
                answerEl.classList.add('correct');
            }
        });

        // Atualiza span para leitores de tela
        if (this.elements.feedbackAcessivel) {
            this.elements.feedbackAcessivel.textContent = isCorrect ? "Resposta correta!" : "Resposta incorreta.";
        }
    }

    // --- Barra de Progresso ---
    updateProgressBar(current, total) {
        const container = this.elements.progressContainer;
        const bar = this.elements.progressBarFill;
        const text = this.elements.progressText;

        if (container && bar && text) {
            if (total > 0) {
                // Garante que o número atual não exceda o total para a barra
                const displayCurrent = Math.min(current, total);
                const percentage = (displayCurrent / total) * 100;
                bar.style.width = `${percentage}%`;
                text.textContent = `${current} / ${total}`;
                // Mostra os elementos se houver progresso a exibir
                this.showElement(container);
                this.showElement(text);
            } else {
                // Esconde se o total for 0 ou inválido
                this.hideProgressBar();
            }
        }
    }

    hideProgressBar() {
        this.hideElement(this.elements.progressContainer);
        this.hideElement(this.elements.progressText);
        // Reseta visualmente
        if(this.elements.progressBarFill) this.elements.progressBarFill.style.width = '0%';
        if(this.elements.progressText) this.elements.progressText.textContent = '';
    }

    // --- Botões de Navegação (Anterior/Próxima) ---
    updateNavigationButtons(isFirst, isLast, totalQuestions) {
         const navContainer = this.elements.navigationButtons;
         const prevBtn = this.elements.prevBtn;
         const nextBtn = this.elements.nextBtn;
         if (!navContainer || !prevBtn || !nextBtn) return; // Sai se botões não existem

         if (totalQuestions <= 0) {
              // Esconde se não há questões
              this.hideElement(navContainer);
              return;
         }

         this.showElement(navContainer); // Mostra container
         prevBtn.disabled = isFirst; // Desabilita "Anterior" na primeira questão
         nextBtn.disabled = false; // Botão "Próxima" geralmente fica habilitado
         // Muda o texto do botão "Próxima" na última questão
         nextBtn.textContent = isLast ? 'Ver Resultado' : 'Próxima';
         // Considerar desabilitar "Próxima" se a questão atual não foi respondida? (Opcional)
         // nextBtn.disabled = !this.state.getCurrentQuestion()?.hasOwnProperty('respostaDada');
    }

    // --- Grid de Navegação entre Questões ---
    renderQuestionGrid(questions, currentIndex, questionClickHandler) {
        const container = this.elements.questionGridContainer;
        if (!container || !questions?.length) {
             this.hideElement(container); // Esconde se não há questões ou container
             return;
        }
        this.showElement(container); // Mostra o grid
        container.innerHTML = ''; // Limpa grid anterior

        // Calcula a página atual e os índices para exibir no grid
        const currentPage = Math.floor(currentIndex / this.QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * this.QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + this.QUESTOES_POR_PAGINA_GRID, questions.length);

        // Cria e adiciona a seta "Anterior" do grid
        container.appendChild(this._createGridArrow(
             'prev', // Direção
             startIndex === 0, // Desabilitada se na primeira página do grid
             () => questionClickHandler(startIndex - 1), // Vai para questão anterior à primeira visível
             'Página Anterior de Questões'
        ));

        // Cria e adiciona os botões numéricos para as questões visíveis
        for (let i = startIndex; i < endIndex; i++) {
            const question = questions[i];
            const gridItem = document.createElement('button');
            gridItem.className = 'grid-item';
            gridItem.textContent = i + 1; // Número da questão (1-based)
            gridItem.dataset.index = i; // Índice da questão (0-based)
            gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
            gridItem.onclick = () => questionClickHandler(i); // Chama handler ao clicar

            // Adiciona classes de estado (respondida/correta/incorreta/atual)
            if (question.hasOwnProperty('respostaDada')) {
                const correct = question.respostaDada === question.correta;
                gridItem.classList.add(correct ? 'grid-item--correct' : 'grid-item--incorrect');
            }
            if (i === currentIndex) {
                gridItem.classList.add('grid-item--current');
                gridItem.setAttribute('aria-current', 'step'); // Indica item atual para acessibilidade
            }
            container.appendChild(gridItem);
        }

        // Cria e adiciona a seta "Próxima" do grid
        container.appendChild(this._createGridArrow(
             'next', // Direção
             endIndex >= questions.length, // Desabilitada se na última página do grid
             () => questionClickHandler(endIndex), // Vai para a primeira questão da próxima página
             'Próxima Página de Questões'
        ));
    }

    // Helper para criar os botões de seta do grid
    _createGridArrow(direction, disabled, clickHandler, ariaLabel) {
        const arrowBtn = document.createElement('button');
        arrowBtn.className = `grid-nav-arrow ${direction}`; // Adiciona classe de direção se necessário
        arrowBtn.setAttribute('aria-label', ariaLabel);
        arrowBtn.disabled = disabled;
        arrowBtn.onclick = clickHandler;

        // Cria SVG da seta (chevron left/right)
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 -960 960 960"); // Ajuste viewBox conforme seu SVG
        // svg.setAttribute("width", "24px"); // Tamanho definido no CSS
        // svg.setAttribute("height", "24px");
        svg.setAttribute("fill", "currentColor");
        const path = document.createElementNS(svgNS, "path");
        const pathD = direction === 'prev'
            ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" // Chevron Left
            : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"; // Chevron Right
        path.setAttribute("d", pathD);
        svg.appendChild(path);
        arrowBtn.appendChild(svg);
        return arrowBtn;
    }

    // --- Filtros de Categoria ---
    generateCategoryFilters(categories, changeHandler) {
        const container = this.elements.filtroCheckboxesScroll;
        if (!container) return; // Sai se o container não existir
        container.innerHTML = ''; // Limpa filtros anteriores
        const labelId = this.elements.filtroLabel?.id; // ID do label para aria-describedby

        // Helper para criar cada item de checkbox
        const createCheckboxItem = (id, value, text, checked = false) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            const input = document.createElement('input');
            input.type = 'checkbox'; input.id = id; input.name = 'categoria';
            input.value = value; input.checked = checked;
            // Associa ao label principal para acessibilidade, se o label existir
            if(labelId) input.setAttribute('aria-describedby', labelId);
            // Adiciona listener diretamente aqui (alternativa à delegação no App)
             // input.addEventListener('change', (e) => changeHandler(e.target));
            const label = document.createElement('label');
            label.htmlFor = id; label.textContent = text;
            div.append(input, label);
            return div;
        };

        // Adiciona opção "Todas"
        container.appendChild(createCheckboxItem('cat-todas', 'Todas', 'Todas', false)); // Começa desmarcado

        // Adiciona checkboxes para cada categoria
        categories.forEach(category => {
            // Cria um ID seguro para o HTML
            const id = `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            container.appendChild(createCheckboxItem(id, category, category, false)); // Começa desmarcado
        });

        // Atualiza a visibilidade das setas de scroll após gerar os filtros
        this.updateFilterScrollArrows();
    }

    // Obtém as categorias selecionadas (exceto "Todas")
    getSelectedCategories() {
        const selected = [];
        this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:checked:not([value="Todas"])')
            .forEach(cb => selected.push(cb.value));
        return selected;
    }

    // Sincroniza o checkbox "Todas" com os individuais
    syncSelectAllCheckbox() {
        const container = this.elements.filtroCheckboxesScroll;
        const cbTodas = container?.querySelector('input[value="Todas"]');
        const otherCheckboxes = container?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])');
        if (!cbTodas || !otherCheckboxes?.length) return;

        // Marca "Todas" se NENHUM dos outros estiver DESMARCADO
        cbTodas.checked = ![...otherCheckboxes].some(cb => !cb.checked);
    }

    // Marca ou desmarca todos os checkboxes individuais
    toggleAllCategories(isChecked) {
        this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])')
            .forEach(cb => {
                 if (cb.checked !== isChecked) { // Evita disparar 'change' desnecessariamente
                      cb.checked = isChecked;
                      // Disparar evento change manualmente se necessário para listeners externos
                      // cb.dispatchEvent(new Event('change', { bubbles: true }));
                 }
            });
    }

    // Atualiza visibilidade/estado das setas de scroll dos filtros
    updateFilterScrollArrows() {
         const scrollContainer = this.elements.filtroCheckboxesScroll;
         const leftArrow = this.elements.catScrollLeft;
         const rightArrow = this.elements.catScrollRight;

         // Esconde setas em telas mobile (definido pelo CSS, mas reforça aqui)
         if (window.innerWidth <= 768) { // Use a mesma breakpoint do seu CSS
             this.hideElement(leftArrow); this.hideElement(rightArrow);
             if(leftArrow) leftArrow.disabled = true;
             if(rightArrow) rightArrow.disabled = true;
             return;
         }

         // Sai se os elementos não existirem
         if (!scrollContainer || !leftArrow || !rightArrow) {
              this.hideElement(leftArrow); this.hideElement(rightArrow);
             if(leftArrow) leftArrow.disabled = true;
             if(rightArrow) rightArrow.disabled = true;
             return;
         }

         // Usa rAF para garantir que o cálculo ocorra após o render
         requestAnimationFrame(() => {
             // Re-verifica a existência dos elementos dentro do rAF
             if (!this.elements.filtroCheckboxesScroll || !this.elements.catScrollLeft || !this.elements.catScrollRight) return;

              const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
              const epsilon = 2; // Pequena margem para evitar erros de arredondamento

              // Verifica se há conteúdo suficiente para scrollar
              const canScroll = scrollWidth > clientWidth + epsilon;

              if (!canScroll) {
                  // Se não pode scrollar, esconde e desabilita setas
                  this.hideElement(leftArrow); this.hideElement(rightArrow);
                  leftArrow.disabled = true; rightArrow.disabled = true;
              } else {
                  // Se pode scrollar, mostra e habilita/desabilita conforme a posição
                  this.showElement(leftArrow); this.showElement(rightArrow);
                  leftArrow.disabled = scrollLeft <= 0; // Desabilita esquerda no início
                  // Desabilita direita quando o fim do scroll está visível
                  rightArrow.disabled = scrollLeft + clientWidth >= scrollWidth - epsilon;
              }
         });
     }

    // Realiza o scroll horizontal das categorias
    scrollCategories(direction) {
        const scrollContainer = this.elements.filtroCheckboxesScroll;
        if (!scrollContainer) return;
        // Calcula quanto scrollar (ex: 60% da largura visível)
        const scrollAmount = scrollContainer.clientWidth * 0.6;
        // Aplica o scroll com animação suave
        scrollContainer.scrollBy({
             left: direction === 'left' ? -scrollAmount : scrollAmount,
             behavior: 'smooth'
        });
        // Atualiza o estado das setas após iniciar o scroll (a transição cuidará do estado final)
         // Usar setTimeout pequeno pode ajudar a pegar o estado após o scroll iniciar
         setTimeout(() => this.updateFilterScrollArrows(), 100);
    }

    // --- Pontuação (Atualização do Aside) ---
    updateScoreDisplay(points, correct, incorrect) {
         if (this.elements.pontuacaoDisplay) this.elements.pontuacaoDisplay.textContent = points;
         if (this.elements.acertosNumDisplay) this.elements.acertosNumDisplay.textContent = correct;
         if (this.elements.errosNumDisplay) this.elements.errosNumDisplay.textContent = incorrect;
    }

    // --- Resultado Final ---
    showResults(userData, filteredQuestions, selectedCategories) {
        const card = this.elements.resultadoCard;
        if (!card || !userData) return; // Sai se não houver card ou dados do usuário

        // Esconde elementos do quiz ativo e filtros
        this.hideQuizElements();
        this.hideElement(this.elements.filtroContainer); // Esconde filtros na tela de resultado

        // Preenche os dados no card de resultado
        if(this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = this._generateResultTitle(filteredQuestions, selectedCategories);
        if(this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos;
        if(this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos;
        if(this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros;

        this.showElement(card); // Mostra o card de resultado
        this.elements.resultadoTitulo?.focus(); // Foco no título para acessibilidade
    }

    // Gera um título descritivo para o resultado
    _generateResultTitle(filteredQuestions, selectedCategories) {
         const totalFiltered = filteredQuestions?.length ?? 0;
         const allCategoriesAvailable = this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length ?? 0;
         const checkboxTodas = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]');

         if (totalFiltered === 0 && selectedCategories.length > 0) return "Nenhuma questão encontrada";
         if (totalFiltered === 0) return "Nenhuma questão respondida"; // Caso encerre sem responder

         if (checkboxTodas?.checked && allCategoriesAvailable > 0) return `Quiz de Todas as Categorias Concluído!`;
         if (selectedCategories.length === 1) return `Quiz de "${selectedCategories[0]}" Concluído!`;
         // Considera "Todas" se todas as individuais estiverem marcadas
         if (selectedCategories.length === allCategoriesAvailable && allCategoriesAvailable > 0) return `Quiz (Todas as ${selectedCategories.length} Categorias) Concluído!`;
         if (selectedCategories.length > 1) return `Quiz de ${selectedCategories.length} Categorias Concluído!`;

         return "Quiz Finalizado!"; // Título genérico
     }

    // Esconde o card de resultados (chamado ao recomeçar)
    hideResults() {
        this.hideElement(this.elements.resultadoCard);
        // Opcional: Mostra filtros novamente se for voltar para a seção de questões
        // if (this.currentSection === 'questoes-section') {
        //     this.showElement(this.elements.filtroContainer);
        // }
    }

    // --- Modal de Confirmação ---
    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) return;

        if (show) {
            this.showElement(overlay);
            // Força reflow antes de adicionar a classe 'visible' para garantir a transição
            overlay.scrollTop;
            requestAnimationFrame(() => {
                overlay.classList.add('visible');
                // Foco no botão "Cancelar" por padrão ao abrir
                this.elements.cancelEncerrarBtn?.focus();
            });
        } else {
            overlay.classList.remove('visible');
            // Usa 'transitionend' para esconder o elemento APÓS a transição terminar
            overlay.addEventListener('transitionend', () => {
                 // Garante que só esconde se a classe 'visible' ainda não estiver presente
                 if (!overlay.classList.contains('visible')) {
                      this.hideElement(overlay);
                 }
            }, { once: true }); // Listener é removido automaticamente após disparar uma vez
        }
    }

    // --- Scroll Suave ---
    // Rola a tela para o início da questão atual
    scrollToQuestionStart() {
        const titleElement = this.elements.questionTitle;
        // Só rola se estiver na seção de questões e o título existir
        if (this.currentSection === 'questoes-section' && titleElement) {
            try {
                 // Rola para o elemento mais próximo na tela
                 titleElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) {
                 console.warn("scrollIntoView falhou:", e);
                 // Fallback (menos suave)
                 // titleElement.focus(); // Focar pode causar algum scroll
            }
        } else if (this.currentSection === 'questoes-section') {
             console.warn("scrollToQuestionStart: Título da questão não encontrado.");
        }
    }

    // Coloca foco no botão "Próxima" (sem scroll)
    focusNextButton(preventScroll = false) {
        this.elements.nextBtn?.focus({ preventScroll });
    }

    // Rola a tela suavemente até os botões de navegação (Anterior/Próxima)
    smoothScrollToNextButton() {
         const navContainer = this.elements.navigationButtons;
         if (navContainer) {
              try {
                   // Rola para o container dos botões ficar o mais próximo possível da visão
                   navContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (e) {
                   console.warn("scrollIntoView (para container de botões) falhou:", e);
              }
         }
    }
}


// --- Módulo: QuizLogic ---
class QuizLogic {
    constructor(quizState, quizUI, userData) {
        this.state = quizState;
        this.ui = quizUI;
        this.user = userData;
    }

    // Inicia ou reinicia o quiz com base nas categorias selecionadas
    startQuiz() {
        this.user.reset(); // Zera pontuação do usuário
        this.state.filterQuestions(); // Filtra as questões com base nas categorias no estado
        // Atualiza display de pontuação inicial (zerado)
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults(); // Garante que a tela de resultados esteja escondida

        const questions = this.state.filteredQuestions;
        const categories = this.state.selectedCategories;

        if (questions.length > 0) {
             // Se há questões filtradas, mostra a UI do quiz e a primeira questão
             this.ui.displayQuizContent(true); // Mostra containers do quiz
             this._displayCurrentQuestion(false); // Exibe a 1ª questão, sem scroll inicial
        } else {
             // Se não há questões, esconde a UI do quiz e mostra aviso apropriado
             this.ui.displayQuizContent(false);
              const hasFiltersAvailable = this.ui.elements.filtroCheckboxesScroll?.querySelector('input[type="checkbox"]:not([value="Todas"])');
              if (categories.length === 0 && hasFiltersAvailable) {
                  this.ui.showWarning("Selecione pelo menos uma categoria para começar.");
              } else if (categories.length > 0) {
                  this.ui.showWarning("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
              } else if (!hasFiltersAvailable) {
                   this.ui.showWarning("Nenhuma categoria de pergunta disponível para seleção."); // Caso não carregue categorias
              } else {
                   this.ui.showWarning("Selecione uma categoria ou verifique os filtros."); // Genérico
              }
        }
    }

    // Chamado quando a seleção de categoria muda na UI
    handleCategoryChange() {
        // Atualiza o estado com as categorias selecionadas na UI
        const selectedCats = this.ui.getSelectedCategories();
        this.state.setSelectedCategories(selectedCats);
        // Inicia o quiz (que vai filtrar as questões com base no novo estado)
        this.startQuiz();
    }

    // Processa a resposta dada pelo usuário a uma questão
    answerQuestion(selectedAnswer) {
        const question = this.state.getCurrentQuestion();
        // Tenta registrar a resposta no estado
        if (this.state.recordAnswer(selectedAnswer)) {
            // Se a resposta foi registrada com sucesso:
            const isCorrect = selectedAnswer === question.correta;

            // Atualiza pontuação do usuário
            if (isCorrect) this.user.incrementarAcertos();
            else this.user.incrementarErros();

            // Atualiza a UI:
            this.ui.disableAnswers(); // Desabilita botões de resposta
            this.ui.applyAnswerFeedback(selectedAnswer, question.correta, isCorrect); // Mostra feedback visual
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros); // Atualiza placar
            // Atualiza o grid de navegação para refletir o status da questão respondida
            this.ui.renderQuestionGrid(
                 this.state.filteredQuestions,
                 this.state.currentQuestionIndex,
                 (index) => this.goToQuestion(index) // Passa a função de clique
            );
             // Atualiza estado dos botões Anterior/Próxima (pode habilitar Próxima aqui se estava desabilitado)
             this.ui.updateNavigationButtons(
                  this.state.isFirstQuestion(),
                  this.state.isLastQuestion(),
                  this.state.getTotalFilteredQuestions()
             );

            // Move o foco para o botão "Próxima" e rola suavemente até ele
            this.ui.focusNextButton(true); // Foco sem scroll imediato
            this.ui.smoothScrollToNextButton(); // Scroll suave
        }
        // Se recordAnswer retornar false, não faz nada (resposta já dada ou inválida)
    }


    // Navega para a próxima questão ou finaliza o quiz
    nextQuestion() {
         const isCurrentlyLast = this.state.isLastQuestion();
         const currentQuestion = this.state.getCurrentQuestion();

         // Opcional: Impedir de avançar se a questão atual não foi respondida
         // if (currentQuestion && !currentQuestion.hasOwnProperty('respostaDada') && !isCurrentlyLast) {
         //      console.log("Responda a questão atual antes de avançar.");
         //      // Poderia mostrar um feedback visual rápido aqui
         //      return;
         // }

         // Tenta avançar o estado para a próxima questão
         if (this.state.goToNextQuestion()) {
              // Se conseguiu avançar (não estava além da última):
              if (this.state.isQuizComplete()) {
                   // Se o novo índice indica que o quiz acabou
                   this.endQuiz();
              } else {
                   // Se ainda há questões, exibe a próxima
                   this._displayCurrentQuestion(); // Rola por padrão ao avançar
              }
         } else if (isCurrentlyLast && currentQuestion?.hasOwnProperty('respostaDada')) {
              // Se já estava na última E ela foi respondida, o clique em "Próxima/Ver Resultado" finaliza
              this.endQuiz();
         }
         // Se não conseguiu avançar (e.g., já estava completo), não faz nada
    }

    // Navega para a questão anterior
    previousQuestion() {
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestion(); // Rola por padrão ao voltar
        }
    }

    // Navega para uma questão específica (vinda do grid)
    goToQuestion(index) {
        // Verifica se o índice é para finalizar o quiz (índice igual ao total de questões)
        if (index >= this.state.getTotalFilteredQuestions()) {
             this.endQuiz(); // Considera como clique na seta "próxima" da última página do grid
        } else if (this.state.goToQuestion(index)) { // Tenta ir para o índice solicitado
           this._displayCurrentQuestion(); // Rola por padrão
       }
       // Se o índice for inválido (e.g., negativo), não faz nada
    }

    // Lógica interna para exibir a questão atual (com animação de fade)
    async _displayCurrentQuestion(shouldScroll = true) {
        const questionWrap = this.ui.elements.questionWrap;
        const isInitial = this.state.isInitialQuestionLoad;

        // Função interna para atualizar o conteúdo da UI da questão
        const updateContent = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                // Atualiza todos os elementos da UI relacionados à questão
                this.ui.displayQuestion(
                    question,
                    this.state.getCurrentQuestionNumberForDisplay(),
                    this.state.getTotalFilteredQuestions(),
                    this.state.selectedCategories
                );
                this.ui.updateNavigationButtons(
                    this.state.isFirstQuestion(),
                    this.state.isLastQuestion(),
                    this.state.getTotalFilteredQuestions()
                );
                this.ui.renderQuestionGrid(
                    this.state.filteredQuestions,
                    this.state.currentQuestionIndex,
                    (index) => this.goToQuestion(index) // Passa o handler de clique do grid
                );
                // Gera os botões de resposta, passando o handler de clique
                this.ui.generateAnswerButtons(question, (answer) => this.answerQuestion(answer));

                // Rola para o início da questão apenas se solicitado (evita no load inicial)
                if (shouldScroll) {
                     this.ui.scrollToQuestionStart();
                }
            } else {
                // Se getCurrentQuestion retornar null (erro inesperado)
                console.error("_displayCurrentQuestion: Tentativa de exibir questão inválida no índice:", this.state.currentQuestionIndex);
                this.endQuiz(); // Encerra o quiz como medida de segurança
            }
        };

        // Lógica da Animação Fade-in/Fade-out
        if (!isInitial && questionWrap) { // Só anima se não for o load inicial e o wrapper existir
            questionWrap.classList.add('is-fading-out'); // Inicia fade-out

            // Espera a transição de fade-out terminar (ou timeout)
            await new Promise(resolve => {
                let resolved = false;
                const handler = () => {
                    if (!resolved) {
                        questionWrap.removeEventListener('transitionend', handler);
                        resolved = true;
                        resolve();
                    }
                };
                questionWrap.addEventListener('transitionend', handler);
                // Fallback caso a transição não dispare (ex: elemento escondido)
                setTimeout(() => {
                     if (!resolved) {
                         console.warn("TransitionEnd fallback timeout triggered.");
                         questionWrap.removeEventListener('transitionend', handler);
                         resolved = true;
                         resolve();
                     }
                }, this.ui.TRANSITION_DURATION + 50); // Duração CSS + margem
            });

            // Após fade-out, torna transparente, atualiza conteúdo e inicia fade-in
            questionWrap.classList.remove('is-fading-out');
            questionWrap.classList.add('is-transparent'); // Mantém invisível sem transição

            // Garante que a atualização do DOM ocorra ANTES de remover a transparência
            requestAnimationFrame(() => {
                 updateContent(); // Atualiza o conteúdo enquanto transparente
                 // Garante que a remoção da classe ocorra no próximo frame, iniciando o fade-in
                 requestAnimationFrame(() => {
                      questionWrap.classList.remove('is-transparent');
                 });
            });
        } else {
            // Se for o load inicial ou wrapper não existe, atualiza direto sem animação
            updateContent();
            questionWrap?.classList.remove('is-fading-out', 'is-transparent'); // Garante visibilidade
            // Marca que o load inicial ocorreu (se houver questões)
            if(this.state.getTotalFilteredQuestions() > 0) {
                 this.state.isInitialQuestionLoad = false; // Prepara para animar na próxima navegação
            }
        }
    }


    // Finaliza o quiz e mostra a tela de resultados
    endQuiz() {
         console.log("Quiz encerrado.");
         this.ui.showResults(this.user, this.state.filteredQuestions, this.state.selectedCategories);
         // O foco é tratado dentro de showResults
    }

    // Reinicia o quiz com as mesmas categorias selecionadas
    restartQuiz() {
         console.log("Reiniciando quiz...");
         // this.state.resetQuizState(); // Zera progresso, mantém categorias selecionadas
         // startQuiz já chama filterQuestions que reseta o estado necessário
         this.startQuiz(); // Re-filtra e exibe a primeira questão
    }

    // Chamado pelo modal de confirmação para encerrar
    forceEndQuiz() {
        console.log("Forçando encerramento do quiz.");
        this.endQuiz(); // Mostra resultados com a pontuação atual
        this.ui.toggleConfirmModal(false); // Fecha o modal
    }
}


// --- Módulo Principal: App ---
class App {
    constructor() {
        // Instancia os módulos
        this.userData = new UserData();
        this.quizData = new QuizData(); // Pode passar URL diferente aqui se necessário
        this.quizState = new QuizState();
        this.quizUI = new QuizUI();
        // Injeta as dependências no QuizLogic
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData);
    }

    // Método principal de inicialização
    async initialize() {
        console.log("Inicializando App...");
        try {
            // 1. Carrega os dados das perguntas
            const loaded = await this.quizData.loadQuestions();

            if (loaded && this.quizData.allQuestions.length > 0) {
                // 2. Inicializa o estado com as perguntas carregadas
                this.quizState.initialize(this.quizData.getQuestions());

                // 3. Gera os filtros de categoria na UI
                const categories = this.quizData.extractUniqueCategories();
                // Passa o handler diretamente aqui (alternativa à delegação no setupEventListeners)
                // this.quizUI.generateCategoryFilters(categories, (checkbox) => this.handleFilterChange(checkbox));

                 // OU usa delegação (configurado no setupEventListeners)
                this.quizUI.generateCategoryFilters(categories);


                // 4. Configura os event listeners gerais da aplicação
                this.setupEventListeners();

                // 5. Exibe a seção inicial definida no HTML (ou 'inicio-section' como padrão)
                const initialActiveLink = document.querySelector('.nav-link.active, .bottom-nav-link.active, .header-icon-link.active'); // Inclui header icon se tiver classe active
                const initialSection = initialActiveLink?.dataset.section || 'inicio-section';
                this.quizUI.showSection(initialSection);

                console.log("App inicializado com sucesso.");
                // Garante que as setas de filtro sejam atualizadas no load inicial se a seção for 'questoes'
                 if (initialSection === 'questoes-section') {
                     this.quizUI.updateFilterScrollArrows();
                 }

            } else if (loaded) {
                 console.warn("Arquivo de perguntas carregado, mas está vazio ou inválido.");
                 this.quizUI.showSection('questoes-section'); // Vai para a seção de questões
                 this.quizUI.showWarning("Não foi possível carregar as perguntas. O arquivo pode estar vazio ou corrompido.");
                 this.disableCoreFunctionality(); // Desabilita filtros, etc.
            }
            // Se 'loaded' for false, o erro já foi tratado em loadQuestions e uma exceção lançada

        } catch (error) {
            // Erro crítico durante o carregamento ou inicialização
            console.error("Falha crítica ao inicializar o App:", error);
            // Mostra uma mensagem de erro genérica na UI
            this.quizUI.showSection('questoes-section'); // Mostra a seção de questões para exibir o erro
            this.quizUI.showWarning(`Erro ao carregar a aplicação: ${error.message}. Por favor, recarregue a página.`);
            this.disableCoreFunctionality(); // Desabilita funcionalidades principais
        }
    }

    // Desabilita funcionalidades se o carregamento falhar
    disableCoreFunctionality() {
         this.quizUI.hideElement(this.quizUI.elements.filtroContainer); // Esconde filtros
         // Poderia desabilitar outros botões ou links aqui se necessário
    }

    // Configura os listeners de eventos da aplicação (Refatorado)
    setupEventListeners() {
        // Listener GERAL para todos os elementos com data-section (links, botões, ícones)
        this.quizUI.elements.navElements?.forEach(navElement => {
            if (!navElement) return;
            navElement.addEventListener('click', (e) => {
                // Previne comportamento padrão APENAS para links <a>
                if (navElement.tagName === 'A') {
                     e.preventDefault();
                }
                const targetSection = navElement.dataset.section;
                // Muda de seção apenas se o target for válido e diferente da atual
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                     this.quizUI.showSection(targetSection);
                     // Se a nova seção for 'questoes', pode precisar reavaliar o estado do quiz
                     if (targetSection === 'questoes-section') {
                          // Verifica se um quiz estava em andamento para decidir se mostra aviso ou reinicia
                          // Por enquanto, apenas chama handleCategoryChange que vai verificar os filtros
                          this.quizLogic.handleCategoryChange();
                     }
                     // Adicionar aqui qualquer lógica ao ENTRAR em outras seções, se necessário
                }
            });
        });

        // --- Listeners Específicos ---
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());

        this.quizUI.elements.catScrollLeft?.addEventListener('click', () => this.quizUI.scrollCategories('left'));
        this.quizUI.elements.catScrollRight?.addEventListener('click', () => this.quizUI.scrollCategories('right'));
        // Scroll listener passivo para performance
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('scroll', () => this.quizUI.updateFilterScrollArrows(), { passive: true });

        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());

        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => this.quizLogic.forceEndQuiz());
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => this.quizUI.toggleConfirmModal(false));
        // Fechar modal clicando fora
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (event) => {
            if (event.target === this.quizUI.elements.confirmEncerrarOverlay) {
                 this.quizUI.toggleConfirmModal(false);
            }
        });

        // Listener DELEGADO para checkboxes de categoria (MAIS ROBUSTO)
        // Escuta eventos 'change' no container pai dos checkboxes
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('change', (event) => {
            // Verifica se o evento foi originado por um input checkbox
            if (event.target.matches('input[type="checkbox"][name="categoria"]')) {
                this.handleFilterChange(event.target); // Chama o handler passando o checkbox alterado
            }
        });


        // Listener para resize da janela (com debounce/throttle simples via setTimeout)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                 this.quizUI.updateFilterScrollArrows(); // Atualiza setas ao redimensionar
                 // Adicionar outras lógicas de UI responsivas aqui se necessário
            }, 150); // Aguarda 150ms após o último evento resize
        });
    }

    // Handler para mudança nos filtros de categoria
    handleFilterChange(changedCheckbox) {
         const container = this.quizUI.elements.filtroCheckboxesScroll;
         if (!container || !changedCheckbox) return;

         const isSelectAll = changedCheckbox.value === 'Todas'; // Verifica se foi o "Todas"

         // Sincroniza o checkbox "Todas" com os demais
         if (isSelectAll) {
              this.quizUI.toggleAllCategories(changedCheckbox.checked);
         } else {
              this.quizUI.syncSelectAllCheckbox();
         }

         // Aciona a lógica do quiz para re-filtrar e iniciar/atualizar
         this.quizLogic.handleCategoryChange();
         // Atualiza as setas de scroll (pode ter mudado o estado de scroll)
         this.quizUI.updateFilterScrollArrows();
    }
}

// --- Inicialização da Aplicação ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize(); // Inicia o processo
});