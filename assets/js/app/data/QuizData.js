// File: assets/js/app/data/QuizData.js

export default class QuizData {
    constructor(apiService) {
        console.log("QUIZDATA.JS: Constructor - Instância criada. ApiService:", apiService);
        this.apiService = apiService; // Injeção de dependência do ApiService

        this.allFetchedQuestions = [];
        this.allFetchedOptions = [];
        this.allCategories = [];
        this.dadosCarregadosCompletamente = false;
        this.totalQuestionsCountForHub = 0; // Para o display no hub e na home
        this.isInitialFetchDone = false;
    }

    _setQuizData(perguntasData, categoriasData, opcoesData, isInitialLoad = false) {
        console.log("QUIZDATA.JS: _setQuizData - Definindo dados. É carregamento inicial:", isInitialLoad);
        this.allFetchedQuestions = Array.isArray(perguntasData) ? perguntasData : [];
        this.allFetchedOptions = Array.isArray(opcoesData) ? opcoesData : [];

        if (isInitialLoad || this.allCategories.length === 0) {
            this.allCategories = Array.isArray(categoriasData) ? categoriasData : [];
            // Usando JSON.parse(JSON.stringify(...)) para um log "profundo" de cópia, útil para arrays de objetos.
            console.log("QUIZDATA.JS: _setQuizData - Categorias carregadas/atualizadas (this.allCategories):",
                this.allCategories.length, "categorias.",
                this.allCategories.length > 0 ? JSON.parse(JSON.stringify(this.allCategories.slice(0, 5))) : "Array vazio" // Loga as primeiras 5 para não poluir
            );
        }

        if (isInitialLoad && this.allFetchedQuestions.length > 0) {
            this.totalQuestionsCountForHub = this.allFetchedQuestions.length;
            console.log("QUIZDATA.JS: _setQuizData - totalQuestionsCountForHub definido para:", this.totalQuestionsCountForHub);
        }

        this.dadosCarregadosCompletamente = this.allFetchedQuestions.length > 0 && this.allCategories.length > 0;
        console.log("QUIZDATA.JS: _setQuizData - dadosCarregadosCompletamente:", this.dadosCarregadosCompletamente);
        return this.dadosCarregadosCompletamente;
    }

    async fetchInitialData() {
        console.log("QUIZDATA.JS: fetchInitialData - Iniciando busca de dados iniciais. isInitialFetchDone:", this.isInitialFetchDone);
        if (this.isInitialFetchDone) {
            console.log("QUIZDATA.JS: fetchInitialData - Dados iniciais já buscados anteriormente.");
            return true;
        }
        try {
            console.log("QUIZDATA.JS: fetchInitialData - Chamando apiService.fetchQuizData com params: {}");
            const data = await this.apiService.fetchQuizData({}); // NENHUM FILTRO para pegar tudo de início
            console.log("QUIZDATA.JS: fetchInitialData - Dados recebidos da API:", data ? "Objeto recebido" : "Nada recebido (null/undefined)");
            if (data) {
                console.log("QUIZDATA.JS: fetchInitialData - Detalhes dos dados recebidos:",
                    { perguntas: data.perguntas?.length, categorias: data.categorias?.length, opcoesResposta: data.opcoesResposta?.length }
                );
            }


            if (data && Array.isArray(data.perguntas) && Array.isArray(data.categorias) && Array.isArray(data.opcoesResposta)) {
                console.log("QUIZDATA.JS: fetchInitialData - Formato dos dados da API é VÁLIDO (chaves e arrays).");
                this._setQuizData(data.perguntas, data.categorias, data.opcoesResposta, true); // true para isInitialLoad
                this.isInitialFetchDone = true;
                console.log("QUIZDATA.JS: fetchInitialData - Dados iniciais definidos e isInitialFetchDone = true. Retornando true.");
                return true;
            }
            console.warn("QUIZDATA.JS: fetchInitialData - Formato dos dados da API é INVÁLIDO ou incompleto. Resposta da API:", data);
            this.isInitialFetchDone = false; // Garante que possa tentar novamente se falhar
            return false;
        } catch (error) {
            console.error("QUIZDATA.JS: fetchInitialData - ERRO CRÍTICO ao carregar dados iniciais:", error);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            // Não reseta categorias se o objetivo é mantê-las se já carregadas, mas para initialData, é melhor limpar.
            // this.allCategories = []; // Descomente se quiser limpar categorias em caso de erro total aqui.
            this.totalQuestionsCountForHub = 0;
            this.dadosCarregadosCompletamente = false;
            this.isInitialFetchDone = false;
            throw error;
        }
    }

