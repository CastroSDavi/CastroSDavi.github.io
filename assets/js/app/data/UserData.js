// File: assets/js/app/data/UserData.js

export default class UserData {
    constructor() {
        this.reset();
    }

    get acertos() {
        return this._acertos;
    }

    get erros() {
        return this._erros;
    }

    get pontos() {
        return this._pontos;
    }

    incrementarAcertos() {
        this._acertos++;
        this._atualizarPontos();
    }

    incrementarErros() {
        this._erros++;
        this._atualizarPontos();
    }

    // Método privado para recalcular os pontos
    _atualizarPontos() {
        // A lógica de pontuação: 15 pontos por acerto, -5 por erro (não pode ser negativo)
        this._pontos = Math.max(0, (15 * this._acertos) - (5 * this._erros));
    }

    reset() {
        this._acertos = 0;
        this._erros = 0;
        this._pontos = 0;
    }

    /**
     * Atualiza os dados do usuário com base na resposta do servidor.
     * Isso é útil quando o backend recalcula e retorna o estado da pontuação.
     * @param {number} acertos - Número total de acertos da sessão.
     * @param {number} erros - Número total de erros da sessão.
     * @param {number} pontos - Pontuação total da sessão.
     */
    updateFromServer(acertos, erros, pontos) {
        this._acertos = acertos !== undefined ? parseInt(acertos, 10) : this._acertos;
        this._erros = erros !== undefined ? parseInt(erros, 10) : this._erros;
        this._pontos = pontos !== undefined ? parseInt(pontos, 10) : this._pontos;
    }
}