// File: assets/js/main.js

import App from './app/App.js'; // Importa a classe principal da aplicação

document.addEventListener('DOMContentLoaded', () => {
    // Garante que o DOM esteja totalmente carregado antes de executar o script.

    const app = new App(); // Cria uma instância da sua aplicação.

    // Inicializa a aplicação.
    // O método initialize() dentro da classe App deve lidar com a configuração inicial,
    // como buscar dados, configurar listeners, etc.
    // Adicionamos um .catch() para capturar erros críticos durante a inicialização.
    app.initialize().catch(error => {
        console.error("Falha crítica ao inicializar a aplicação:", error);

        // Tenta exibir uma mensagem de erro amigável para o usuário no corpo da página.
        // Esta é uma medida de último recurso se a UI principal não puder ser renderizada.
        const bodyElement = document.querySelector('body');
        if (bodyElement) {
            // Limpa o corpo para evitar mostrar uma página quebrada e depois a mensagem de erro.
            // Em uma aplicação real, você poderia ter um placeholder de erro no HTML.
            bodyElement.innerHTML = `
                <div style="text-align: center; padding: 40px; font-family: Arial, sans-serif; color: #333;">
                    <h1 style="color: #d9534f;">Erro Inesperado</h1>
                    <p>Ocorreu uma falha grave ao carregar o MedQuiz.</p>
                    <p>Por favor, tente recarregar a página em alguns instantes.</p>
                    <p style="font-size: 0.9em; color: #777;">Se o problema persistir, o serviço pode estar temporariamente indisponível ou pode haver um problema de conexão.</p>
                </div>
            `;
        }
    });
});