// File: assets/js/utils/helpers.js

/**
 * Obtém o valor de um cookie específico pelo nome.
 * Essencial para obter o CSRF token para requisições POST ao Django.
 * @param {string} name - O nome do cookie a ser recuperado.
 * @returns {string|null} O valor do cookie, ou null se não encontrado.
 */
export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Função debounce para limitar a frequência com que uma função é chamada.
 * Útil para eventos como resize, scroll ou digitação em campos de busca.
 * @param {Function} func - A função a ser executada após o debounce.
 * @param {number} delay - O tempo de espera em milissegundos.
 * @returns {Function} A nova função "debounced".
 */
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Função throttle para garantir que uma função seja chamada no máximo uma vez
 * dentro de um intervalo de tempo especificado.
 * Útil para eventos que disparam rapidamente, como scroll ou mousemove,
 * para melhorar a performance.
 * @param {Function} func - A função a ser executada.
 * @param {number} limit - O intervalo de tempo mínimo em milissegundos entre chamadas.
 * @returns {Function} A nova função "throttled".
 */
export function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    lastFunc.apply(context, args); // Chama a última tentativa se houver
                    lastFunc = null;
                    lastRan = Date.now();
                }
            }, limit);
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

/**
 * Gera um ID único simples.
 * Não é criptograficamente seguro nem universalmente único (UUID),
 * mas útil para gerar IDs para elementos DOM ou componentes JS localmente.
 * @param {string} prefix - Um prefixo opcional para o ID.
 * @returns {string} Um ID relativamente único.
 */
export function simpleUniqueId(prefix = 'id_') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

// Adicione outras funções auxiliares pequenas, puras e reutilizáveis aqui conforme necessário.
// Exemplos:
// - Funções para formatação de datas ou números.
// - Funções para manipulação de strings.
// - Funções para checagem de tipos (embora o TypeScript seja melhor para isso).