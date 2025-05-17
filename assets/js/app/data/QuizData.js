// File: assets/js/app/data/QuizData.js

export default class QuizData {
    constructor(apiService) {
        console.log("QUIZDATA.JS: Constructor - Instância criada. ApiService:", apiService);
        this.apiService = apiService; // Injeção de dependência do ApiService

        this.allFetchedQuestions = []; // Perguntas da última busca (pode ser filtrada)
        this.allFetchedOptions = [];   // Opções da última busca
        this.allCategories = [];       // Todas as categorias (geralmente da busca inicial)
        
        this.dadosCarregadosCompletamente = false; // Indica se a carga inicial teve sucesso
        this.totalQuestionsCountForHub = 0; // Para o display no hub (total geral de perguntas ativas)
        this.isInitialFetchDone = false;    // Flag para controlar se a busca inicial já ocorreu
    }

    /**
     * Define os dados internos do quiz com base no que foi recebido da API.
     * @param {Array} perguntasData - Array de objetos de pergunta.
     * @param {Array} categoriasData - Array de objetos de categoria.
     * @param {Array} opcoesData - Array de objetos de opção de resposta.
     * @param {boolean} [isInitialLoad=false] - Indica se esta é a carga inicial de todos os dados.
     * @returns {boolean} True se os dados foram carregados com sucesso e há perguntas e categorias.
     */
    _setQuizData(perguntasData, categoriasData, opcoesData, isInitialLoad = false) {
        console.log("QUIZDATA.JS: _setQuizData - Definindo dados. É carregamento inicial:", isInitialLoad);
        this.allFetchedQuestions = Array.isArray(perguntasData) ? perguntasData : [];
        this.allFetchedOptions = Array.isArray(opcoesData) ? opcoesData : [];

        // Atualiza todas as categorias apenas se for a carga inicial ou se ainda não foram carregadas.
        // Isso evita que uma busca filtrada (que pode não retornar todas as categorias) sobrescreva a lista completa.
        if (isInitialLoad || this.allCategories.length === 0) {
            this.allCategories = Array.isArray(categoriasData) ? categoriasData : [];
            console.log("QUIZDATA.JS: _setQuizData - Todas as categorias carregadas/atualizadas:",
                this.allCategories.length, "categorias.",
                this.allCategories.length > 0 ? `Amostra: ${JSON.stringify(this.allCategories.slice(0, 1))}` : "Array vazio"
            );
        }

        // Define o total de perguntas para o hub apenas na carga inicial.
        // A carga inicial (fetchInitialData) deve buscar todas as perguntas ativas sem filtro de contagem.
        if (isInitialLoad && Array.isArray(perguntasData)) {
            this.totalQuestionsCountForHub = perguntasData.length;
            console.log("QUIZDATA.JS: _setQuizData - totalQuestionsCountForHub definido para:", this.totalQuestionsCountForHub);
        }

        // Considera carregado completamente se houver perguntas e categorias (opções são dependentes das perguntas)
        this.dadosCarregadosCompletamente = this.allFetchedQuestions.length > 0 && this.allCategories.length > 0;
        console.log("QUIZDATA.JS: _setQuizData - dadosCarregadosCompletamente:", this.dadosCarregadosCompletamente);
        return this.dadosCarregadosCompletamente;
    }

