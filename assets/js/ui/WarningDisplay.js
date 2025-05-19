// File: assets/js/ui/WarningDisplay.js

export default class WarningDisplay {
    constructor(quizUIInstance) {
        // console.log("WARNINGDISPLAY.JS: Constructor - Instanciando WarningDisplay.");
        this.quizUI = quizUIInstance;
        this.elements = this.quizUI.elements; // Atalho para os elementos DOM
    }

    /**
     * Mostra uma mensagem de aviso/erro na UI.
     * @param {string} message - A mensagem a ser exibida (pode conter HTML simples).
     * @param {string} [type='warning'] - O tipo de mensagem ('error', 'warning', 'info', 'success').
     * @param {boolean} [isTextCentered=false] - Se o texto dentro da mensagem deve ser centralizado.
     */
    show(message, type = 'warning', isTextCentered = false) {
        // console.log(`WARNINGDISPLAY.JS: show - Exibindo aviso: "${message}", Tipo: ${type}`);
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;

        if (avisoContainer && avisoMensagem) {
            avisoMensagem.innerHTML = message; // Permite HTML básico na mensagem
            avisoMensagem.setAttribute("role", "alert");

            const baseClasses = ['card', 'card--aviso']; 
            avisoContainer.className = baseClasses.join(' '); 
            
            avisoContainer.classList.add('form-message', `form-message--${type}`);
            if (isTextCentered) {
                avisoContainer.classList.add('text-centered');
            } else {
                avisoContainer.classList.remove('text-centered');
            }

            this.quizUI.showElement(avisoContainer);
            
            // Esconde outros painéis principais para dar foco ao aviso
            this.quizUI.hideElement(placeholderFiltrosContainer);
            this.quizUI.hideElement(challengeHubContainer);
            this.quizUI.hideElement(quizSectionContent); // Esconde a seção de quiz ativo
            this.quizUI.hideElement(resultadoCard);    // Esconde resultados
            this.quizUI.hideElement(this.quizUI.elements.scorePanel); // Esconde painel de score
        }
    }

    clear() {
        // console.log("WARNINGDISPLAY.JS: clear - Limpando aviso.");
        const { avisoContainer, avisoMensagem, placeholderFiltrosContainer, challengeHubContainer, quizSectionContent, resultadoCard } = this.elements;
        
        this.quizUI.hideElement(avisoContainer);
        if (avisoMensagem) avisoMensagem.removeAttribute("role");

        if (avisoContainer) {
            const baseClasses = ['card', 'card--aviso', this.quizUI.hiddenClassName];
            avisoContainer.className = baseClasses.join(' ');
        }

        // Restaura a visibilidade do ChallengeHub se nenhuma outra seção principal (quiz ou resultados) estiver ativa.
        // Isso assume que o ChallengeHub é o estado padrão da página de questões se não houver quiz/resultado/aviso.
        if (document.getElementById('question-section')) { // Verifica se estamos na página de questões
            const isQuizActive = quizSectionContent && !quizSectionContent.classList.contains(this.quizUI.hiddenClassName);
            const areResultsVisible = resultadoCard && !resultadoCard.classList.contains(this.quizUI.hiddenClassName);
            
            if (!isQuizActive && !areResultsVisible && challengeHubContainer) {
                this.quizUI.showElement(challengeHubContainer);
                this.quizUI.hideElement(placeholderFiltrosContainer); // Garante que placeholder esteja escondido
            }
        }
    }
}