# quiz/models.py
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from datetime import timedelta

# --- Modelos de Conteúdo do Quiz ---

class Categoria(models.Model):
    """
    Categoriza as perguntas. Pode ter uma estrutura hierárquica (pai/filho).
    """
    nome_categoria = models.CharField(
        max_length=150,
        verbose_name="Nome da Categoria"
    )
    id_categoria_pai = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subcategorias',
        verbose_name="Categoria Pai",
        help_text="Deixe em branco se esta for uma categoria principal."
    )
    descricao_categoria = models.TextField(
        blank=True,
        null=True,
        verbose_name="Descrição"
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )
    data_atualizacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Data de Atualização"
    )

    def __str__(self):
        if self.id_categoria_pai:
            return f"{self.id_categoria_pai.nome_categoria} -> {self.nome_categoria}"
        return self.nome_categoria

    class Meta:
        verbose_name = "Categoria de Pergunta"
        verbose_name_plural = "Categorias de Perguntas"
        unique_together = ('nome_categoria', 'id_categoria_pai')
        ordering = ['nome_categoria']


class Pergunta(models.Model):
    """
    Representa uma pergunta do quiz.
    """
    texto_pergunta = models.TextField(verbose_name="Texto da Pergunta")
    url_imagem = models.URLField(
        max_length=512,
        blank=True,
        null=True,
        verbose_name="URL da Imagem (Opcional)"
    )
    referencia_bibliografica = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Referência Bibliográfica"
    )
    categorias = models.ManyToManyField(
        Categoria,
        related_name='perguntas_associadas',
        verbose_name="Categorias",
        help_text="Selecione uma ou mais categorias para esta pergunta."
    )

    class NivelDificuldade(models.TextChoices):
        FACIL = 'Fácil', 'Fácil'
        MEDIO = 'Médio', 'Médio'
        DIFICIL = 'Difícil', 'Difícil'

    nivel_dificuldade = models.CharField(
        max_length=50,
        choices=NivelDificuldade.choices,
        default=NivelDificuldade.MEDIO,
        verbose_name="Nível de Dificuldade"
    )
    explicacao_resposta = models.TextField(
        blank=True,
        null=True,
        help_text="Explicação detalhada da resposta correta ou do tópico da pergunta.",
        verbose_name="Explicação da Resposta"
    )
    ativa = models.BooleanField(
        default=True,
        verbose_name="Ativa",
        help_text="Perguntas inativas não aparecerão nos quizzes."
    )
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
        verbose_name = "Pergunta do Quiz"
        verbose_name_plural = "Perguntas do Quiz"
        ordering = ['-data_criacao']


