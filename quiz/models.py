# quiz/models.py
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator # Para validar inteiros positivos
from datetime import timedelta # Para calcular durações

class Categoria(models.Model):
    nome_categoria = models.CharField(max_length=150, verbose_name="Nome da Categoria")
    id_categoria_pai = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subcategorias',
        verbose_name="Categoria Pai"
    )
    descricao_categoria = models.TextField(blank=True, null=True, verbose_name="Descrição")
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        if self.id_categoria_pai:
            return f"{self.id_categoria_pai.nome_categoria} -> {self.nome_categoria}"
        return self.nome_categoria

    class Meta:
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"
        unique_together = ('nome_categoria', 'id_categoria_pai')
        ordering = ['nome_categoria']


class Pergunta(models.Model):
    texto_pergunta = models.TextField(verbose_name="Texto da Pergunta")
    url_imagem = models.URLField(max_length=512, blank=True, null=True, verbose_name="URL da Imagem")
    referencia_bibliografica = models.CharField(max_length=255, blank=True, null=True, verbose_name="Referência Bibliográfica")
    categorias = models.ManyToManyField(Categoria, related_name='perguntas_associadas', verbose_name="Categorias")
    
    NIVEL_CHOICES = [
        ('Fácil', 'Fácil'),
        ('Médio', 'Médio'),
        ('Difícil', 'Difícil'),
    ]
    nivel_dificuldade = models.CharField(
        max_length=50,
        choices=NIVEL_CHOICES,
        default='Médio',
        verbose_name="Nível de Dificuldade"
    )
    explicacao_resposta = models.TextField(
        blank=True,
        null=True,
        help_text="Explicação geral da resposta correta.",
        verbose_name="Explicação da Resposta"
    )
    ativa = models.BooleanField(default=True, verbose_name="Ativa")
    id_usuario_criador = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='perguntas_criadas',
        verbose_name="Criador da Pergunta"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return f"P{self.pk}: {self.texto_pergunta[:70]}..."

    class Meta:
        verbose_name = "Pergunta"
        verbose_name_plural = "Perguntas"
        ordering = ['-data_criacao']


class OpcaoResposta(models.Model):
    pergunta = models.ForeignKey(Pergunta, related_name='opcoes', on_delete=models.CASCADE, verbose_name="Pergunta")
    texto_opcao = models.TextField(verbose_name="Texto da Opção")
    eh_correta = models.BooleanField(default=False, verbose_name="É Correta?")
    ordem_exibicao = models.PositiveIntegerField(
        default=0,
        help_text="Usado para ordenar as opções, se necessário.",
        verbose_name="Ordem de Exibição"
    )
    feedback_opcao = models.TextField(
        blank=True,
        null=True,
        help_text="Feedback específico para esta opção.",
        verbose_name="Feedback da Opção"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return f"Opção ({self.pk}) para P{self.pergunta.pk}: {self.texto_opcao[:50]}..."

    class Meta:
        verbose_name = "Opção de Resposta"
        verbose_name_plural = "Opções de Resposta"
        ordering = ['pergunta', 'ordem_exibicao', 'pk'] # Adicionado 'pk' para desempate


class SessoesQuizUsuario(models.Model):
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessoes_quiz",
        verbose_name="Usuário"
    )
    data_inicio = models.DateTimeField(default=timezone.now, verbose_name="Data de Início")
    data_fim = models.DateTimeField(null=True, blank=True, verbose_name="Data de Fim")
    tempo_total_segundos = models.IntegerField(
        null=True, blank=True, verbose_name="Tempo Total (s)",
        validators=[MinValueValidator(0)]
    )
    pontuacao_final = models.IntegerField(default=0, verbose_name="Pontuação Final")
    total_perguntas_sessao = models.IntegerField(default=0, verbose_name="Total de Perguntas na Sessão", validators=[MinValueValidator(0)])
    total_acertos = models.IntegerField(default=0, verbose_name="Total de Acertos", validators=[MinValueValidator(0)])
    total_erros = models.IntegerField(default=0, verbose_name="Total de Erros", validators=[MinValueValidator(0)])

    MODO_CHOICES = [
        ('Por Categoria', 'Por Categoria'),
        ('Rápido', 'Rápido'),
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
        verbose_name="Categorias Selecionadas (Modo Categoria)"
    )

    def clean(self):
        super().clean()
        if self.data_fim and self.data_inicio and self.data_fim < self.data_inicio:
            raise ValidationError({'data_fim': 'A data de fim não pode ser anterior à data de início.'})
        if self.total_acertos > self.total_perguntas_sessao:
            raise ValidationError({'total_acertos': 'O número de acertos não pode ser maior que o total de perguntas.'})
        if self.total_erros > self.total_perguntas_sessao:
            raise ValidationError({'total_erros': 'O número de erros não pode ser maior que o total de perguntas.'})
        # Adicionar mais validações se necessário

    @property
    def duracao_sessao_formatada(self):
        """Retorna a duração da sessão formatada como H:M:S ou M:S ou S."""
        if self.tempo_total_segundos is not None and self.tempo_total_segundos >= 0:
            total_seconds = self.tempo_total_segundos
        elif self.data_fim and self.data_inicio:
            duracao = self.data_fim - self.data_inicio
            total_seconds = int(duracao.total_seconds())
        else:
            return "Em andamento"

        if total_seconds < 0: return "Inválida" # Duração negativa não faz sentido

        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}h {minutes:02d}m {seconds:02d}s"
        elif minutes > 0:
            return f"{minutes}m {seconds:02d}s"
        return f"{seconds}s"
    duracao_sessao_formatada.fget.short_description = "Duração"


    @property
    def percentual_acertos(self):
        """Calcula o percentual de acertos da sessão."""
        # Considera apenas perguntas que foram respondidas (não puladas) para o total
        # ou usa total_perguntas_sessao se este reflete as perguntas *apresentadas*.
        # Se total_perguntas_sessao inclui puladas, o cálculo pode ser diferente.
        # Assumindo que total_perguntas_sessao é o número de questões no quiz.
        if self.total_perguntas_sessao > 0:
            return round((self.total_acertos / self.total_perguntas_sessao) * 100, 1)
        return 0.0
    percentual_acertos.fget.short_description = "% Acertos"

    def __str__(self):
        username = self.id_usuario.get_username()
        return f"Sessão {self.pk} - {username} ({self.data_inicio.strftime('%d/%m/%y %H:%M')}) - {self.modo_quiz}"

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
        on_delete=models.CASCADE,
        related_name="respostas_nesta_sessao",
        verbose_name="Pergunta"
    )
    id_opcao_resposta_selecionada = models.ForeignKey(
        OpcaoResposta,
        on_delete=models.SET_NULL, # Mantém registro da tentativa se opção for deletada
        null=True,
        blank=True, # Permite pergunta pulada
        related_name="selecionada_em_respostas",
        verbose_name="Opção Selecionada"
    )
    foi_correta = models.BooleanField(
        null=True, # True (correta), False (incorreta), None (pulada/não avaliada)
        blank=True,
        verbose_name="Foi Correta?"
    )
    data_resposta = models.DateTimeField(auto_now_add=True, verbose_name="Data da Resposta")

    def __str__(self):
        status_resposta = "Pulada"
        if self.id_opcao_resposta_selecionada:
            status_resposta = "Correta" if self.foi_correta else "Incorreta"
        return f"S{self.id_sessao_quiz.pk}/P{self.id_pergunta.pk}: {status_resposta}"

    class Meta:
        verbose_name = "Resposta do Usuário por Sessão"
        verbose_name_plural = "Respostas dos Usuários por Sessão"
        unique_together = ('id_sessao_quiz', 'id_pergunta') # Garante uma resposta por pergunta por sessão
        ordering = ['id_sessao_quiz', 'data_resposta']


