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
        if (isInitialLoad || this.allCategories.length === 0) {
            this.allCategories = Array.isArray(categoriasData) ? categoriasData : [];
            console.log("QUIZDATA.JS: _setQuizData - Todas as categorias carregadas/atualizadas:",
                this.allCategories.length, "categorias.",
                this.allCategories.length > 0 ? `Amostra: ${JSON.stringify(this.allCategories.slice(0, 1))}` : "Array vazio"
            );
        }

        // Define o total de perguntas para o hub apenas na carga inicial.
        if (isInitialLoad && Array.isArray(perguntasData)) {
            this.totalQuestionsCountForHub = perguntasData.length;
            console.log("QUIZDATA.JS: _setQuizData - totalQuestionsCountForHub definido para:", this.totalQuestionsCountForHub);
        }

        this.dadosCarregadosCompletamente = this.allFetchedQuestions.length > 0 && this.allCategories.length > 0;
        console.log("QUIZDATA.JS: _setQuizData - dadosCarregadosCompletamente:", this.dadosCarregadosCompletamente);
        return this.dadosCarregadosCompletamente;
    }

    /**
     * Busca os dados iniciais do quiz (todas as perguntas ativas e todas as categorias).
     * Só executa uma vez.
     * O backend já usa request.user para determinar o status de favorito.
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
            // O backend (api_get_quiz_data_view) usará request.user para adicionar 'is_favorited'.
            console.log("QUIZDATA.JS: fetchInitialData - Chamando apiService.fetchQuizData com params: {}");
            const data = await this.apiService.fetchQuizData({}); // SEM FILTROS explícitos aqui.
            
            console.log("QUIZDATA.JS: fetchInitialData - Dados recebidos da API:", data ? "Objeto recebido" : "Nada recebido");
            if (data) {
                console.log("QUIZDATA.JS: fetchInitialData - Detalhes:",
                    { 
                        perguntas: data.perguntas?.length, 
                        categorias: data.categorias?.length, 
                        opcoes: data.opcoesResposta?.length,
                        primeiraPerguntaExemplo: data.perguntas?.[0] // Para verificar se 'is_favorited' está vindo
                    }
                );
            }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.categorias) && Array.isArray(data.opcoesResposta)) {
                this._setQuizData(data.perguntas, data.categorias, data.opcoesResposta, true); // true para isInitialLoad
                this.isInitialFetchDone = true;
                console.log("QUIZDATA.JS: fetchInitialData - Sucesso. isInitialFetchDone = true.");
                return true;
            }
            console.warn("QUIZDATA.JS: fetchInitialData - Formato de dados da API inválido/incompleto. Resposta:", data);
            this.isInitialFetchDone = false;
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
     * @param {Object} [filterParams={}] - Parâmetros de filtro.
     * @returns {Promise<Array>} Array de objetos de pergunta filtrados.
     * @throws {Error} Se ocorrer um erro na API.
     */
    async fetchFilteredQuestions(filterParams = {}) {
        console.log("QUIZDATA.JS: fetchFilteredQuestions - Buscando com filtros:", filterParams);
        try {
            // O ApiService.fetchQuizData já não precisa mais do 'user' explicitamente,
            // pois o backend (views.py) usa request.user.
            const data = await this.apiService.fetchQuizData(filterParams);
            
            console.log("QUIZDATA.JS: fetchFilteredQuestions - Dados filtrados da API:", data ? "Objeto recebido" : "Nada recebido");
             if (data) {
                console.log("QUIZDATA.JS: fetchFilteredQuestions - Detalhes:",
                    { 
                        perguntas: data.perguntas?.length, 
                        categorias: data.categorias?.length, // Categorias aqui podem ser um subconjunto
                        opcoes: data.opcoesResposta?.length,
                        primeiraPerguntaFiltradaExemplo: data.perguntas?.[0]
                    }
                );
            }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.opcoesResposta)) {
                // NÃO sobrescreve this.allCategories com data.categorias aqui,
                // pois data.categorias na resposta de uma busca filtrada pode não conter TODAS as categorias.
                // this.allCategories deve ter sido populado por fetchInitialData.
                // data.categorias retornado aqui pode ser usado se você precisar de um subconjunto relevante aos filtros.
                this._setQuizData(data.perguntas, this.allCategories, data.opcoesResposta, false);
                console.log("QUIZDATA.JS: fetchFilteredQuestions - Perguntas filtradas definidas. Total:", this.allFetchedQuestions.length);
                return this.allFetchedQuestions;
            }
            console.warn("QUIZDATA.JS: fetchFilteredQuestions - Formato de dados da API inválido/incompleto. Resposta:", data);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            return [];
        } catch (error) {
            console.error("QUIZDATA.JS: fetchFilteredQuestions - ERRO ao carregar perguntas filtradas:", error);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            throw error;
        }
    }

    /**
     * Retorna uma cópia do array de perguntas atualmente carregadas.
     * @returns {Array}
     */
    getPerguntas() {
        return [...this.allFetchedQuestions];
    }

    /**
     * Retorna o número total de perguntas da última busca realizada.
     * @returns {number}
     */
    getTotalPerguntasDisponiveisNaBuscaAtual() {
        return this.allFetchedQuestions.length;
    }

    /**
     * Retorna o número total de perguntas ativas no sistema (definido na carga inicial).
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
     * @returns {Array} Array de objetos de categoria raiz.
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