class OpcaoResposta(models.Model):
    """
    Representa uma opção de resposta para uma Pergunta.
    """
    pergunta = models.ForeignKey(
        Pergunta,
        related_name='opcoes',
        on_delete=models.CASCADE,
        verbose_name="Pergunta Associada"
    )
    texto_opcao = models.TextField(verbose_name="Texto da Opção")
    eh_correta = models.BooleanField(
        default=False,
        verbose_name="É Correta?",
        help_text="Marque se esta é a opção correta para a pergunta."
    )
    ordem_exibicao = models.PositiveIntegerField(
        default=0,
        help_text="Usado para ordenar as opções na exibição, se necessário (0, 1, 2...).",
        verbose_name="Ordem de Exibição"
    )
    feedback_opcao = models.TextField(
        blank=True,
        null=True,
        help_text="Feedback específico para esta opção, exibido após o usuário responder.",
        verbose_name="Feedback da Opção (Opcional)"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return f"Opção ({self.pk}) para P{self.pergunta.pk}: {self.texto_opcao[:50]}..."

    class Meta:
        verbose_name = "Opção de Resposta"
        verbose_name_plural = "Opções de Resposta"
        ordering = ['pergunta', 'ordem_exibicao', 'pk']
        # Garante que para uma pergunta, a ordem de exibição seja única se você quiser usar isso como um controle rígido.
        # unique_together = ('pergunta', 'ordem_exibicao') # Descomente se a ordem DEVE ser única por pergunta.

# --- Modelos de Configuração e Definição de Quizzes ---

class QuizDefinicao(models.Model):
    """
    Modelo para definir um quiz pré-configurado com um conjunto específico e ordenado de perguntas.
    Permite criar "provas" ou "listas de estudo" com conteúdo e sequência fixos.
    """
    nome_quiz = models.CharField(
        max_length=200,
        unique=True,
        verbose_name="Nome do Quiz Definido"
    )
    descricao = models.TextField(
        blank=True,
        null=True,
        verbose_name="Descrição do Quiz"
    )
    perguntas = models.ManyToManyField(
        Pergunta,
        through='QuizDefinicaoPergunta',
        related_name='definicoes_quiz_associadas', # Alterado para evitar conflito com Pergunta.definicoes_quiz
        verbose_name="Perguntas do Quiz"
    )
    ativo = models.BooleanField(
        default=True,
        verbose_name="Quiz Ativo",
        help_text="Se este quiz pode ser selecionado pelos usuários."
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        return self.nome_quiz

    class Meta:
        verbose_name = "Definição de Quiz"
        verbose_name_plural = "Definições de Quizzes"
        ordering = ['nome_quiz']


class QuizDefinicaoPergunta(models.Model):
    """
    Modelo intermediário para o relacionamento ManyToMany entre QuizDefinicao e Pergunta.
    Armazena a ordem de cada pergunta dentro de uma definição de quiz específica.
    """
    quiz_definicao = models.ForeignKey(
        QuizDefinicao,
        on_delete=models.CASCADE,
        verbose_name="Definição do Quiz"
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        verbose_name="Pergunta"
    )
    ordem = models.PositiveIntegerField(
        verbose_name="Ordem no Quiz",
        help_text="Define a posição da pergunta dentro deste quiz (começando em 0 ou 1).",
        validators=[MinValueValidator(0)]
    )

    class Meta:
        verbose_name = "Pergunta em Definição de Quiz"
        verbose_name_plural = "Perguntas em Definições de Quizzes"
        ordering = ['quiz_definicao', 'ordem']
        unique_together = (
            ('quiz_definicao', 'pergunta'), # Uma pergunta não pode aparecer duas vezes no mesmo quiz
            ('quiz_definicao', 'ordem')     # A ordem deve ser única dentro de um quiz
        )

    def __str__(self):
        return f"'{self.pergunta.texto_pergunta[:30]}...' no quiz '{self.quiz_definicao.nome_quiz}' (Ordem: {self.ordem})"


# --- Modelos de Interação do Usuário e Estatísticas ---

class SessoesQuizUsuario(models.Model):
    """
    Registra cada sessão de quiz iniciada por um usuário.
    """
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessoes_quiz",
        verbose_name="Usuário"
    )
    id_quiz_definicao = models.ForeignKey(
        QuizDefinicao,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="sessoes_realizadas",
        verbose_name="Quiz Pré-definido (se aplicável)",
        help_text="Se esta sessão foi baseada em um quiz pré-definido."
    )
    data_inicio = models.DateTimeField(default=timezone.now, verbose_name="Data de Início")
    data_fim = models.DateTimeField(null=True, blank=True, verbose_name="Data de Fim")
    tempo_total_segundos = models.IntegerField(
        null=True, blank=True, verbose_name="Tempo Total (s)",
        validators=[MinValueValidator(0)]
    )
    pontuacao_final = models.IntegerField(default=0, verbose_name="Pontuação Final")
    total_perguntas_sessao = models.IntegerField(
        default=0,
        verbose_name="Total de Perguntas na Sessão",
        validators=[MinValueValidator(0)]
    )
    total_acertos = models.IntegerField(default=0, verbose_name="Total de Acertos", validators=[MinValueValidator(0)])
    total_erros = models.IntegerField(default=0, verbose_name="Total de Erros", validators=[MinValueValidator(0)])

    class ModoQuiz(models.TextChoices):
        POR_CATEGORIA = 'Por Categoria', 'Por Categoria'
        RAPIDO = 'Rápido', 'Rápido'
        DEFINIDO = 'Definido', 'Pré-Definido' # Quiz baseado em QuizDefinicao

    modo_quiz = models.CharField(
        max_length=50,
        choices=ModoQuiz.choices,
        verbose_name="Modo do Quiz"
    )

    class StatusSessao(models.TextChoices):
        EM_ANDAMENTO = 'Em Andamento', 'Em Andamento'
        COMPLETA = 'Completa', 'Completa'
        ABANDONADA = 'Abandonada', 'Abandonada'

    status_sessao = models.CharField(
        max_length=50,
        choices=StatusSessao.choices,
        default=StatusSessao.EM_ANDAMENTO,
        verbose_name="Status da Sessão"
    )

    # Filtros usados para gerar o quiz (se não for modo 'Definido')
    categorias_selecionadas = models.ManyToManyField(
        Categoria,
        blank=True,
        related_name="sessoes_filtradas_por_categoria",
        verbose_name="Categorias Selecionadas (Modo Categoria)"
    )
    dificuldades_selecionadas_json = models.JSONField(
        blank=True, null=True,
        help_text="Lista de níveis de dificuldade selecionados, ex: ['Fácil', 'Médio'] ou ['all']",
        verbose_name='Níveis de Dificuldade Selecionados (JSON)'
    )
    num_questoes_solicitadas = models.PositiveIntegerField(
        blank=True, null=True,
        help_text='Número de questões que o usuário pediu (para modo personalizado ou rápido)',
        verbose_name='Número de Questões Solicitadas'
    )

    # Para "Continuar de Onde Parou" e log detalhado da sessão
    ids_perguntas_json = models.JSONField(
        null=True, blank=True,
        verbose_name="IDs Ordenados das Perguntas da Sessão",
        help_text="Lista dos IDs das perguntas que compõem esta sessão, na ordem em que foram apresentadas."
    )
    indice_ultima_pergunta_vista = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="Índice da Última Pergunta Vista",
        help_text="Índice (base 0) na lista 'IDs Ordenados das Perguntas da Sessão' que o usuário visualizou por último.",
        validators=[MinValueValidator(0)]
    )

    def clean(self):
        super().clean()
        if self.data_fim and self.data_inicio and self.data_fim < self.data_inicio:
            raise ValidationError({'data_fim': 'A data de fim não pode ser anterior à data de início.'})
        if self.total_acertos > self.total_perguntas_sessao:
            raise ValidationError({'total_acertos': 'O número de acertos não pode ser maior que o total de perguntas.'})
        if self.total_erros > self.total_perguntas_sessao:
            raise ValidationError({'total_erros': 'O número de erros não pode ser maior que o total de perguntas.'})
        
        # Validação de modo_quiz e id_quiz_definicao
        if self.modo_quiz == self.ModoQuiz.DEFINIDO and not self.id_quiz_definicao:
            raise ValidationError({'id_quiz_definicao': 'Um Quiz Pré-Definido deve ser selecionado para o modo "Definido".'})
        if self.modo_quiz != self.ModoQuiz.DEFINIDO and self.id_quiz_definicao:
            self.id_quiz_definicao = None # Garante que não haja quiz_definicao se não for modo 'Definido'
            # Ou raise ValidationError ... dependendo da sua preferência de UX no admin.
            # raise ValidationError({'id_quiz_definicao': 'Quiz Pré-Definido só deve ser associado a sessões do modo "Definido".'})

        # Validação do índice da última pergunta
        if self.ids_perguntas_json and self.indice_ultima_pergunta_vista is not None:
            if not isinstance(self.ids_perguntas_json, list):
                 raise ValidationError({'ids_perguntas_json': 'Deve ser uma lista de IDs de perguntas.'})
            if self.indice_ultima_pergunta_vista >= len(self.ids_perguntas_json):
                raise ValidationError({'indice_ultima_pergunta_vista': 'Índice fora do intervalo da lista de perguntas da sessão.'})

    @property
    def duracao_sessao_formatada(self):
        # ... (implementação existente) ...
        if self.tempo_total_segundos is not None and self.tempo_total_segundos >= 0:
            total_seconds = self.tempo_total_segundos
        elif self.data_fim and self.data_inicio:
            duracao = self.data_fim - self.data_inicio
            total_seconds = int(duracao.total_seconds())
        else:
            return "Em andamento"

        if total_seconds < 0: return "Inválida"

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
        # ... (implementação existente) ...
        if self.total_perguntas_sessao > 0:
            return round((self.total_acertos / self.total_perguntas_sessao) * 100, 1)
        return 0.0
    percentual_acertos.fget.short_description = "% Acertos"

    def __str__(self):
        username = self.id_usuario.get_username()
        quiz_info = self.id_quiz_definicao.nome_quiz if self.modo_quiz == self.ModoQuiz.DEFINIDO and self.id_quiz_definicao else self.modo_quiz
        return f"Sessão {self.pk} - {username} ({self.data_inicio.strftime('%d/%m/%y %H:%M')}) - {quiz_info}"

    class Meta:
        verbose_name = "Sessão de Quiz do Usuário"
        verbose_name_plural = "Sessões de Quiz dos Usuários"
        ordering = ['-data_inicio']


