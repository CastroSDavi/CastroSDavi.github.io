// File: assets/js/utils/constants.js

/**
 * URLs da API para interagir com o backend Django.
 * Os caminhos são relativos à raiz do site.
 */
export const API_URLS = {
    api_get_quiz_data: '/api/quiz/alldata/',
    api_get_quiz_summary: '/api/quiz/summary/',
    api_get_filtered_question_count: '/api/quiz/filtered-count/', // <- Nova linha com a vírgula no final
    start_quiz_session: '/api/quiz/start-session/',
    register_answer: '/api/quiz/register-answer/',
    end_quiz_session: '/api/quiz/end-session/',
    get_question_detail: (perguntaId) => `/api/question/${perguntaId}/`,
    toggle_favorite_status: (perguntaId) => `/api/question/${perguntaId}/toggle_favorite/`,
    get_favorite_questions: '/api/favorites/',
    api_get_user_statistics: '/api/user-statistics/',
    api_resume_quiz_session: '/api/quiz/resume-session/'
};

/**
 * Número padrão de perguntas para o modo "Quiz Rápido".
 */
export const QUICK_QUIZ_COUNT = 10;

/**
 * Número de questões a serem exibidas por página no grid de navegação de questões.
 */
export const QUESTOES_POR_PAGINA_GRID = 5;

/**
 * Duração padrão (em milissegundos) para transições de UI (ex: fade-in/out, modais).
 */
export const TRANSITION_DURATION = 300; // ms

/**
 * Duração para transições mais lentas.
 */
export const TRANSITION_DURATION_SLOW = 400; // ms

/**
 * Duração para transições mais rápidas.
 */
export const TRANSITION_DURATION_FAST = 150; // ms