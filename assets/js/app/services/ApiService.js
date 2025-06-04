// File: assets/js/app/services/ApiService.js

import { API_URLS } from '../../utils/constants.js';
import { getCookie } from '../../utils/helpers.js';

/**
 * Função interna para realizar requisições à API.
 * (Esta função _request permanece a mesma do seu arquivo original,
 * pois ela já é genérica o suficiente para as novas necessidades.)
 */
async function _request(endpoint, method = 'GET', body = null, queryParams = null) {
    const url = new URL(endpoint, window.location.origin);

    if (queryParams) {
        Object.keys(queryParams).forEach(key => {
            const paramValue = queryParams[key];
            if (paramValue !== undefined && paramValue !== null && paramValue.toString().trim() !== '') {
                if (Array.isArray(paramValue)) {
                    paramValue.forEach(value => {
                        if (value.toString().trim() !== '') {
                            url.searchParams.append(key, value.toString());
                        }
                    });
                } else {
                    url.searchParams.append(key, paramValue.toString());
                }
            }
        });
    }

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'), // Essencial para requisições POST, PUT, DELETE no Django
        },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);
        // Respostas 204 (No Content) não têm corpo JSON, então evitamos erro de parsing.
        const responseData = response.status !== 204 ? await response.json().catch(() => null) : null;

        if (!response.ok) {
            const errorMessage = responseData?.message || responseData?.detail || `API Error: ${response.status} ${response.statusText}`;
            const error = new Error(errorMessage);
            error.response = response; // Anexa a resposta completa ao erro
            error.data = responseData; // Anexa os dados da resposta (se houver) ao erro
            throw error;
        }
        return responseData;
    } catch (error) {
        // Se o erro não tiver uma 'response' (ex: erro de rede, CORS), ele é relançado como está.
        // Se tiver, já foi enriquecido acima.
        if (!error.response) {
            // console.error(`ApiService Network/Request Error (${method} ${url.pathname}):`, error.message, error);
        }
        throw error; // Relança para ser tratado pelo chamador
    }
}

export default class ApiService {
    /**
     * Busca dados de perguntas para um novo quiz.
     * @param {Object} filterParams - Parâmetros de filtro.
     * @param {string[]} [filterParams.category_ids]
     * @param {string[]} [filterParams.difficulty_levels]
     * @param {string} [filterParams.mode] - 'quick', 'category', 'defined'
     * @param {number} [filterParams.count] - Para modo 'quick'
     * @param {number} [filterParams.num_questions] - Para modo personalizado
     * @param {number} [filterParams.quiz_definicao_id] - Para carregar um quiz pré-definido
     * @returns {Promise<Object|null>}
     */
    async fetchQuizData(filterParams = {}) {
        const queryParams = {};
        if (filterParams.category_ids?.length > 0) {
            queryParams.category_ids = filterParams.category_ids.join(',');
        }
        if (filterParams.difficulty_levels?.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            queryParams.difficulty_levels = filterParams.difficulty_levels.join(',');
        }
        // Para quiz_definicao_id, o backend em views.py já define o modo como 'Definido'
        if (filterParams.quiz_definicao_id) {
            queryParams.quiz_definicao_id = filterParams.quiz_definicao_id;
        } else if (filterParams.mode === 'quick') { // Só adiciona modo e count se não for quiz_definicao
            queryParams.mode = filterParams.mode;
            if (filterParams.count && Number.isInteger(filterParams.count) && filterParams.count > 0) {
                queryParams.count = filterParams.count;
            }
        } else if (filterParams.num_questions && Number.isInteger(filterParams.num_questions) && filterParams.num_questions > 0) {
            queryParams.num_questions = filterParams.num_questions;
        }
        return _request(API_URLS.api_get_quiz_data, 'GET', null, queryParams);
    }

    /**
     * Inicia uma nova sessão de quiz.
     * @param {Object} sessionData
     * @param {string} sessionData.modo_quiz - 'Rápido', 'Por Categoria', 'Definido'
     * @param {number[]} sessionData.question_ids_in_session - IDs das perguntas para a sessão
     * @param {number} [sessionData.quiz_definicao_id] - Opcional, se modo_quiz for 'Definido'
     * @param {string[]} [sessionData.categoria_ids] - Opcional, se modo_quiz for 'Por Categoria'
     * @param {string[]} [sessionData.dificuldades_selecionadas] - Filtro de dificuldade usado
     * @param {number} [sessionData.num_questoes_solicitadas] - Número de questões que o usuário pediu
     * @returns {Promise<Object|null>}
     */
    async startQuizSession(sessionData) {
        // O backend espera: modo_quiz, categoria_ids, question_ids_in_session, quiz_definicao_id
        // dificuldades_selecionadas, num_questoes_solicitadas
        return _request(API_URLS.start_quiz_session, 'POST', sessionData);
    }

    /**
     * Registra a resposta do usuário para uma pergunta.
     * @param {Object} answerData
     * @param {number} answerData.session_id
     * @param {number} answerData.pergunta_id
     * @param {number|null} answerData.opcao_id - ID da opção selecionada, ou null se pulada
     * @param {number} answerData.current_question_index - Índice da pergunta atual na sessão
     * @returns {Promise<Object|null>}
     */
    async registerAnswer(answerData) {
        // O backend espera: session_id, pergunta_id, opcao_id, current_question_index
        return _request(API_URLS.register_answer, 'POST', answerData);
    }

    /**
     * Finaliza uma sessão de quiz.
     * @param {Object} sessionEndData
     * @param {number} sessionEndData.session_id
     * @param {number} sessionEndData.tempo_total_segundos
     * @returns {Promise<Object|null>}
     */
    async endQuizSession(sessionEndData) {
        return _request(API_URLS.end_quiz_session, 'POST', sessionEndData);
    }

    async toggleFavoriteStatus(perguntaId) {
        const endpoint = API_URLS.toggle_favorite_status(perguntaId);
        return _request(endpoint, 'POST', {}); // Corpo vazio, apenas toggle
    }

    async getFavoriteQuestions() {
        return _request(API_URLS.get_favorite_questions, 'GET');
    }

    async fetchUserStatistics(period = '30d') {
        const queryParams = { period };
        if (!API_URLS.api_get_user_statistics) {
            // console.error("ApiService: URL para api_get_user_statistics não definida em API_URLS.");
            throw new Error("URL de estatísticas do usuário não configurada.");
        }
        return _request(API_URLS.api_get_user_statistics, 'GET', null, queryParams);
    }

    /**
     * NOVO MÉTODO: Busca dados de uma sessão de quiz em andamento para retomá-la.
     * Não precisa de parâmetros, pois o backend identificará a sessão pelo usuário logado.
     * @returns {Promise<Object|null>} Dados da sessão para retomar.
     */
    async resumeQuizSession() {
        if (!API_URLS.api_resume_quiz_session) {
            // console.error("ApiService: URL para api_resume_quiz_session não definida em API_URLS.");
            throw new Error("URL para retomar sessão de quiz não configurada.");
        }
        return _request(API_URLS.api_resume_quiz_session, 'GET');
    }
}