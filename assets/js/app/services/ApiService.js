// File: assets/js/app/services/ApiService.js

import { API_URLS } from '../../utils/constants.js';
import { getCookie } from '../../utils/helpers.js';

async function _request(endpoint, method = 'GET', body = null, queryParams = null) {
    const url = new URL(endpoint, window.location.origin);

    if (queryParams) {
        Object.keys(queryParams).forEach(key => {
            const paramValue = queryParams[key];
            if (paramValue !== undefined && paramValue !== null) {
                if (Array.isArray(paramValue)) {
                    paramValue.forEach(value => url.searchParams.append(key, value.toString()));
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
            'X-CSRFToken': getCookie('csrftoken'), // Essencial para requisições POST/PUT/DELETE do Django
        },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);
        // Tenta parsear JSON, mas permite respostas sem corpo (ex: 204 No Content)
        const responseData = response.status !== 204 ? await response.json().catch(() => null) : null;

        if (!response.ok) {
            const errorMessage = responseData?.message || responseData?.detail || `API Error: ${response.status} ${response.statusText}`;
            console.error(`ApiService Error (${method} ${url.toString()}): Status ${response.status}`, responseData);
            // Cria um erro com a mensagem e adiciona a resposta completa para depuração
            const error = new Error(errorMessage);
            error.response = response;
            error.data = responseData;
            throw error;
        }
        return responseData;
    } catch (error) {
        // Se o erro já foi construído acima, apenas o relança.
        // Se for um erro de rede (fetch falhou), loga e relança.
        if (!error.response) { // Indica erro de rede ou similar antes da resposta do servidor
            console.error(`ApiService Network/Request Error (${method} ${url.toString()}):`, error.message);
        }
        throw error;
    }
}

export default class ApiService {
    async fetchQuizData(filterParams = {}) {
        // filterParams: { category_ids?: string[], difficulty_levels?: string[], mode?: string, count?: number }
        const queryParams = {};
        if (filterParams.category_ids && filterParams.category_ids.length > 0) {
            queryParams.category_ids = filterParams.category_ids.join(',');
        }
        if (filterParams.difficulty_levels && filterParams.difficulty_levels.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            queryParams.difficulty_levels = filterParams.difficulty_levels.join(',');
        }
        if (filterParams.mode) {
            queryParams.mode = filterParams.mode;
        }
        if (filterParams.count) {
            queryParams.count = filterParams.count;
        }
        return _request(API_URLS.api_get_quiz_data, 'GET', null, queryParams);
    }

    async startQuizSession(sessionData) {
        // sessionData: { modo_quiz: string, categoria_ids: string[], question_ids_in_session: number[] }
        return _request(API_URLS.start_quiz_session, 'POST', sessionData);
    }

    async registerAnswer(answerData) {
        // answerData: { session_id: number, pergunta_id: number, opcao_id: number | null }
        return _request(API_URLS.register_answer, 'POST', answerData);
    }

    async endQuizSession(sessionEndData) {
        // sessionEndData: { session_id: number, tempo_total_segundos: number }
        return _request(API_URLS.end_quiz_session, 'POST', sessionEndData);
    }
}