class RespostasUsuarioPorSessao(models.Model):
    """
    Registra a resposta específica de um usuário a uma pergunta dentro de uma sessão.
    """
    id_sessao_quiz = models.ForeignKey(
        SessoesQuizUsuario,
        on_delete=models.CASCADE,
        related_name="respostas_dadas",
        verbose_name="Sessão do Quiz"
    )
    id_pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name="respostas_dadas_em_sessoes",
        verbose_name="Pergunta"
    )
    id_opcao_resposta_selecionada = models.ForeignKey(
        OpcaoResposta,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vezes_selecionada_em_respostas", # Alterado para mais clareza
        verbose_name="Opção Selecionada"
    )
    foi_correta = models.BooleanField(
        null=True,
        blank=True,
        verbose_name="Foi Correta?",
        help_text="True se correta, False se incorreta, Nulo se pulada/não respondida."
    )
    data_resposta = models.DateTimeField(auto_now_add=True, verbose_name="Data da Resposta")

    def __str__(self):
        status_resposta = "Pulada/Não Avaliada"
        if self.id_opcao_resposta_selecionada:
            if self.foi_correta is True:
                status_resposta = "Correta"
            elif self.foi_correta is False:
                status_resposta = "Incorreta"
        return f"Resposta à P{self.id_pergunta.pk} na Sessão {self.id_sessao_quiz.pk}: {status_resposta}"

    class Meta:
        verbose_name = "Resposta do Usuário por Sessão"
        verbose_name_plural = "Respostas dos Usuários por Sessão"
        unique_together = ('id_sessao_quiz', 'id_pergunta')
        ordering = ['id_sessao_quiz', 'data_resposta']


