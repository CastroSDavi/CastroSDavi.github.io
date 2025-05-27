// File: assets/js/app/services/ApiService.js

import { API_URLS } from '../../utils/constants.js';
import { getCookie } from '../../utils/helpers.js';

/**
 * Função interna para realizar requisições à API.
 * @param {string} endpoint - O caminho do endpoint da API (ex: API_URLS.api_get_quiz_data).
 * @param {string} [method='GET'] - O método HTTP (GET, POST, PUT, DELETE, etc.).
 * @param {Object|null} [body=null] - O corpo da requisição para métodos como POST, PUT.
 * @param {Object|null} [queryParams=null] - Um objeto com parâmetros de query para a URL.
 * @returns {Promise<Object|null>} Uma promessa que resolve com os dados da resposta JSON, ou null.
 * @throws {Error} Lança um erro se a resposta da API não for 'ok' ou se houver erro de rede.
 */
async function _request(endpoint, method = 'GET', body = null, queryParams = null) {
    const url = new URL(endpoint, window.location.origin); // Constrói a URL completa

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
            'X-CSRFToken': getCookie('csrftoken'),
        },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    try {
        // console.log(`ApiService: Enviando ${method} para ${url.toString()}`, options.body ? `corpo: ${options.body}` : '');
        const response = await fetch(url.toString(), options);
        const responseData = response.status !== 204 ? await response.json().catch(() => null) : null;

        if (!response.ok) {
            const errorMessage = responseData?.message || responseData?.detail || `API Error: ${response.status} ${response.statusText}`;
            // console.error(`ApiService Error (${method} ${url.pathname}): Status ${response.status}`, responseData || response.statusText);
            const error = new Error(errorMessage);
            error.response = response;
            error.data = responseData;
            throw error;
        }
        // console.log(`ApiService: Resposta de ${method} ${url.pathname}:`, responseData);
        return responseData;
    } catch (error) {
        if (!error.response) {
            // console.error(`ApiService Network/Request Error (${method} ${url.pathname}):`, error.message, error);
        }
        throw error;
    }
}

export default class ApiService {
    async fetchQuizData(filterParams = {}) {
        const queryParams = {};
        if (filterParams.category_ids?.length > 0) {
            queryParams.category_ids = filterParams.category_ids.join(',');
        }
        if (filterParams.difficulty_levels?.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            queryParams.difficulty_levels = filterParams.difficulty_levels.join(',');
        }
        if (filterParams.mode === 'quick') {
            queryParams.mode = filterParams.mode;
            if (filterParams.count && Number.isInteger(filterParams.count) && filterParams.count > 0) {
                queryParams.count = filterParams.count;
            }
        } else if (filterParams.num_questions && Number.isInteger(filterParams.num_questions) && filterParams.num_questions > 0) {
            queryParams.num_questions = filterParams.num_questions;
        }
        // console.log("APISERVICE.JS: fetchQuizData - Query params a serem enviados para _request:", queryParams);
        return _request(API_URLS.api_get_quiz_data, 'GET', null, queryParams);
    }

    async startQuizSession(sessionData) {
        return _request(API_URLS.start_quiz_session, 'POST', sessionData);
    }

    async registerAnswer(answerData) {
        return _request(API_URLS.register_answer, 'POST', answerData);
    }

    async endQuizSession(sessionEndData) {
        return _request(API_URLS.end_quiz_session, 'POST', sessionEndData);
    }

    async toggleFavoriteStatus(perguntaId) {
        const endpoint = API_URLS.toggle_favorite_status(perguntaId);
        return _request(endpoint, 'POST', {});
    }

    async getFavoriteQuestions() {
        return _request(API_URLS.get_favorite_questions, 'GET');
    }

    /**
     * Busca as estatísticas agregadas do usuário.
     * @param {string} [period='30d'] - O período para filtrar as estatísticas (ex: '7d', '30d', '90d', 'all').
     * @returns {Promise<Object|null>} Dados das estatísticas do usuário.
     */
    async fetchUserStatistics(period = '30d') {
        const queryParams = { period };
        if (!API_URLS.api_get_user_statistics) {
            console.error("ApiService: URL para api_get_user_statistics não definida em API_URLS.");
            throw new Error("URL de estatísticas do usuário não configurada.");
        }
        return _request(API_URLS.api_get_user_statistics, 'GET', null, queryParams);
    }
}