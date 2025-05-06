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
 * - SOLID: Introdução de LayoutManager para SRP, OCP, DIP na gestão do footer.
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

// --- Módulo: LayoutManager --- (NOVA CLASSE)
class LayoutManager {
    constructor() {
        this.footerElement = document.getElementById('footer');
        if (!this.footerElement) {
            console.warn("LayoutManager: Footer element not found!");
        }
        // Cache de outros elementos globais de layout pode ser adicionado aqui (ex: header)
    }

    /**
     * Lida com a mudança da seção ativa, ajustando elementos globais do layout.
     * @param {string} sectionId O ID da nova seção ativa.
     * @param {string} [previousSectionId] O ID da seção anterior (opcional).
     */
    handleSectionChange(sectionId, previousSectionId) {
        if (!this.footerElement) return; // Não faz nada se o footer não existe

        // Lógica de visibilidade do Footer: Esconder apenas na seção 'questoes-section'
        if (sectionId === 'questoes-section') {
            this.footerElement.classList.add('is-hidden');
        } else {
            this.footerElement.classList.remove('is-hidden');
            // Nota: O CSS responsivo ainda pode esconder o footer em telas mobile.
        }

        // Poderia adicionar lógica para outros elementos globais aqui (ex: header diferente)
        // console.log(`LayoutManager: Section changed from ${previousSectionId} to ${sectionId}`);
    }

    // Métodos opcionais para controle explícito, se necessário em outros contextos
    // showFooter() { this.footerElement?.classList.remove('is-hidden'); }
    // hideFooter() { this.footerElement?.classList.add('is-hidden'); }
}


// --- Módulo: QuizUI ---
class QuizUI {
    // MODIFICADO: Aceita callback para notificar mudança de seção
    constructor(onSectionChangeCallback = null) {
        this.cacheDOMelements();
        this.currentSection = 'inicio-section'; // Seção inicial padrão
        this.QUESTOES_POR_PAGINA_GRID = 5; // Itens na paginação do grid
        this.TRANSITION_DURATION = 400; // ms - Duração da animação de fade (CSS)
        // MODIFICADO: Armazena o callback
        this.onSectionChange = onSectionChangeCallback;
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

            // REMOVIDO: footer: document.getElementById('footer') << REMOVIDO DAQUI
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
            // Verifica se o elemento não existe, não é opcional e não é um elemento de seção principal
            if (!this.elements[key] && !optionalElements.includes(key) && !(key in this.sectionElements)) {
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
                    this.elements.btnEncerrarSessao, // Botão Encerrar é mostrado/escondido com displayQuizContent
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
            // Adicionar futuras seções aqui
        };
    }


