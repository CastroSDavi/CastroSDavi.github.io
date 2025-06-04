// File: assets/js/app/data/QuizData.js

export default class QuizData {
    constructor(apiService) {
        // console.log("QUIZDATA.JS: Constructor - Instância criada. ApiService:", apiService ? "Presente" : "AUSENTE");
        this.apiService = apiService;

        this.allFetchedQuestions = [];
        this.allFetchedOptions = [];
        this.allCategories = [];

        this.dadosCarregadosCompletamente = false;
        this.totalQuestionsCountForHub = 0;
        this.isInitialFetchDone = false;
        this.lastFetchedQuizDefinitionName = null; // NOVO: Para armazenar o nome do quiz definido
    }

    _setQuizData(perguntasData, categoriasData, opcoesData, isInitialLoad = false, quizDefinitionName = null) {
        // console.log("QUIZDATA.JS: _setQuizData - Definindo dados. É carregamento inicial:", isInitialLoad, "Nome QuizDef:", quizDefinitionName);
        this.allFetchedQuestions = Array.isArray(perguntasData) ? perguntasData : [];
        this.allFetchedOptions = Array.isArray(opcoesData) ? opcoesData : [];

        if (isInitialLoad || this.allCategories.length === 0) {
            this.allCategories = Array.isArray(categoriasData) ? categoriasData : [];
            // console.log("QUIZDATA.JS: _setQuizData - Todas as categorias carregadas/atualizadas:",
            //     this.allCategories.length, "categorias.",
            //     this.allCategories.length > 0 ? `Amostra: ${JSON.stringify(this.allCategories.slice(0, 1))}` : "Array vazio"
            // );
        }

        if (isInitialLoad && Array.isArray(perguntasData)) {
            this.totalQuestionsCountForHub = perguntasData.length;
            // console.log("QUIZDATA.JS: _setQuizData - totalQuestionsCountForHub definido para:", this.totalQuestionsCountForHub);
        }

        // Armazena o nome do quiz definido, se fornecido
        this.lastFetchedQuizDefinitionName = quizDefinitionName;
        if(quizDefinitionName){
            // console.log("QUIZDATA.JS: _setQuizData - lastFetchedQuizDefinitionName definido para:", this.lastFetchedQuizDefinitionName);
        }


        this.dadosCarregadosCompletamente = this.allFetchedQuestions.length > 0 && this.allCategories.length > 0;
        // console.log("QUIZDATA.JS: _setQuizData - dadosCarregadosCompletamente:", this.dadosCarregadosCompletamente);
        return this.dadosCarregadosCompletamente;
    }

    async fetchInitialData() {
        // console.log("QUIZDATA.JS: fetchInitialData - Iniciando. isInitialFetchDone:", this.isInitialFetchDone);
        if (this.isInitialFetchDone) {
            // console.log("QUIZDATA.JS: fetchInitialData - Dados iniciais já buscados.");
            return true;
        }
        try {
            // console.log("QUIZDATA.JS: fetchInitialData - Chamando apiService.fetchQuizData com params: {}");
            const data = await this.apiService.fetchQuizData({}); // data aqui é o objeto completo da API

            // console.log("QUIZDATA.JS: fetchInitialData - Dados recebidos da API:", data ? "Objeto recebido" : "Nada recebido");
            // if (data) {
            //     console.log("QUIZDATA.JS: fetchInitialData - Detalhes:",
            //         {
            //             perguntas: data.perguntas?.length,
            //             categorias: data.categorias?.length,
            //             opcoes: data.opcoesResposta?.length,
            //             quizDefName: data.quiz_definition_name, // Verificar se vem aqui
            //             primeiraPerguntaExemplo: data.perguntas?.[0]
            //         }
            //     );
            // }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.categorias) && Array.isArray(data.opcoesResposta)) {
                // quiz_definition_name será null/undefined aqui, pois é uma busca inicial sem ID de quiz definido
                this._setQuizData(data.perguntas, data.categorias, data.opcoesResposta, true, data.quiz_definition_name);
                this.isInitialFetchDone = true;
                // console.log("QUIZDATA.JS: fetchInitialData - Sucesso. isInitialFetchDone = true.");
                return true;
            }
            // console.warn("QUIZDATA.JS: fetchInitialData - Formato de dados da API inválido/incompleto. Resposta:", data);
            this.isInitialFetchDone = false;
            return false;
        } catch (error) {
            // console.error("QUIZDATA.JS: fetchInitialData - ERRO CRÍTICO:", error, error.stack);
            this.allFetchedQuestions = []; this.allFetchedOptions = []; this.allCategories = [];
            this.totalQuestionsCountForHub = 0; this.dadosCarregadosCompletamente = false; this.isInitialFetchDone = false;
            this.lastFetchedQuizDefinitionName = null;
            throw error;
        }
    }

    async fetchFilteredQuestions(filterParams = {}) {
        // console.log("QUIZDATA.JS: fetchFilteredQuestions - Buscando com filtros:", JSON.stringify(filterParams));
        if (!this.apiService) {
            // console.error("QUIZDATA.JS: fetchFilteredQuestions - ApiService não está definido!");
            throw new Error("ApiService não configurado em QuizData.");
        }
        try {
            const data = await this.apiService.fetchQuizData(filterParams); // data é o objeto completo da API

            // console.log("QUIZDATA.JS: fetchFilteredQuestions - Dados filtrados da API:", data ? "Objeto recebido" : "Nada recebido");
            //  if (data) {
            //     console.log("QUIZDATA.JS: fetchFilteredQuestions - Detalhes:",
            //         {
            //             perguntas: data.perguntas?.length,
            //             categorias: data.categorias?.length,
            //             opcoes: data.opcoesResposta?.length,
            //             quizDefName: data.quiz_definition_name, // Nome do quiz definido, se houver
            //             primeiraPerguntaFiltradaExemplo: data.perguntas?.[0]
            //         }
            //     );
            // }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.opcoesResposta)) {
                // Passa data.categorias (que são todas as categorias) e data.quiz_definition_name
                this._setQuizData(data.perguntas, data.categorias, data.opcoesResposta, false, data.quiz_definition_name);
                // console.log("QUIZDATA.JS: fetchFilteredQuestions - Perguntas filtradas definidas. Total:", this.allFetchedQuestions.length);
                return data.perguntas; // Retorna APENAS o array de perguntas para QuizLogic
            }
            // console.warn("QUIZDATA.JS: fetchFilteredQuestions - Formato de dados da API inválido/incompleto. Resposta:", data);
            this.allFetchedQuestions = []; 
            this.allFetchedOptions = [];   
            this.lastFetchedQuizDefinitionName = null;
            return []; 
        } catch (error) {
            // console.error("QUIZDATA.JS: fetchFilteredQuestions - ERRO ao carregar perguntas filtradas:", error, error.stack);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            this.lastFetchedQuizDefinitionName = null;
            throw error; 
        }
    }

    // NOVO GETTER
    getLastFetchedQuizDefinitionName() {
        return this.lastFetchedQuizDefinitionName;
    }

    getPerguntas() {
        return [...this.allFetchedQuestions];
    }

    getTotalPerguntasDisponiveisNaBuscaAtual() {
        return this.allFetchedQuestions.length;
    }

    getTotalPerguntasParaHub() {
        return this.totalQuestionsCountForHub;
    }

    getCategorias() {
        return [...this.allCategories];
    }

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
                else categoriasRaiz.push(node); 
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

    getOpcoesPorPerguntaId(idPergunta) {
        return this.allFetchedOptions
            .filter(op => op.id_pergunta === idPergunta)
            .sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
    }

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