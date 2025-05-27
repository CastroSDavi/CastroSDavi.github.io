// File: assets/js/utils/constants.js

/**
 * URLs da API para interagir com o backend Django.
 * Os caminhos são relativos à raiz do site.
 */
export const API_URLS = {
    api_get_quiz_data: '/api/quiz/alldata/',       // Endpoint para buscar todos os dados do quiz (perguntas, categorias, opções)
    start_quiz_session: '/api/quiz/start-session/', // Endpoint para iniciar uma nova sessão de quiz
    register_answer: '/api/quiz/register-answer/', // Endpoint para registrar a resposta de um usuário a uma pergunta
    end_quiz_session: '/api/quiz/end-session/',     // Endpoint para finalizar uma sessão de quiz
    toggle_favorite_status: (perguntaId) => `/api/question/${perguntaId}/toggle_favorite/`,
    get_favorite_questions: '/api/favorites/',      // Endpoint para buscar questões favoritas
    api_get_user_statistics: '/api/user-statistics/' // NOVA URL para estatísticas do usuário
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
export const TRANSITION_DURATION_SLOW = 400; // ms (exemplo, usado no modal.css)

/**
 * Duração para transições mais rápidas.
 */
export const TRANSITION_DURATION_FAST = 150; // ms (exemplo, usado no button.css)