    // --- Gerenciamento de Seções (Refatorado) ---
    showSection(sectionId) {
        // 1. Esconder todas as seções principais
        Object.values(this.sectionElements).forEach(sectionEl => this.hideElement(sectionEl));

        // 2. Encontrar e mostrar a seção alvo
        const sectionToShow = this.sectionElements[sectionId];

        if (sectionToShow) {
            const previousSection = this.currentSection; // Armazena seção anterior
            this.showElement(sectionToShow);
            this.currentSection = sectionId;
            this._updateActiveNavLinks(sectionId); // Atualiza links/ícones ativos

            // --- NÃO MANIPULA MAIS O FOOTER DIRETAMENTE ---

            // 3. Aplicar configuração de UI específica da seção
            const config = this.getSectionUIConfig()[sectionId];
            if (config) {
                config.visible?.forEach(el => this.showElement(el));
                config.hidden?.forEach(el => this.hideElement(el));
                config.onEnter?.(); // Executa ação extra, se definida
            } else {
                 console.warn(`Configuração de UI para a seção '${sectionId}' não encontrada.`);
                 // Fallback
                 this.hideQuizElements();
                 this.hideElement(this.elements.filtroContainer);
                 this.hideElement(this.elements.avisoContainer);
            }

            // 4. Limpar aviso geral (exceto na seção de questões, onde a lógica do quiz cuida disso)
            if (sectionId !== 'questoes-section') {
                 this.clearWarning();
            }

            // --- MODIFICADO: Notifica sobre a mudança de seção se houver callback ---
            if (this.onSectionChange && typeof this.onSectionChange === 'function' && previousSection !== sectionId) {
                try {
                    // Chama o callback passando o ID da nova seção e o ID da seção anterior
                    this.onSectionChange(sectionId, previousSection);
                } catch (error) {
                    console.error("Erro ao executar callback onSectionChange:", error);
                }
            }
            // --- FIM da Notificação ---

        } else {
            console.error(`QuizUI: Seção com ID '${sectionId}' não encontrada.`);
            if (this.currentSection !== 'inicio-section') {
                 // Considerar mostrar seção inicial como fallback
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

            // Aplica/Remove classe 'active' para estilização
             if (link.classList.contains('nav-link') || link.classList.contains('bottom-nav-link')) {
                 link.classList.toggle('active', isActive);
             }
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

            // Se estiver na seção de questões, garante que o quiz/grid estejam escondidos
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
        this.elements.avisoMensagem?.removeAttribute('role');
    }

     // --- Conteúdo do Quiz (Mostrar/Esconder Bloco Principal) ---
    displayQuizContent(show = true) {
         // Controla a visibilidade dos containers GERAIS do quiz ativo
         if (show) {
             this.showElement(this.elements.quizSectionContent); // Bloco da pergunta/respostas
             this.showElement(this.elements.btnEncerrarSessao); // Botão de encerrar
             this.showElement(this.elements.progressContainer); // Container da barra
             this.showElement(this.elements.progressText); // Texto do progresso
             this.showElement(this.elements.questionGridContainer); // Grid de navegação
             this.clearWarning(); // Limpa aviso anterior
             this.hideElement(this.elements.resultadoCard); // Esconde card de resultado final
         } else {
             // Esconde todos os elementos relacionados ao quiz ativo
             this.hideElement(this.elements.quizSectionContent);
             this.hideElement(this.elements.btnEncerrarSessao);
             this.hideProgressBar(); // Inclui barra e texto
             this.hideElement(this.elements.questionGridContainer);
         }
     }

    // Esconde elementos específicos do quiz (usado ao sair da seção ou mostrar resultado/aviso)
    hideQuizElements() {
        this.hideElement(this.elements.quizSectionContent);
        this.hideElement(this.elements.resultadoCard);
        this.hideElement(this.elements.questionGridContainer);
        this.hideElement(this.elements.btnEncerrarSessao);
        this.hideProgressBar();
    }

    // --- Exibição da Questão (Atualiza Dados Visuais) ---
    displayQuestion(question, questionNumber, totalQuestions, selectedCategories) {
        if (!question) {
             console.error("Tentativa de exibir questão nula.");
             return;
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
            tituloCat = categoriasDaQuestao.join(' / ');
        } else if (selectedCategories?.length > 0) {
            const categoriaFiltradaAtiva = selectedCategories.find(catFiltro => categoriasDaQuestao.includes(catFiltro));
            if (categoriaFiltradaAtiva) {
                tituloCat = categoriaFiltradaAtiva;
            } else if (categoriasDaQuestao.length > 0) {
                 tituloCat = categoriasDaQuestao[0]; // Fallback
             }
        } else if (categoriasDaQuestao.length > 0) {
             tituloCat = categoriasDaQuestao[0]; // Se filtro "Todas" desmarcado
        }
        return tituloCat;
    }

    displayQuestionImage(imageUrl, questionNumber) {
        const imgElement = this.elements.perguntaImagem;
        if (!imgElement) return;

        if (imageUrl?.trim()) {
            imgElement.src = imageUrl;
            imgElement.alt = `Imagem ilustrativa da questão ${questionNumber}`;
            imgElement.loading = 'lazy';
            this.showElement(imgElement);
            imgElement.onerror = () => {
                this.hideElement(imgElement);
                console.warn(`Erro ao carregar imagem: ${imageUrl}`);
                imgElement.onerror = null;
            };
        } else {
            this.hideElement(imgElement);
            imgElement.src = "";
            imgElement.alt = "";
        }
    }

    // --- Geração dos Botões de Resposta ---
    generateAnswerButtons(question, answerClickHandler) {
        const container = this.elements.respostasContainer;
        if (!container) return;
        container.innerHTML = ''; // Limpa

        if (!question || !question.respostas?.length) {
            container.innerHTML = '<p class="error-message">Erro: Opções de resposta não encontradas.</p>';
            console.error("Questão inválida ou sem respostas:", question);
            return;
        }

        const jaRespondida = question.hasOwnProperty('respostaDada');

        question.respostas.forEach((respostaTexto) => {
            const p = document.createElement('p');
            p.className = 'answer';
            p.textContent = respostaTexto;
            p.setAttribute('role', 'button');
            p.tabIndex = jaRespondida ? -1 : 0;

            if (jaRespondida) {
                this.markAnswerAsAlreadyDone(p, question, respostaTexto);
            } else if (answerClickHandler) {
                const clickHandler = () => answerClickHandler(respostaTexto);
                p.onclick = clickHandler;
                p.onkeydown = (e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          clickHandler();
                     }
                };
            }
            container.appendChild(p);
        });
    }

    // Marca visualmente uma resposta que já foi dada anteriormente
    markAnswerAsAlreadyDone(answerElement, question, answerText) {
        answerElement.onclick = null;
        answerElement.onkeydown = null;
        answerElement.classList.add('answered');
        answerElement.style.cursor = 'default';
        answerElement.tabIndex = -1;

        if (answerText === question.correta) {
            answerElement.classList.add('correct');
        } else if (answerText === question.respostaDada) {
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
                answerEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
            if (!isCorrect && currentAnswerText === correctAnswerText) {
                answerEl.classList.add('correct'); // Marca a correta também se errou
            }
        });

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
                const displayCurrent = Math.min(current, total);
                const percentage = (displayCurrent / total) * 100;
                bar.style.width = `${percentage}%`;
                text.textContent = `${current} / ${total}`;
                this.showElement(container);
                this.showElement(text);
            } else {
                this.hideProgressBar();
            }
        }
    }

    hideProgressBar() {
        this.hideElement(this.elements.progressContainer);
        this.hideElement(this.elements.progressText);
        if(this.elements.progressBarFill) this.elements.progressBarFill.style.width = '0%';
        if(this.elements.progressText) this.elements.progressText.textContent = '';
    }

    // --- Botões de Navegação (Anterior/Próxima) ---
    updateNavigationButtons(isFirst, isLast, totalQuestions) {
         const navContainer = this.elements.navigationButtons;
         const prevBtn = this.elements.prevBtn;
         const nextBtn = this.elements.nextBtn;
         if (!navContainer || !prevBtn || !nextBtn) return;

         if (totalQuestions <= 0) {
              this.hideElement(navContainer);
              return;
         }

         this.showElement(navContainer);
         prevBtn.disabled = isFirst;
         nextBtn.disabled = false; // Geralmente habilitado, lógica extra pode desabilitar
         nextBtn.textContent = isLast ? 'Ver Resultado' : 'Próxima';
    }

    // --- Grid de Navegação entre Questões ---
    renderQuestionGrid(questions, currentIndex, questionClickHandler) {
        const container = this.elements.questionGridContainer;
        if (!container || !questions?.length) {
             this.hideElement(container);
             return;
        }
        this.showElement(container);
        container.innerHTML = ''; // Limpa

        const currentPage = Math.floor(currentIndex / this.QUESTOES_POR_PAGINA_GRID);
        const startIndex = currentPage * this.QUESTOES_POR_PAGINA_GRID;
        const endIndex = Math.min(startIndex + this.QUESTOES_POR_PAGINA_GRID, questions.length);

        // Seta Anterior
        container.appendChild(this._createGridArrow(
             'prev', startIndex === 0, () => questionClickHandler(startIndex - 1), 'Página Anterior de Questões'
        ));

        // Botões Numéricos
        for (let i = startIndex; i < endIndex; i++) {
            const question = questions[i];
            const gridItem = document.createElement('button');
            gridItem.className = 'grid-item';
            gridItem.textContent = i + 1;
            gridItem.dataset.index = i;
            gridItem.setAttribute('aria-label', `Ir para questão ${i + 1}`);
            gridItem.onclick = () => questionClickHandler(i);

            if (question.hasOwnProperty('respostaDada')) {
                const correct = question.respostaDada === question.correta;
                gridItem.classList.add(correct ? 'grid-item--correct' : 'grid-item--incorrect');
            }
            if (i === currentIndex) {
                gridItem.classList.add('grid-item--current');
                gridItem.setAttribute('aria-current', 'step');
            }
            container.appendChild(gridItem);
        }

        // Seta Próxima
        container.appendChild(this._createGridArrow(
             'next', endIndex >= questions.length, () => questionClickHandler(endIndex), 'Próxima Página de Questões'
        ));
    }

    // Helper para criar as setas do grid
    _createGridArrow(direction, disabled, clickHandler, ariaLabel) {
        const arrowBtn = document.createElement('button');
        arrowBtn.className = `grid-nav-arrow ${direction === 'prev' ? 'left' : 'right'}`; // Usa classes left/right se existirem
        arrowBtn.setAttribute('aria-label', ariaLabel);
        arrowBtn.disabled = disabled;
        arrowBtn.onclick = clickHandler;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 -960 960 960");
        svg.setAttribute("fill", "currentColor");
        const path = document.createElementNS(svgNS, "path");
        const pathD = direction === 'prev'
            ? "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" // Esquerda
            : "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"; // Direita
        path.setAttribute("d", pathD);
        svg.appendChild(path);
        arrowBtn.appendChild(svg);
        return arrowBtn;
    }

    // --- Filtros de Categoria ---
    generateCategoryFilters(categories) { // Removido changeHandler daqui
        const container = this.elements.filtroCheckboxesScroll;
        if (!container) return;
        container.innerHTML = '';
        const labelId = this.elements.filtroLabel?.id;

        const createCheckboxItem = (id, value, text, checked = false) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            const input = document.createElement('input');
            input.type = 'checkbox'; input.id = id; input.name = 'categoria';
            input.value = value; input.checked = checked;
            if(labelId) input.setAttribute('aria-describedby', labelId);
            // O listener será adicionado via delegação no App
            const label = document.createElement('label');
            label.htmlFor = id; label.textContent = text;
            div.append(input, label);
            return div;
        };

        container.appendChild(createCheckboxItem('cat-todas', 'Todas', 'Todas', false)); // "Todas" começa desmarcado

        categories.forEach(category => {
            const id = `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            container.appendChild(createCheckboxItem(id, category, category, false));
        });

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

        // Marca "Todas" se NENHUM dos outros estiver DESMARCADO (ou seja, todos marcados)
        cbTodas.checked = ![...otherCheckboxes].some(cb => !cb.checked);
    }

    // Marca ou desmarca todos os checkboxes individuais
    toggleAllCategories(isChecked) {
        this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])')
            .forEach(cb => {
                 if (cb.checked !== isChecked) {
                      cb.checked = isChecked;
                      // Dispara evento change manualmente para que o listener delegado no App o capture
                      cb.dispatchEvent(new Event('change', { bubbles: true }));
                 }
            });
    }

    // Atualiza visibilidade/estado das setas de scroll dos filtros
    updateFilterScrollArrows() {
         const scrollContainer = this.elements.filtroCheckboxesScroll;
         const leftArrow = this.elements.catScrollLeft;
         const rightArrow = this.elements.catScrollRight;

         // Esconde setas em telas mobile (melhor prática é via CSS, mas reforça)
         if (window.innerWidth <= 768) { // Ponto de quebra do CSS
             this.hideElement(leftArrow); this.hideElement(rightArrow);
             if(leftArrow) leftArrow.disabled = true;
             if(rightArrow) rightArrow.disabled = true;
             return;
         }

         if (!scrollContainer || !leftArrow || !rightArrow) {
              this.hideElement(leftArrow); this.hideElement(rightArrow);
             if(leftArrow) leftArrow.disabled = true;
             if(rightArrow) rightArrow.disabled = true;
             return;
         }

         requestAnimationFrame(() => {
             if (!this.elements.filtroCheckboxesScroll || !this.elements.catScrollLeft || !this.elements.catScrollRight) return;

              const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
              const epsilon = 2; // Margem de erro

              const canScroll = scrollWidth > clientWidth + epsilon;

              if (!canScroll) {
                  this.hideElement(leftArrow); this.hideElement(rightArrow);
                  leftArrow.disabled = true; rightArrow.disabled = true;
              } else {
                  this.showElement(leftArrow); this.showElement(rightArrow);
                  leftArrow.disabled = scrollLeft <= 0;
                  rightArrow.disabled = scrollLeft + clientWidth >= scrollWidth - epsilon;
              }
         });
     }

    // Realiza o scroll horizontal das categorias
    scrollCategories(direction) {
        const scrollContainer = this.elements.filtroCheckboxesScroll;
        if (!scrollContainer) return;
        const scrollAmount = scrollContainer.clientWidth * 0.6;
        scrollContainer.scrollBy({
             left: direction === 'left' ? -scrollAmount : scrollAmount,
             behavior: 'smooth'
        });
         // A atualização das setas já acontece no evento 'scroll' passivo.
         // Podemos forçar uma atualização após um pequeno delay se necessário.
         // setTimeout(() => this.updateFilterScrollArrows(), 150);
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
        if (!card || !userData) return;

        this.hideQuizElements();
        this.hideElement(this.elements.filtroContainer); // Esconde filtros na tela de resultado

        if(this.elements.resultadoTitulo) this.elements.resultadoTitulo.textContent = this._generateResultTitle(filteredQuestions, selectedCategories);
        if(this.elements.resultadoPontos) this.elements.resultadoPontos.textContent = userData.pontos;
        if(this.elements.resultadoAcertos) this.elements.resultadoAcertos.textContent = userData.acertos;
        if(this.elements.resultadoErros) this.elements.resultadoErros.textContent = userData.erros;

        this.showElement(card);
        this.elements.resultadoTitulo?.focus(); // Foco para acessibilidade
    }

    // Gera um título descritivo para o resultado
    _generateResultTitle(filteredQuestions, selectedCategories) {
         const totalFiltered = filteredQuestions?.length ?? 0;
         const allCategoriesAvailable = this.elements.filtroCheckboxesScroll?.querySelectorAll('input[type="checkbox"]:not([value="Todas"])').length ?? 0;
         const checkboxTodas = this.elements.filtroCheckboxesScroll?.querySelector('input[value="Todas"]');

         if (totalFiltered === 0 && selectedCategories.length > 0) return "Nenhuma questão encontrada";
         if (totalFiltered === 0) return "Nenhuma questão respondida";

         if (checkboxTodas?.checked && allCategoriesAvailable > 0) return `Quiz de Todas as Categorias Concluído!`;
         if (selectedCategories.length === 1) return `Quiz de "${selectedCategories[0]}" Concluído!`;
         if (selectedCategories.length === allCategoriesAvailable && allCategoriesAvailable > 0) return `Quiz (Todas as ${selectedCategories.length} Categorias) Concluído!`;
         if (selectedCategories.length > 1) return `Quiz de ${selectedCategories.length} Categorias Concluído!`;

         return "Quiz Finalizado!";
     }

    // Esconde o card de resultados
    hideResults() {
        this.hideElement(this.elements.resultadoCard);
    }

    // --- Modal de Confirmação ---
    toggleConfirmModal(show) {
        const overlay = this.elements.confirmEncerrarOverlay;
        if (!overlay) return;

        if (show) {
            this.showElement(overlay);
            overlay.scrollTop; // Force reflow
            requestAnimationFrame(() => {
                overlay.classList.add('visible');
                this.elements.cancelEncerrarBtn?.focus(); // Foco no Cancelar
            });
        } else {
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => {
                 if (!overlay.classList.contains('visible')) {
                      this.hideElement(overlay);
                 }
            }, { once: true });
        }
    }

    // --- Scroll Suave ---
    scrollToQuestionStart() {
        const titleElement = this.elements.questionTitle;
        if (this.currentSection === 'questoes-section' && titleElement) {
            try {
                 titleElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) {
                 console.warn("scrollIntoView falhou:", e);
            }
        } else if (this.currentSection === 'questoes-section') {
             console.warn("scrollToQuestionStart: Título da questão não encontrado.");
        }
    }

    focusNextButton(preventScroll = false) {
        this.elements.nextBtn?.focus({ preventScroll });
    }

    smoothScrollToNextButton() {
         const navContainer = this.elements.navigationButtons;
         if (navContainer) {
              try {
                   navContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (e) {
                   console.warn("scrollIntoView (para botões) falhou:", e);
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
        this.user.reset();
        this.state.filterQuestions(); // Filtra com base nas categorias JÁ no estado
        this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
        this.ui.hideResults();

        const questions = this.state.filteredQuestions;
        const categories = this.state.selectedCategories; // Pega do estado

        if (questions.length > 0) {
             this.ui.displayQuizContent(true);
             this._displayCurrentQuestion(false); // Mostra 1ª questão, sem scroll
        } else {
             this.ui.displayQuizContent(false);
              const hasFiltersAvailable = this.ui.elements.filtroCheckboxesScroll?.querySelector('input[type="checkbox"]:not([value="Todas"])');
              if (categories.length === 0 && hasFiltersAvailable) {
                  this.ui.showWarning("Selecione pelo menos uma categoria para começar.");
              } else if (categories.length > 0) {
                  this.ui.showWarning("Nenhuma pergunta encontrada para a(s) categoria(s) selecionada(s).");
              } else if (!hasFiltersAvailable) {
                   this.ui.showWarning("Nenhuma categoria de pergunta disponível para seleção.");
              } else {
                   this.ui.showWarning("Selecione uma categoria ou verifique os filtros.");
              }
        }
    }

    // Chamado quando a seleção de categoria muda na UI (via App)
    handleCategoryChange() {
        // 1. Pega as categorias da UI
        const selectedCats = this.ui.getSelectedCategories();
        // 2. Atualiza o estado
        this.state.setSelectedCategories(selectedCats);
        // 3. (Re)Inicia o quiz (que vai ler as categorias do estado e filtrar)
        this.startQuiz();
    }

    // Processa a resposta dada pelo usuário a uma questão
    answerQuestion(selectedAnswer) {
        const question = this.state.getCurrentQuestion();
        if (this.state.recordAnswer(selectedAnswer)) { // Tenta registrar no estado
            const isCorrect = selectedAnswer === question.correta;

            // Atualiza pontuação
            if (isCorrect) this.user.incrementarAcertos();
            else this.user.incrementarErros();

            // Atualiza UI
            this.ui.disableAnswers();
            this.ui.applyAnswerFeedback(selectedAnswer, question.correta, isCorrect);
            this.ui.updateScoreDisplay(this.user.pontos, this.user.acertos, this.user.erros);
            this.ui.renderQuestionGrid(
                 this.state.filteredQuestions,
                 this.state.currentQuestionIndex,
                 (index) => this.goToQuestion(index) // Handler para clique no grid
            );
             this.ui.updateNavigationButtons(
                  this.state.isFirstQuestion(),
                  this.state.isLastQuestion(),
                  this.state.getTotalFilteredQuestions()
             );

            // Foco e scroll para Próxima
            this.ui.focusNextButton(true);
            this.ui.smoothScrollToNextButton();
        }
    }


    // Navega para a próxima questão ou finaliza o quiz
    nextQuestion() {
         const isCurrentlyLast = this.state.isLastQuestion();
         const currentQuestion = this.state.getCurrentQuestion();

         // Opcional: Verificar se respondeu antes de avançar
         // if (currentQuestion && !currentQuestion.hasOwnProperty('respostaDada') && !isCurrentlyLast) { return; }

         if (this.state.goToNextQuestion()) { // Tenta avançar estado
              if (this.state.isQuizComplete()) { // Se chegou ao fim
                   this.endQuiz();
              } else { // Se ainda há questões
                   this._displayCurrentQuestion(); // Exibe próxima
              }
         } else if (isCurrentlyLast && currentQuestion?.hasOwnProperty('respostaDada')) {
              // Se já estava na última RESPONDIDA, finaliza
              this.endQuiz();
         }
    }

    // Navega para a questão anterior
    previousQuestion() {
        if (this.state.goToPreviousQuestion()) {
            this._displayCurrentQuestion(); // Exibe anterior
        }
    }

    // Navega para uma questão específica (vinda do grid)
    goToQuestion(index) {
        // Índice igual ao total significa clique na seta "próxima" da última página
        if (index >= this.state.getTotalFilteredQuestions()) {
             this.endQuiz();
        } else if (this.state.goToQuestion(index)) { // Tenta ir para o índice válido
           this._displayCurrentQuestion(); // Exibe a questão do índice
       }
    }

    // Lógica interna para exibir a questão atual (com animação)
    async _displayCurrentQuestion(shouldScroll = true) {
        const questionWrap = this.ui.elements.questionWrap;
        const isInitial = this.state.isInitialQuestionLoad;

        const updateContent = () => {
            const question = this.state.getCurrentQuestion();
            if (question) {
                this.ui.displayQuestion(
                    question,
                    this.state.getCurrentQuestionNumberForDisplay(),
                    this.state.getTotalFilteredQuestions(),
                    this.state.selectedCategories // Passa categorias selecionadas do ESTADO
                );
                this.ui.updateNavigationButtons(
                    this.state.isFirstQuestion(),
                    this.state.isLastQuestion(),
                    this.state.getTotalFilteredQuestions()
                );
                this.ui.renderQuestionGrid(
                    this.state.filteredQuestions,
                    this.state.currentQuestionIndex,
                    (index) => this.goToQuestion(index) // Handler clique grid
                );
                this.ui.generateAnswerButtons(question, (answer) => this.answerQuestion(answer)); // Handler clique resposta

                if (shouldScroll) {
                     this.ui.scrollToQuestionStart();
                }
            } else {
                console.error("_displayCurrentQuestion: Questão inválida no índice:", this.state.currentQuestionIndex);
                this.endQuiz(); // Segurança
            }
        };

        // Animação Fade-in/Fade-out
        if (!isInitial && questionWrap) { // Anima apenas após load inicial
            questionWrap.classList.add('is-fading-out');

            await new Promise(resolve => { // Espera fim da transição ou timeout
                let resolved = false;
                const handler = () => {
                    if (!resolved) { questionWrap.removeEventListener('transitionend', handler); resolved = true; resolve(); }
                };
                questionWrap.addEventListener('transitionend', handler);
                setTimeout(() => {
                     if (!resolved) { questionWrap.removeEventListener('transitionend', handler); resolved = true; resolve(); }
                }, this.ui.TRANSITION_DURATION + 50);
            });

            questionWrap.classList.remove('is-fading-out');
            questionWrap.classList.add('is-transparent'); // Mantém invisível

            requestAnimationFrame(() => { // Atualiza DOM enquanto transparente
                 updateContent();
                 requestAnimationFrame(() => { // Remove transparência para fade-in
                      questionWrap.classList.remove('is-transparent');
                 });
            });
        } else { // Load inicial ou sem wrapper, atualiza direto
            updateContent();
            questionWrap?.classList.remove('is-fading-out', 'is-transparent');
            if(this.state.getTotalFilteredQuestions() > 0) {
                 this.state.markNavigated(); // Marca que o load inicial ocorreu (não é mais isInitial)
            }
        }
    }


    // Finaliza o quiz e mostra a tela de resultados
    endQuiz() {
         console.log("Quiz encerrado.");
         this.ui.showResults(this.user, this.state.filteredQuestions, this.state.selectedCategories);
    }

    // Reinicia o quiz com as mesmas categorias selecionadas
    restartQuiz() {
         console.log("Reiniciando quiz...");
         this.startQuiz(); // Já reseta estado e filtra novamente
    }

    // Chamado pelo modal de confirmação para encerrar
    forceEndQuiz() {
        console.log("Forçando encerramento do quiz.");
        this.endQuiz(); // Mostra resultados com pontuação atual
        this.ui.toggleConfirmModal(false); // Fecha modal
    }
}


// --- Módulo Principal: App ---
class App {
    constructor() {
        // Instancia os módulos
        this.userData = new UserData();
        this.quizData = new QuizData();
        this.quizState = new QuizState();

        // MODIFICADO: Instancia LayoutManager PRIMEIRO
        this.layoutManager = new LayoutManager();

        // MODIFICADO: Instancia QuizUI passando o handler do LayoutManager
        // Usamos .bind() para garantir o 'this' correto dentro de handleSectionChange
        this.quizUI = new QuizUI(this.layoutManager.handleSectionChange.bind(this.layoutManager));

        // Injeta dependências no QuizLogic (instância de QuizUI já existe)
        this.quizLogic = new QuizLogic(this.quizState, this.quizUI, this.userData);
    }

    // Método principal de inicialização
    async initialize() {
        console.log("Inicializando App...");
        try {
            // 1. Carrega perguntas
            const loaded = await this.quizData.loadQuestions();

            if (loaded && this.quizData.allQuestions.length > 0) {
                // 2. Inicializa estado com perguntas
                this.quizState.initialize(this.quizData.getQuestions());

                // 3. Gera filtros de categoria na UI
                const categories = this.quizData.extractUniqueCategories();
                this.quizUI.generateCategoryFilters(categories); // Handler será via delegação

                // 4. Configura listeners de eventos
                this.setupEventListeners();

                // 5. Exibe seção inicial (ativa ou padrão) E ACIONA O HANDLER INICIAL DO LAYOUT
                const initialActiveLink = document.querySelector('.nav-link.active, .bottom-nav-link.active, .header-icon-link.active');
                const initialSection = initialActiveLink?.dataset.section || 'inicio-section';
                // Chama showSection, que por sua vez chamará o handleSectionChange do LayoutManager
                this.quizUI.showSection(initialSection);

                console.log("App inicializado com sucesso.");
                // Atualiza setas do filtro se começar em 'questoes'
                 if (initialSection === 'questoes-section') {
                     this.quizUI.updateFilterScrollArrows();
                 }

            } else if (loaded) { // Carregou mas vazio/inválido
                 console.warn("Arquivo de perguntas carregado, mas vazio ou inválido.");
                 this.quizUI.showSection('questoes-section');
                 this.quizUI.showWarning("Não foi possível carregar as perguntas.");
                 this.disableCoreFunctionality();
            }
            // Se !loaded, erro já foi tratado em loadQuestions

        } catch (error) {
            console.error("Falha crítica ao inicializar o App:", error);
            this.quizUI.showSection('questoes-section'); // Tenta mostrar erro na seção de questões
            this.quizUI.showWarning(`Erro ao carregar: ${error.message}. Recarregue.`);
            this.disableCoreFunctionality();
        }
    }

    // Desabilita funcionalidades se carregamento falhar
    disableCoreFunctionality() {
         this.quizUI.hideElement(this.quizUI.elements.filtroContainer);
         // Poderia desabilitar outros botões aqui
    }

    // Configura os listeners de eventos da aplicação
    setupEventListeners() {
        // Listener GERAL para navegação entre seções
        this.quizUI.elements.navElements?.forEach(navElement => {
            if (!navElement) return;
            navElement.addEventListener('click', (e) => {
                if (navElement.tagName === 'A') e.preventDefault(); // Só para links

                const targetSection = navElement.dataset.section;
                // Muda de seção SE for diferente da atual
                if (targetSection && targetSection !== this.quizUI.currentSection) {
                     // showSection agora vai notificar o LayoutManager
                     this.quizUI.showSection(targetSection);

                     // Lógica ao ENTRAR na seção 'questoes' (após showSection ter sido chamado)
                     if (targetSection === 'questoes-section') {
                          // Chama handleCategoryChange para (re)iniciar o quiz baseado nos filtros
                          this.quizLogic.handleCategoryChange();
                     }
                     // Adicionar lógica para outras seções aqui, se necessário
                }
            });
        });

        // --- Listeners Específicos ---
        this.quizUI.elements.prevBtn?.addEventListener('click', () => this.quizLogic.previousQuestion());
        this.quizUI.elements.nextBtn?.addEventListener('click', () => this.quizLogic.nextQuestion());

        this.quizUI.elements.catScrollLeft?.addEventListener('click', () => this.quizUI.scrollCategories('left'));
        this.quizUI.elements.catScrollRight?.addEventListener('click', () => this.quizUI.scrollCategories('right'));
        // Listener de scroll passivo para performance (atualiza setas)
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('scroll', () => this.quizUI.updateFilterScrollArrows(), { passive: true });

        this.quizUI.elements.btnRecomecar?.addEventListener('click', () => this.quizLogic.restartQuiz());

        // Modal Encerrar
        this.quizUI.elements.btnEncerrarSessao?.addEventListener('click', () => this.quizUI.toggleConfirmModal(true));
        this.quizUI.elements.confirmEncerrarBtn?.addEventListener('click', () => this.quizLogic.forceEndQuiz());
        this.quizUI.elements.cancelEncerrarBtn?.addEventListener('click', () => this.quizUI.toggleConfirmModal(false));
        this.quizUI.elements.confirmEncerrarOverlay?.addEventListener('click', (event) => {
            if (event.target === this.quizUI.elements.confirmEncerrarOverlay) {
                 this.quizUI.toggleConfirmModal(false); // Fecha se clicar fora do modal
            }
        });

        // Listener DELEGADO para checkboxes de categoria (mais robusto)
        this.quizUI.elements.filtroCheckboxesScroll?.addEventListener('change', (event) => {
            // Verifica se o alvo do evento é um checkbox de categoria
            if (event.target.matches('input[type="checkbox"][name="categoria"]')) {
                this.handleFilterChange(event.target); // Chama o handler central
            }
        });


        // Listener para resize da janela (atualiza setas do filtro)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                 this.quizUI.updateFilterScrollArrows();
                 // Outras lógicas responsivas podem ir aqui
            }, 150); // Debounce simples
        });
    }

    // Handler para mudança nos filtros de categoria (chamado pelo listener delegado)
    handleFilterChange(changedCheckbox) {
         const container = this.quizUI.elements.filtroCheckboxesScroll;
         if (!container || !changedCheckbox) return;

         const isSelectAll = changedCheckbox.value === 'Todas';

         // Sincroniza "Todas" com os demais
         if (isSelectAll) {
              // Se "Todas" foi clicado, marca/desmarca os outros E dispara seus eventos 'change'
              this.quizUI.toggleAllCategories(changedCheckbox.checked);
              // Não precisa chamar handleCategoryChange aqui, pois toggleAllCategories já dispara os eventos
         } else {
              // Se um checkbox individual foi clicado, sincroniza o "Todas"
              this.quizUI.syncSelectAllCheckbox();
              // E chama a lógica do quiz para atualizar
              this.quizLogic.handleCategoryChange();
         }

         // Atualiza as setas de scroll após a mudança
         this.quizUI.updateFilterScrollArrows();
    }
}

// --- Inicialização da Aplicação ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize(); // Inicia o processo
});