class EstatisticasDiariasUsuario(models.Model):
    """
    Agrega estatísticas diárias de desempenho do usuário.
    """
    id_usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="estatisticas_diarias",
        verbose_name="Usuário"
    )
    data_estatistica = models.DateField(verbose_name="Data da Estatística")
    perguntas_respondidas_dia = models.IntegerField(default=0, verbose_name="Perguntas Respondidas", validators=[MinValueValidator(0)])
    acertos_dia = models.IntegerField(default=0, verbose_name="Acertos no Dia", validators=[MinValueValidator(0)])
    pontos_dia = models.IntegerField(default=0, verbose_name="Pontos Ganhos no Dia")
    sequencia_dias_quiz = models.IntegerField(default=0, verbose_name="Sequência de Dias Consecutivos de Quiz", validators=[MinValueValidator(0)])
    tempo_estudo_segundos_dia = models.IntegerField(default=0, verbose_name="Tempo de Estudo no Dia (segundos)", validators=[MinValueValidator(0)])
    data_atualizacao_estatistica = models.DateTimeField(auto_now=True, verbose_name="Última Atualização")

    def clean(self):
        super().clean()
        if self.acertos_dia > self.perguntas_respondidas_dia:
            raise ValidationError({'acertos_dia': 'O número de acertos não pode ser maior que o de perguntas respondidas.'})

    @property
    def tempo_estudo_formatado(self):
        # ... (implementação existente) ...
        if self.tempo_estudo_segundos_dia is not None and self.tempo_estudo_segundos_dia >= 0:
            total_seconds = self.tempo_estudo_segundos_dia
            hours, remainder = divmod(total_seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            if hours > 0:
                return f"{hours}h {minutes:02d}m"
            return f"{minutes}m"
        return "0m"
    tempo_estudo_formatado.fget.short_description = "Tempo de Estudo (Formatado)"

    @property
    def precisao_dia(self):
        # ... (implementação existente) ...
        if self.perguntas_respondidas_dia > 0:
            return round((self.acertos_dia / self.perguntas_respondidas_dia) * 100, 1)
        return 0.0
    precisao_dia.fget.short_description = "% Precisão no Dia"

    def __str__(self):
        username = self.id_usuario.get_username()
        return f"Estatísticas de {username} para {self.data_estatistica.strftime('%d/%m/%Y')}"

    class Meta:
        verbose_name = "Estatística Diária do Usuário"
        verbose_name_plural = "Estatísticas Diárias dos Usuários"
        unique_together = ('id_usuario', 'data_estatistica')
        ordering = ['id_usuario', '-data_estatistica']


class QuestaoFavorita(models.Model):
    """
    Registra as perguntas favoritadas por cada usuário.
    """
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='questoes_favoritas',
        verbose_name="Usuário"
    )
    pergunta = models.ForeignKey(
        Pergunta,
        on_delete=models.CASCADE,
        related_name='favoritada_por_usuarios', # Alterado para mais clareza
        verbose_name="Pergunta"
    )
    data_favoritada = models.DateTimeField(auto_now_add=True, verbose_name="Data de Inclusão nos Favoritos")

    class Meta:
        verbose_name = "Questão Favorita do Usuário"
        verbose_name_plural = "Questões Favoritas dos Usuários"
        unique_together = ('usuario', 'pergunta')
        ordering = ['-data_favoritada']

    def __str__(self):
        return f"'{self.pergunta.texto_pergunta[:30]}...' favorita de {self.usuario.username}"


