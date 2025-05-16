# quiz/models.py
from django.db import models
from django.contrib.auth.models import User # Importar o modelo User padrão
from django.utils import timezone # Para default=timezone.now se necessário

class Categoria(models.Model):
    nome_categoria = models.CharField(max_length=150)
    id_categoria_pai = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subcategorias'
    )
    descricao_categoria = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nome_categoria

    class Meta:
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"
        unique_together = ('nome_categoria', 'id_categoria_pai')
        ordering = ['nome_categoria']


class Pergunta(models.Model):
    texto_pergunta = models.TextField()
    url_imagem = models.URLField(max_length=512, blank=True, null=True)
    referencia_bibliografica = models.CharField(max_length=255, blank=True, null=True)
    categorias = models.ManyToManyField(Categoria, related_name='perguntas_associadas') # Alterado related_name para evitar conflito
    nivel_dificuldade = models.CharField(
        max_length=50,
        choices=[
            ('Fácil', 'Fácil'),
            ('Médio', 'Médio'),
            ('Difícil', 'Difícil'),
        ],
        default='Médio'
    )
    explicacao_resposta = models.TextField(
        blank=True,
        null=True,
        help_text="Explicação geral da resposta correta."
    )
    ativa = models.BooleanField(default=True)
    id_usuario_criador = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='perguntas_criadas',
        verbose_name="Criador da Pergunta"
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ID {self.pk}: {self.texto_pergunta[:70]}..."

    class Meta:
        verbose_name = "Pergunta"
        verbose_name_plural = "Perguntas"
        ordering = ['-data_criacao']


class OpcaoResposta(models.Model):
    pergunta = models.ForeignKey(Pergunta, related_name='opcoes', on_delete=models.CASCADE)
    texto_opcao = models.TextField()
    eh_correta = models.BooleanField(default=False)
    ordem_exibicao = models.PositiveIntegerField(
        default=0,
        help_text="Usado para ordenar as opções, se necessário."
    )
    feedback_opcao = models.TextField(
        blank=True,
        null=True,
        help_text="Feedback específico para esta opção."
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Opção ({self.pk}) para P{self.pergunta.pk}: {self.texto_opcao[:50]}..."

    class Meta:
        verbose_name = "Opção de Resposta"
        verbose_name_plural = "Opções de Resposta"
        ordering = ['pergunta', 'ordem_exibicao', 'pk']


class SessoesQuizUsuario(models.Model):
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessoes_quiz",
        verbose_name="Usuário"
    )
    data_inicio = models.DateTimeField(default=timezone.now, verbose_name="Data de Início")
    data_fim = models.DateTimeField(null=True, blank=True, verbose_name="Data de Fim")
    tempo_total_segundos = models.IntegerField(null=True, blank=True, verbose_name="Tempo Total (s)")
    pontuacao_final = models.IntegerField(default=0, verbose_name="Pontuação Final")
    total_perguntas_sessao = models.IntegerField(default=0, verbose_name="Total de Perguntas na Sessão")
    total_acertos = models.IntegerField(default=0, verbose_name="Total de Acertos")
    total_erros = models.IntegerField(default=0, verbose_name="Total de Erros")

    MODO_CHOICES = [
        ('Por Categoria', 'Por Categoria'),
        ('Rápido', 'Rápido'),
        # Adicionar outros modos se necessário
    ]
    modo_quiz = models.CharField(
        max_length=50,
        choices=MODO_CHOICES,
        verbose_name="Modo do Quiz"
    )

    STATUS_CHOICES = [
        ('Em Andamento', 'Em Andamento'),
        ('Completa', 'Completa'),
        ('Abandonada', 'Abandonada'),
    ]
    status_sessao = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Em Andamento',
        verbose_name="Status da Sessão"
    )

    categorias_selecionadas = models.ManyToManyField(
        Categoria,
        blank=True,
        related_name="sessoes_onde_foi_selecionada",
        verbose_name="Categorias Selecionadas"
    )
    # data_criacao_sessao no DOC é coberto por data_inicio com default=timezone.now
    # ou poderia ser um auto_now_add=True se o registro for criado antes do início efetivo.

    def __str__(self):
        username = self.id_usuario.get_username() # Mais seguro que self.id_usuario.username se o usuário for deletado e o campo for SET_NULL
        return f"Sessão {self.pk} - Usuário: {username} ({self.data_inicio.strftime('%d/%m/%y %H:%M')})"

    class Meta:
        verbose_name = "Sessão de Quiz do Usuário"
        verbose_name_plural = "Sessões de Quiz dos Usuários"
        ordering = ['-data_inicio']


class RespostasUsuarioPorSessao(models.Model):
    id_sessao_quiz = models.ForeignKey(
        SessoesQuizUsuario,
        on_delete=models.CASCADE,
        related_name="respostas_dadas",
        verbose_name="Sessão do Quiz"
    )
    id_pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE, # Se a pergunta for deletada, a resposta relacionada também será. Considere SET_NULL se quiser manter o histórico de resposta.
        related_name="respostas_nesta_sessao",
        verbose_name="Pergunta"
    )
    id_opcao_resposta_selecionada = models.ForeignKey(
        OpcaoResposta,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="selecionada_em_respostas",
        verbose_name="Opção Selecionada"
    )
    foi_correta = models.BooleanField(
        null=True, # Permite que a resposta não seja avaliada imediatamente ou se foi pulada.
        blank=True,
        verbose_name="Foi Correta?"
    )
    data_resposta = models.DateTimeField(auto_now_add=True, verbose_name="Data da Resposta")

    def __str__(self):
        return f"Resposta à P{self.id_pergunta.pk} na Sessão {self.id_sessao_quiz.pk}"

    class Meta:
        verbose_name = "Resposta do Usuário por Sessão"
        verbose_name_plural = "Respostas dos Usuários por Sessão"
        unique_together = ('id_sessao_quiz', 'id_pergunta')
        ordering = ['data_resposta']


class EstatisticasDiariasUsuario(models.Model):
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="estatisticas_diarias",
        verbose_name="Usuário"
    )
    data_estatistica = models.DateField(verbose_name="Data da Estatística")
    perguntas_respondidas_dia = models.IntegerField(default=0, verbose_name="Perguntas Respondidas no Dia")
    acertos_dia = models.IntegerField(default=0, verbose_name="Acertos no Dia")
    pontos_dia = models.IntegerField(default=0, verbose_name="Pontos no Dia")
    sequencia_dias_quiz = models.IntegerField(default=0, verbose_name="Sequência de Dias de Quiz")
    tempo_estudo_segundos_dia = models.IntegerField(default=0, verbose_name="Tempo de Estudo no Dia (s)")
    data_atualizacao_estatistica = models.DateTimeField(auto_now=True, verbose_name="Última Atualização")

    def __str__(self):
        username = self.id_usuario.get_username()
        return f"Estatísticas de {username} para {self.data_estatistica.strftime('%d/%m/%Y')}"

    class Meta:
        verbose_name = "Estatística Diária do Usuário"
        verbose_name_plural = "Estatísticas Diárias dos Usuários"
        unique_together = ('id_usuario', 'data_estatistica')
        ordering = ['id_usuario', '-data_estatistica']