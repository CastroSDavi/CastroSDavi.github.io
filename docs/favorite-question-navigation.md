# Favorite Question Explanations

The favorites area now prioritises studying each questão diretamente na própria aba, em vez de redirecionar o usuário para a página de quiz. O antigo botão **Ir para a questão** foi substituído por um atalho que revela as explicações cadastradas para cada alternativa.

## Como funciona o novo botão

1. Clique em **Ver explicações das alternativas** no rodapé do cartão da questão favorita.
2. O botão alterna o estado de expansão (`aria-expanded`) e exibe ou oculta os parágrafos de feedback logo abaixo de cada alternativa listada.
3. O texto do botão muda automaticamente para **Ocultar explicações das alternativas** quando os feedbacks estiverem visíveis.

## Detalhes adicionais

- O botão só aparece quando pelo menos uma alternativa possui `feedback_opcao` retornado pela API.
- A explicação geral da questão (quando cadastrada) continua disponível através do botão **Ver explicação da questão**.
- A lógica de consumo do parâmetro `favorite_question` permanece no aplicativo para preservar compatibilidade com URLs antigas, mas não há mais um atalho direto na interface para disparar esse fluxo.