    /**
     * Busca os dados iniciais do quiz (todas as perguntas ativas e todas as categorias).
     * Só executa uma vez.
     * @returns {Promise<boolean>} True se os dados foram carregados com sucesso.
     * @throws {Error} Se ocorrer um erro na API.
     */
    async fetchInitialData() {
        console.log("QUIZDATA.JS: fetchInitialData - Iniciando. isInitialFetchDone:", this.isInitialFetchDone);
        if (this.isInitialFetchDone) {
            console.log("QUIZDATA.JS: fetchInitialData - Dados iniciais já buscados.");
            return true;
        }
        try {
            // Para a carga inicial, não passamos filtros para pegar todos os dados relevantes.
            console.log("QUIZDATA.JS: fetchInitialData - Chamando apiService.fetchQuizData com params: {}");
            const data = await this.apiService.fetchQuizData({}); // SEM FILTROS
            
            console.log("QUIZDATA.JS: fetchInitialData - Dados recebidos da API:", data ? "Objeto recebido" : "Nada recebido");
            if (data) {
                console.log("QUIZDATA.JS: fetchInitialData - Detalhes:",
                    { perguntas: data.perguntas?.length, categorias: data.categorias?.length, opcoes: data.opcoesResposta?.length }
                );
            }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.categorias) && Array.isArray(data.opcoesResposta)) {
                this._setQuizData(data.perguntas, data.categorias, data.opcoesResposta, true); // true para isInitialLoad
                this.isInitialFetchDone = true;
                console.log("QUIZDATA.JS: fetchInitialData - Sucesso. isInitialFetchDone = true.");
                return true;
            }
            console.warn("QUIZDATA.JS: fetchInitialData - Formato de dados da API inválido/incompleto. Resposta:", data);
            this.isInitialFetchDone = false; // Permite nova tentativa se falhar
            return false;
        } catch (error) {
            console.error("QUIZDATA.JS: fetchInitialData - ERRO CRÍTICO:", error);
            this.allFetchedQuestions = []; this.allFetchedOptions = []; this.allCategories = [];
            this.totalQuestionsCountForHub = 0; this.dadosCarregadosCompletamente = false; this.isInitialFetchDone = false;
            throw error; // Relança para ser tratado pelo App.js
        }
    }

    /**
     * Busca perguntas (e suas opções) da API com base nos filtros fornecidos.
     * @param {Object} [filterParams={}] - Parâmetros de filtro, pode incluir:
     * `category_ids`, `difficulty_levels`, `mode`, `count`, `num_questions`.
     * @returns {Promise<Array>} Array de objetos de pergunta filtrados.
     * @throws {Error} Se ocorrer um erro na API.
     */
    async fetchFilteredQuestions(filterParams = {}) {
        console.log("QUIZDATA.JS: fetchFilteredQuestions - Buscando com filtros:", filterParams);
        try {
            // O objeto filterParams é passado diretamente. O ApiService montará os query params.
            const data = await this.apiService.fetchQuizData(filterParams);
            
            console.log("QUIZDATA.JS: fetchFilteredQuestions - Dados filtrados da API:", data ? "Objeto recebido" : "Nada recebido");
             if (data) {
                console.log("QUIZDATA.JS: fetchFilteredQuestions - Detalhes:",
                    { perguntas: data.perguntas?.length, categorias: data.categorias?.length, opcoes: data.opcoesResposta?.length }
                );
            }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.opcoesResposta)) {
                // NÃO sobrescreve this.allCategories com data.categorias aqui, pois data.categorias
                // na resposta de uma busca filtrada pode não conter TODAS as categorias.
                // this.allCategories deve ter sido populado por fetchInitialData.
                this._setQuizData(data.perguntas, this.allCategories, data.opcoesResposta, false); // false para isInitialLoad
                console.log("QUIZDATA.JS: fetchFilteredQuestions - Perguntas filtradas definidas. Total:", this.allFetchedQuestions.length);
                return this.allFetchedQuestions; // Retorna as perguntas filtradas
            }
            console.warn("QUIZDATA.JS: fetchFilteredQuestions - Formato de dados da API inválido/incompleto. Resposta:", data);
            this.allFetchedQuestions = []; // Limpa em caso de dados inválidos
            this.allFetchedOptions = [];
            return []; // Retorna array vazio
        } catch (error) {
            console.error("QUIZDATA.JS: fetchFilteredQuestions - ERRO ao carregar perguntas filtradas:", error);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            throw error; // Relança o erro
        }
    }

    /**
     * Retorna uma cópia do array de perguntas atualmente carregadas (da última busca).
     * @returns {Array}
     */
    getPerguntas() {
        return [...this.allFetchedQuestions];
    }

    /**
     * Retorna o número total de perguntas da última busca realizada (seja inicial ou filtrada).
     * @returns {number}
     */
    getTotalPerguntasDisponiveisNaBuscaAtual() {
        return this.allFetchedQuestions.length;
    }

    /**
     * Retorna o número total de perguntas ativas no sistema (definido na carga inicial).
     * Usado para exibir no Challenge Hub.
     * @returns {number}
     */
    getTotalPerguntasParaHub() {
        return this.totalQuestionsCountForHub;
    }

    /**
     * Retorna uma cópia do array de todas as categorias carregadas.
     * @returns {Array}
     */
    getCategorias() {
        return [...this.allCategories];
    }

    /**
     * Organiza as categorias carregadas em uma estrutura hierárquica (árvore).
     * @returns {Array} Array de objetos de categoria raiz, cada um podendo conter 'subcategorias'.
     */
    getCategoriasHierarquicamente() {
        if (!this.allCategories?.length) return [];

        const categoriasMap = new Map();
        this.allCategories.forEach(cat => {
            categoriasMap.set(cat.id_categoria, { ...cat, subcategorias: [] });
        });

        const categoriasRaiz = [];
        categoriasMap.forEach(node => {
            if (node.id_categoria_pai === null || !categoriasMap.has(node.id_categoria_pai)) {
                categoriasRaiz.push(node);
            } else {
                const parentNode = categoriasMap.get(node.id_categoria_pai);
                if (parentNode) parentNode.subcategorias.push(node);
                else categoriasRaiz.push(node); // Trata órfão como raiz
            }
        });

        const sortRecursive = (nodes) => {
            nodes.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria, undefined, { sensitivity: 'base' }));
            nodes.forEach(node => {
                if (node.subcategorias.length > 0) sortRecursive(node.subcategorias);
            });
        };
        sortRecursive(categoriasRaiz);
        return categoriasRaiz;
    }

    /**
     * Retorna as opções de resposta para um ID de pergunta específico, ordenadas.
     * @param {number} idPergunta - O ID da pergunta.
     * @returns {Array} Array de objetos de opção de resposta.
     */
    getOpcoesPorPerguntaId(idPergunta) {
        return this.allFetchedOptions
            .filter(op => op.id_pergunta === idPergunta)
            .sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    }

    /**
     * (Não usado atualmente, mas pode ser útil)
     * Retorna um array de objetos representando a relação entre perguntas e suas categorias.
     * @returns {Array} Ex: [{id_pergunta: 1, id_categoria: 5}, ...]
     */
    getRelacaoPerguntaCategorias() {
        const relacao = [];
        this.allFetchedQuestions.forEach(pergunta => {
            pergunta.categoria_ids?.forEach(catId => {
                if (this.allCategories.some(cat => cat.id_categoria === catId)) {
                    relacao.push({ id_pergunta: pergunta.id_pergunta, id_categoria: catId });
                }
            });
        });
        return relacao;
    }
}