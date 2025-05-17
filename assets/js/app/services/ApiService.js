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

    // Adiciona query parameters à URL, se fornecidos
    if (queryParams) {
        Object.keys(queryParams).forEach(key => {
            const paramValue = queryParams[key];
            // Só adiciona o parâmetro se ele tiver um valor (não undefined/null)
            // e se não for uma string vazia (para evitar ?param=)
            if (paramValue !== undefined && paramValue !== null && paramValue.toString().trim() !== '') {
                if (Array.isArray(paramValue)) {
                    paramValue.forEach(value => {
                        if (value.toString().trim() !== '') { // Garante que valores do array não sejam vazios
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
        console.log(`ApiService: Enviando ${method} para ${url.toString()}`, options.body ? `corpo: ${options.body}` : '');
        const response = await fetch(url.toString(), options);
        const responseData = response.status !== 204 ? await response.json().catch(() => null) : null;

        if (!response.ok) {
            const errorMessage = responseData?.message || responseData?.detail || `API Error: ${response.status} ${response.statusText}`;
            console.error(`ApiService Error (${method} ${url.pathname}): Status ${response.status}`, responseData || response.statusText);
            const error = new Error(errorMessage);
            error.response = response;
            error.data = responseData;
            throw error;
        }
        // console.log(`ApiService: Resposta de ${method} ${url.pathname}:`, responseData);
        return responseData;
    } catch (error) {
        if (!error.response) {
            console.error(`ApiService Network/Request Error (${method} ${url.pathname}):`, error.message, error);
        }
        throw error;
    }
}

export default class ApiService {
    /**
     * Busca dados do quiz (perguntas, categorias, opções) da API, com filtros opcionais.
     * @param {Object} [filterParams={}] - Parâmetros de filtro.
     * @param {string[]} [filterParams.category_ids] - IDs das categorias.
     * @param {string[]} [filterParams.difficulty_levels] - Níveis de dificuldade.
     * @param {string} [filterParams.mode] - Modo do quiz (ex: 'quick').
     * @param {number} [filterParams.count] - Número de questões para o modo 'quick'.
     * @param {number|null} [filterParams.num_questions] - Número de questões para modo personalizado.
     * @returns {Promise<Object|null>} Dados do quiz.
     */
    async fetchQuizData(filterParams = {}) {
        const queryParams = {};

        if (filterParams.category_ids?.length > 0) { // Verifica se existe e tem itens
            queryParams.category_ids = filterParams.category_ids.join(',');
        }

        if (filterParams.difficulty_levels?.length > 0 && !filterParams.difficulty_levels.includes('all')) {
            queryParams.difficulty_levels = filterParams.difficulty_levels.join(',');
        }

        // Lógica para modo 'quick' vs. 'num_questions' personalizado
        if (filterParams.mode === 'quick') {
            queryParams.mode = filterParams.mode;
            if (filterParams.count && Number.isInteger(filterParams.count) && filterParams.count > 0) {
                queryParams.count = filterParams.count;
            }
        } else if (filterParams.num_questions && Number.isInteger(filterParams.num_questions) && filterParams.num_questions > 0) {
            // Se não for 'quick' e num_questions for válido, adiciona-o.
            // O backend (views.py) já foi ajustado para usar num_questions_custom
            // quando 'mode' não é 'quick'.
            queryParams.num_questions = filterParams.num_questions;
        }
        // Se nenhum 'mode' ou 'num_questions' específico for passado para um quiz não-rápido,
        // o backend retornará todas as questões que correspondem aos filtros de categoria/dificuldade.

        console.log("APISERVICE.JS: fetchQuizData - Query params a serem enviados para _request:", queryParams);
        return _request(API_URLS.api_get_quiz_data, 'GET', null, queryParams);
    }

    /**
     * Inicia uma nova sessão de quiz no backend.
     * @param {Object} sessionData - Dados para iniciar a sessão.
     * @returns {Promise<Object|null>} Resposta da API.
     */
    async startQuizSession(sessionData) {
        // sessionData: { modo_quiz: string, categoria_ids?: string[], question_ids_in_session: number[] }
        return _request(API_URLS.start_quiz_session, 'POST', sessionData);
    }

    /**
     * Registra a resposta de um usuário a uma pergunta no backend.
     * @param {Object} answerData - Dados da resposta.
     * @returns {Promise<Object|null>} Resposta da API.
     */
    async registerAnswer(answerData) {
        // answerData: { session_id: number, pergunta_id: number, opcao_id: number | null }
        return _request(API_URLS.register_answer, 'POST', answerData);
    }

    /**
     * Finaliza uma sessão de quiz no backend.
     * @param {Object} sessionEndData - Dados para finalizar a sessão.
     * @returns {Promise<Object|null>} Resposta da API.
     */
    async endQuizSession(sessionEndData) {
        // sessionEndData: { session_id: number, tempo_total_segundos: number }
        return _request(API_URLS.end_quiz_session, 'POST', sessionEndData);
    }
}