class ConfiguracoesGeraisQuiz(models.Model):
    """
    Modelo Singleton para armazenar configurações globais do sistema de quiz,
    gerenciáveis pelo Admin do Django.
    """
    numero_perguntas_quiz_rapido = models.PositiveIntegerField(
        default=10,
        verbose_name="Nº de Perguntas Padrão (Quiz Rápido)",
        help_text="Quantidade padrão de perguntas para o modo 'Quiz Rápido', caso o usuário não especifique."
    )
    pontuacao_por_acerto = models.IntegerField(
        default=15,
        verbose_name="Pontos por Acerto",
        help_text="Número de pontos concedidos por cada resposta correta."
    )
    penalidade_por_erro = models.IntegerField(
        default=5,
        verbose_name="Penalidade por Erro",
        help_text="Número de pontos deduzidos por cada resposta incorreta (use 0 se não houver penalidade)."
    )
    # Adicione outros campos de configuração global aqui conforme necessário
    # Ex: permitir_pular_questoes = models.BooleanField(default=True, ...)
    # Ex: tempo_limite_padrao_quiz_minutos = models.PositiveIntegerField(default=30, ...)

    data_modificacao = models.DateTimeField(auto_now=True, verbose_name="Última Modificação")

    def __str__(self):
        return "Configurações Gerais do Quiz"

    def save(self, *args, **kwargs):
        # Garante que apenas uma instância deste modelo exista
        if not self.pk and ConfiguracoesGeraisQuiz.objects.exists():
            raise ValidationError('Só pode haver uma instância de ConfiguracoesGeraisQuiz. Edite a existente.')
        if self.penalidade_por_erro < 0:
            raise ValidationError({'penalidade_por_erro': 'A penalidade por erro não pode ser negativa.'})
        result = super().save(*args, **kwargs)
        try:
            from .views import invalidate_quiz_config_cache
            invalidate_quiz_config_cache()
        except ImportError:
            # Durante alguns fluxos de import (como migrações) as views podem não estar disponíveis.
            pass
        return result

    class Meta:
        verbose_name = "Configuração Geral do Quiz"
        verbose_name_plural = "Configurações Gerais do Quiz" # Embora seja singleton, o admin usa isso.