class EstatisticasDiariasUsuario(models.Model):
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="estatisticas_diarias",
        verbose_name="Usuário"
    )
    data_estatistica = models.DateField(verbose_name="Data da Estatística")
    perguntas_respondidas_dia = models.IntegerField(default=0, verbose_name="Perguntas Respondidas", validators=[MinValueValidator(0)])
    acertos_dia = models.IntegerField(default=0, verbose_name="Acertos no Dia", validators=[MinValueValidator(0)])
    pontos_dia = models.IntegerField(default=0, verbose_name="Pontos no Dia") # Pontos podem ser negativos se houver penalidade
    sequencia_dias_quiz = models.IntegerField(default=0, verbose_name="Sequência de Dias de Quiz", validators=[MinValueValidator(0)])
    tempo_estudo_segundos_dia = models.IntegerField(default=0, verbose_name="Tempo de Estudo no Dia (s)", validators=[MinValueValidator(0)])
    data_atualizacao_estatistica = models.DateTimeField(auto_now=True, verbose_name="Última Atualização")

    def clean(self):
        super().clean()
        if self.acertos_dia > self.perguntas_respondidas_dia:
            raise ValidationError({'acertos_dia': 'O número de acertos não pode ser maior que o de perguntas respondidas.'})

    @property
    def tempo_estudo_formatado(self):
        """Retorna o tempo de estudo formatado como H:M ou M."""
        if self.tempo_estudo_segundos_dia is not None and self.tempo_estudo_segundos_dia >= 0:
            total_seconds = self.tempo_estudo_segundos_dia
            hours, remainder = divmod(total_seconds, 3600)
            minutes, _ = divmod(remainder, 60) # Segundos não são mostrados para simplificar
            if hours > 0:
                return f"{hours}h {minutes:02d}m"
            return f"{minutes}m"
        return "0m"
    tempo_estudo_formatado.fget.short_description = "Tempo de Estudo"

    @property
    def precisao_dia(self):
        """Calcula a precisão (percentual de acertos) do dia."""
        if self.perguntas_respondidas_dia > 0:
            return round((self.acertos_dia / self.perguntas_respondidas_dia) * 100, 1)
        return 0.0
    precisao_dia.fget.short_description = "% Precisão Dia"


    def __str__(self):
        username = self.id_usuario.get_username()
        return f"Estatísticas de {username} para {self.data_estatistica.strftime('%d/%m/%Y')}"

    class Meta:
        verbose_name = "Estatística Diária do Usuário"
        verbose_name_plural = "Estatísticas Diárias dos Usuários"
        unique_together = ('id_usuario', 'data_estatistica')
        ordering = ['id_usuario', '-data_estatistica']
        
class QuestaoFavorita(models.Model):
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='questoes_favoritas',
        verbose_name="Usuário"
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name='favoritada_por',
        verbose_name="Pergunta"
    )
    data_favoritada = models.DateTimeField(auto_now_add=True, verbose_name="Data de Inclusão nos Favoritos")

    class Meta:
        verbose_name = "Questão Favorita"
        verbose_name_plural = "Questões Favoritas"
        unique_together = ('usuario', 'pergunta') # Garante que um usuário não favorite a mesma questão múltiplas vezes
        ordering = ['-data_favoritada']

    def __str__(self):
        return f"'{self.pergunta.texto_pergunta[:30]}...' favorita de {self.usuario.username}"