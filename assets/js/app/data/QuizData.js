// File: assets/js/app/data/QuizData.js

export default class QuizData {
    constructor(apiService) {
        this.apiService = apiService; // Injeção de dependência do ApiService

        this.allFetchedQuestions = [];
        this.allFetchedOptions = [];
        this.allCategories = [];
        this.dadosCarregadosCompletamente = false;
        this.totalQuestionsCountForHub = 0; // Para o display no hub e na home
        this.isInitialFetchDone = false;
    }

    _setQuizData(perguntasData, categoriasData, opcoesData, isInitialLoad = false) {
        this.allFetchedQuestions = Array.isArray(perguntasData) ? perguntasData : [];
        this.allFetchedOptions = Array.isArray(opcoesData) ? opcoesData : [];

        if (isInitialLoad || this.allCategories.length === 0) {
            this.allCategories = Array.isArray(categoriasData) ? categoriasData : [];
        }

        // Se for o carregamento inicial (sem filtros), define a contagem total para o hub.
        // Isso assume que a primeira chamada sem filtros retorna todas as perguntas ativas.
        if (isInitialLoad && this.allFetchedQuestions.length > 0) {
            this.totalQuestionsCountForHub = this.allFetchedQuestions.length;
        }

        this.dadosCarregadosCompletamente = this.allFetchedQuestions.length > 0 && this.allCategories.length > 0;
        return this.dadosCarregadosCompletamente;
    }

    async fetchInitialData() {
        // Este método é chamado uma vez para carregar categorias e a contagem total de perguntas.
        // A chamada é feita sem filtros específicos para obter todos os dados relevantes.
        if (this.isInitialFetchDone) {
            return true; // Evita buscar dados iniciais repetidamente
        }
        try {
            // Passa um objeto vazio como filterParams para buscar todos os dados para o setup inicial
            const data = await this.apiService.fetchQuizData({});
            if (data && data.perguntas && data.categorias && data.opcoesResposta) {
                this._setQuizData(data.perguntas, data.categorias, data.opcoesResposta, true);
                this.isInitialFetchDone = true;
                return true;
            }
            console.warn("QuizData: Formato de dados iniciais inválido recebido da API.");
            return false;
        } catch (error) {
            console.error("QuizData: Erro CRÍTICO ao carregar dados iniciais:", error);
            // Em caso de erro, reseta os dados para um estado seguro.
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            // Não reseta categorias se elas já foram carregadas em uma tentativa anterior bem-sucedida.
            // No entanto, para fetchInitialData, se falhar, é melhor limpar tudo relacionado a perguntas.
            this.totalQuestionsCountForHub = 0;
            this.dadosCarregadosCompletamente = false;
            this.isInitialFetchDone = false; // Permite nova tentativa
            throw error; // Re-lança para que App.js possa tratar
        }
    }

    async fetchFilteredQuestions(filterParams = {}) {
        // Este método busca perguntas com base nos filtros fornecidos.
        // Não define isInitialLoad como true, pois é para filtragem.
        try {
            const data = await this.apiService.fetchQuizData(filterParams);
            if (data && data.perguntas && data.opcoesResposta) {
                // Atualiza perguntas e opções, mas mantém as categorias já carregadas.
                this._setQuizData(data.perguntas, this.allCategories, data.opcoesResposta, false);
                return this.allFetchedQuestions; // Retorna as perguntas filtradas
            }
            console.warn("QuizData: Formato de dados filtrados inválido recebido da API.");
            this.allFetchedQuestions = []; // Limpa perguntas se a busca falhar
            this.allFetchedOptions = [];
            return [];
        } catch (error) {
            console.error("QuizData: Erro ao carregar perguntas filtradas:", error);
            this.allFetchedQuestions = [];
            this.allFetchedOptions = [];
            throw error;
        }
    }

    getPerguntas() {
        return [...this.allFetchedQuestions]; // Retorna uma cópia para evitar mutação externa
    }

    getTotalPerguntasDisponiveis() {
        // Retorna o total de perguntas carregadas na última busca (pode ser filtrado)
        return this.allFetchedQuestions.length;
    }

    getTotalPerguntasParaHub() {
        // Retorna a contagem total de perguntas obtida no carregamento inicial
        return this.totalQuestionsCountForHub;
    }

    getCategorias() {
        return [...this.allCategories];
    }

    getCategoriasHierarquicamente() {
        if (!this.allCategories || this.allCategories.length === 0) return [];

        const categoriasMap = new Map(
            this.allCategories.map(cat => [cat.id_categoria, { ...cat, subcategorias: [] }])
        );
        const categoriasRaiz = [];

        categoriasMap.forEach(node => {
            if (node.id_categoria_pai === null || !categoriasMap.has(node.id_categoria_pai)) {
                categoriasRaiz.push(node);
            } else {
                const parentNode = categoriasMap.get(node.id_categoria_pai);
                if (parentNode) {
                    parentNode.subcategorias.push(node);
                }
            }
        });

        // Função para ordenar recursivamente
        const sortRecursive = (nodes) => {
            nodes.sort((a, b) => a.nome_categoria.localeCompare(b.nome_categoria));
            nodes.forEach(node => {
                if (node.subcategorias.length > 0) {
                    sortRecursive(node.subcategorias);
                }
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

    // Necessário para exibir o título da categoria na UI da pergunta
    getRelacaoPerguntaCategorias() {
        const relacao = [];
        this.allFetchedQuestions.forEach(pergunta => {
            if (pergunta.categoria_ids && Array.isArray(pergunta.categoria_ids)) {
                pergunta.categoria_ids.forEach(catId => {
                    // Verifica se a categoria existe na lista de todas as categorias
                    if (this.allCategories.some(cat => cat.id_categoria === catId)) {
                        relacao.push({ id_pergunta: pergunta.id_pergunta, id_categoria: catId });
                    }
                });
            }
        });
        return relacao;
    }
}