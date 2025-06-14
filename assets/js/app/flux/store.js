// assets/js/app/flux/store.js

/**
 * Cria um store que armazena a árvore de estado da aplicação.
 * @param {Function} reducer A função que retorna o próximo estado.
 * @param {any} initialState O estado inicial.
 * @returns {object} Um objeto de store com os métodos `dispatch`, `subscribe`, e `getState`.
 */
export function createStore(reducer, initialState) {
    let currentState = initialState;
    const listeners = [];

    /**
     * Retorna o estado atual da aplicação.
     * @returns {any} O estado atual.
     */
    function getState() {
        return currentState;
    }

    /**
     * Adiciona um listener que será chamado sempre que uma ação for despachada.
     * @param {Function} listener O callback a ser executado.
     * @returns {Function} Uma função para remover o listener.
     */
    function subscribe(listener) {
        listeners.push(listener);
        return function unsubscribe() {
            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
        };
    }

    /**
     * Despacha uma ação. Este é o único meio de alterar o estado.
     * @param {object} action Um objeto simples descrevendo a mudança.
     */
    function dispatch(action) {
        currentState = reducer(currentState, action);
        listeners.forEach(listener => listener());
    }

    // Despacha uma ação "INIT" para garantir que o estado inicial seja populado
    // pelo reducer antes de qualquer outra coisa acontecer.
    dispatch({ type: '@@INIT' });

    // Retorna a API pública do store.
    return {
        dispatch,
        subscribe,
        getState
    };
}