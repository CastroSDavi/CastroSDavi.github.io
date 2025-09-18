// File: assets/js/app/services/ApiService.js

import { API_URLS } from '../../utils/constants.js';
import { getCookie } from '../../utils/helpers.js';

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
            'X-CSRFToken': getCookie('csrftoken'),
        },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);

        let responseData = null;
        if (response.status !== 204) {
            try {
                responseData = await response.json();
            } catch (jsonError) {
                console.error(`ApiService: falha ao interpretar resposta JSON de ${url.pathname}`, jsonError);
            }
        }

        if (!response.ok) {
            const errorMessage = responseData?.message || responseData?.detail || `API Error: ${response.status} ${response.statusText}`;
            const error = new Error(errorMessage);
            error.response = response;
            error.data = responseData;
            throw error;
        }
        return responseData;
    } catch (error) {
        if (!error.response) {
            console.error(`ApiService: erro de rede ao acessar ${url.pathname}`, error);
        }
        throw error;
    }
}

export default class ApiService {
    async fetchAppSummary() {
        return _request(API_URLS.api_get_quiz_summary, 'GET');
    }

    async fetchFilteredQuestionCount(filterParams = {}) {
        const queryParams = {};
        if (filterParams.category_ids?.length > 0) {
            queryParams.category_ids = filterParams.category_ids.join(',');
        }
        if (filterParams.difficulty_levels?.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            queryParams.difficulty_levels = filterParams.difficulty_levels.join(',');
        }
        return _request(API_URLS.api_get_filtered_question_count, 'GET', null, queryParams);
    }

    async startQuizSession(sessionConfig = {}) {
        const payload = {
            modo_quiz: sessionConfig.modo_quiz || sessionConfig.mode,
            categoria_ids: sessionConfig.categoria_ids || sessionConfig.category_ids || [],
            difficulty_levels: sessionConfig.difficulty_levels || [],
            num_questions: sessionConfig.num_questions,
            quiz_definicao_id: sessionConfig.quiz_definicao_id,
        };
        if (Array.isArray(payload.difficulty_levels) && payload.difficulty_levels.includes('all')) {
            payload.difficulty_levels = ['all'];
        }
        return _request(API_URLS.start_quiz_session, 'POST', payload);
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

    async fetchUserStatistics(period = '30d') {
        const queryParams = { period };
        if (!API_URLS.api_get_user_statistics) {
            console.error("ApiService.js: URL para api_get_user_statistics não definida em API_URLS.");
            throw new Error("URL de estatísticas do usuário não configurada.");
        }
        return _request(API_URLS.api_get_user_statistics, 'GET', null, queryParams);
    }

    async resumeQuizSession() {
        if (!API_URLS.api_resume_quiz_session) {
            console.error("ApiService.js: URL para api_resume_quiz_session não definida em API_URLS.");
            throw new Error("URL para retomar sessão de quiz não configurada.");
        }
        return _request(API_URLS.api_resume_quiz_session, 'GET');
    }
}