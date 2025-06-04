// File: assets/js/app/services/ApiService.js

import { API_URLS } from '../../utils/constants.js';
import { getCookie } from '../../utils/helpers.js';

async function _request(endpoint, method = 'GET', body = null, queryParams = null) {
    const url = new URL(endpoint, window.location.origin);
    console.log(`ApiService.js: _request - Iniciando ${method} para ${url.pathname}${url.search}`);

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
        // console.log(`ApiService.js: _request - URL final com queryParams: ${url.toString()}`);
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
        // console.log(`ApiService.js: _request - Corpo da requisição (${method}):`, body);
    }

    try {
        const response = await fetch(url.toString(), options);
        console.log(`ApiService.js: _request - Resposta recebida para ${method} ${url.pathname}${url.search}. Status: ${response.status}`);

        // Tentativa de ler o corpo como texto para depuração, ANTES de tentar como JSON
        // const responseTextForDebug = await response.clone().text().catch(() => "Não foi possível ler o corpo como texto.");
        // console.log(`ApiService.js: _request - Corpo da resposta (texto bruto para debug):`, responseTextForDebug);


        const responseData = response.status !== 204 ? await response.json().catch((jsonError) => {
            console.error(`ApiService.js: _request - ERRO AO FAZER PARSE DO JSON para ${method} ${url.pathname}. Status: ${response.status}. Erro de parse:`, jsonError);
            // console.log(`ApiService.js: _request - Corpo da resposta que falhou no parse (texto): ${responseTextForDebug}`);
            return null; // Retorna null se o parse do JSON falhar
        }) : null;

        if (!response.ok) {
            const errorMessage = responseData?.message || responseData?.detail || `API Error: ${response.status} ${response.statusText}`;
            console.warn(`ApiService.js: _request - Resposta não OK (${response.status}) para ${method} ${url.pathname}. Mensagem: ${errorMessage}. Dados:`, responseData);
            const error = new Error(errorMessage);
            error.response = response;
            error.data = responseData;
            throw error;
        }
        console.log(`ApiService.js: _request - Dados da resposta (JSON parseado) para ${method} ${url.pathname}:`, responseData);
        return responseData;
    } catch (error) {
        if (!error.response) { // Erros de rede, CORS, etc., onde não há um objeto 'response'
            console.error(`ApiService.js: _request - Erro de Rede/Requisição para ${method} ${url.pathname}:`, error.message, error.stack);
        } else { // Erros HTTP que foram lançados (como 4xx, 5xx)
            // Já logado acima no if(!response.ok)
        }
        throw error;
    }
}

export default class ApiService {
    constructor() {
        console.log("ApiService.js: Construtor - Instância criada.");
    }

    async fetchQuizData(filterParams = {}) {
        console.log("ApiService.js: fetchQuizData - Chamado com filtros:", filterParams);
        const queryParams = {};
        if (filterParams.category_ids?.length > 0) {
            queryParams.category_ids = filterParams.category_ids.join(',');
        }
        if (filterParams.difficulty_levels?.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            queryParams.difficulty_levels = filterParams.difficulty_levels.join(',');
        }
        if (filterParams.quiz_definicao_id) {
            queryParams.quiz_definicao_id = filterParams.quiz_definicao_id;
        } else if (filterParams.mode === 'Rápido') { // "Rápido" como string, conforme usado em QuizState
            queryParams.mode = filterParams.mode;
            if (filterParams.count && Number.isInteger(filterParams.count) && filterParams.count > 0) {
                queryParams.count = filterParams.count;
            }
        } else if (filterParams.num_questions && Number.isInteger(filterParams.num_questions) && filterParams.num_questions > 0) {
            queryParams.num_questions = filterParams.num_questions;
        }
        // Se mode for 'Por Categoria', não precisa de parâmetro de modo explícito se category_ids ou num_questions estiverem presentes.
        // Se todos os filtros estiverem vazios, será uma busca geral.
        console.log("ApiService.js: fetchQuizData - QueryParams finais:", queryParams);
        return _request(API_URLS.api_get_quiz_data, 'GET', null, queryParams);
    }

    async startQuizSession(sessionData) {
        console.log("ApiService.js: startQuizSession - Chamado com dados:", sessionData);
        return _request(API_URLS.start_quiz_session, 'POST', sessionData);
    }

    async registerAnswer(answerData) {
        console.log("ApiService.js: registerAnswer - Chamado com dados:", answerData);
        return _request(API_URLS.register_answer, 'POST', answerData);
    }

    async endQuizSession(sessionEndData) {
        console.log("ApiService.js: endQuizSession - Chamado com dados:", sessionEndData);
        return _request(API_URLS.end_quiz_session, 'POST', sessionEndData);
    }

    async toggleFavoriteStatus(perguntaId) {
        const endpoint = API_URLS.toggle_favorite_status(perguntaId);
        console.log("ApiService.js: toggleFavoriteStatus - Chamado para pergunta ID:", perguntaId, "Endpoint:", endpoint);
        return _request(endpoint, 'POST', {});
    }

    async getFavoriteQuestions() {
        console.log("ApiService.js: getFavoriteQuestions - Chamado.");
        return _request(API_URLS.get_favorite_questions, 'GET');
    }

    async fetchUserStatistics(period = '30d') {
        const queryParams = { period };
        console.log("ApiService.js: fetchUserStatistics - Chamado para período:", period);
        if (!API_URLS.api_get_user_statistics) {
            console.error("ApiService.js: URL para api_get_user_statistics não definida em API_URLS.");
            throw new Error("URL de estatísticas do usuário não configurada.");
        }
        return _request(API_URLS.api_get_user_statistics, 'GET', null, queryParams);
    }

    async resumeQuizSession() {
        console.log("ApiService.js: resumeQuizSession - Chamado.");
        if (!API_URLS.api_resume_quiz_session) {
            console.error("ApiService.js: URL para api_resume_quiz_session não definida em API_URLS.");
            throw new Error("URL para retomar sessão de quiz não configurada.");
        }
        return _request(API_URLS.api_resume_quiz_session, 'GET');
    }
}