    async fetchFilteredQuestions(filterParams = {}) {
        console.log("QUIZDATA.JS: fetchFilteredQuestions - Buscando perguntas filtradas. Filtros:", filterParams);
        try {
            const data = await this.apiService.fetchQuizData(filterParams);
            console.log("QUIZDATA.JS: fetchFilteredQuestions - Dados filtrados recebidos da API:", data ? "Objeto recebido" : "Nada recebido");
             if (data) {
                console.log("QUIZDATA.JS: fetchFilteredQuestions - Detalhes dos dados filtrados:",
                    { perguntas: data.perguntas?.length, categorias: data.categorias?.length, opcoesResposta: data.opcoesResposta?.length }
                );
            }

            if (data && Array.isArray(data.perguntas) && Array.isArray(data.opcoesResposta)) {
                // Preserva this.allCategories se já carregadas, pois este endpoint pode não retornar todas as categorias.
                console.log("QUIZDATA.JS: fetchFilteredQuestions - Formato dos dados filtrados é VÁLIDO.");
                this._setQuizData(data.perguntas, this.allCategories, data.opcoesResposta, false); // false para isInitialLoad
                return this.allFetchedQuestions;
            }
            console.warn("QUIZDATA.JS: fetchFilteredQuestions - Formato dos dados filtrados da API é INVÁLIDO ou incompleto.");
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            return []; // Retorna array vazio se a estrutura for inválida
        } catch (error) {
            console.error("QUIZDATA.JS: fetchFilteredQuestions - ERRO ao carregar perguntas filtradas:", error);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            throw error;
        }
    }

    getPerguntas() {
        // console.log("QUIZDATA.JS: getPerguntas - Retornando cópia de allFetchedQuestions:", this.allFetchedQuestions.length, "perguntas.");
        return [...this.allFetchedQuestions];
    }

    getTotalPerguntasDisponiveis() {
        // console.log("QUIZDATA.JS: getTotalPerguntasDisponiveis - Total na última busca:", this.allFetchedQuestions.length);
        return this.allFetchedQuestions.length;
    }

    getTotalPerguntasParaHub() {
        // console.log("QUIZDATA.JS: getTotalPerguntasParaHub - Contagem total inicial:", this.totalQuestionsCountForHub);
        return this.totalQuestionsCountForHub;
    }

    getCategorias() {
        // console.log("QUIZDATA.JS: getCategorias - Retornando cópia de allCategories:", this.allCategories.length, "categorias.");
        return [...this.allCategories];
    }

    getCategoriasHierarquicamente() {
        console.log("QUIZDATA.JS: getCategoriasHierarquicamente - Iniciando. Total de categorias planas:", this.allCategories.length);
        // Log das primeiras 3 categorias planas para inspeção
        // if (this.allCategories.length > 0) {
        //     console.log("QUIZDATA.JS: getCategoriasHierarquicamente - Amostra de categorias planas (primeiras 3):", JSON.parse(JSON.stringify(this.allCategories.slice(0,3))));
        // }

        if (!this.allCategories || this.allCategories.length === 0) {
            console.warn("QUIZDATA.JS: getCategoriasHierarquicamente - Nenhuma categoria para processar em estrutura hierárquica.");
            return [];
        }

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
                // Verifica se o pai realmente existe no Map para evitar erros
                if (parentNode) {
                    parentNode.subcategorias.push(node);
                } else {
                    // Isso pode acontecer se um id_categoria_pai aponta para uma categoria inexistente
                    console.warn(`QUIZDATA.JS: getCategoriasHierarquicamente - Categoria pai ID ${node.id_categoria_pai} não encontrada para a categoria ID ${node.id_categoria}. Adicionando como raiz.`);
                    categoriasRaiz.push(node); // Trata como raiz se o pai não for encontrado
                }
            }
        });

        const sortRecursive = (nodes) => {
            nodes.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria));
            nodes.forEach(node => {
                if (node.subcategorias.length > 0) {
                    sortRecursive(node.subcategorias);
                }
            });
        };
        sortRecursive(categoriasRaiz);

        console.log("QUIZDATA.JS: getCategoriasHierarquicamente - Estrutura hierárquica gerada. Número de categorias raiz:", categoriasRaiz.length);
        // if (categoriasRaiz.length > 0) {
        //     console.log("QUIZDATA.JS: getCategoriasHierarquicamente - Amostra da estrutura hierárquica (primeira raiz):", JSON.parse(JSON.stringify(categoriasRaiz[0])));
        // }
        return categoriasRaiz;
    }


    getOpcoesPorPerguntaId(idPergunta) {
        const opcoesFiltradas = this.allFetchedOptions
            .filter(op => op.id_pergunta === idPergunta)
            .sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
        // console.log(`QUIZDATA.JS: getOpcoesPorPerguntaId - Opções para pergunta ID ${idPergunta}:`, opcoesFiltradas.length, "opções encontradas.");
        return opcoesFiltradas;
    }

    getRelacaoPerguntaCategorias() {
        // console.log("QUIZDATA.JS: getRelacaoPerguntaCategorias - Construindo relação pergunta-categorias.");
        const relacao = [];
        this.allFetchedQuestions.forEach(pergunta => {
            if (pergunta.categoria_ids && Array.isArray(pergunta.categoria_ids)) {
                pergunta.categoria_ids.forEach(catId => {
                    if (this.allCategories.some(cat => cat.id_categoria === catId)) {
                        relacao.push({ id_pergunta: pergunta.id_pergunta, id_categoria: catId });
                    }
                });
            }
        });
        // console.log("QUIZDATA.JS: getRelacaoPerguntaCategorias - Relação construída:", relacao.length, "entradas.");
        return relacao;
    }
}