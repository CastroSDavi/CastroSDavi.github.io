from django.db import models

# quiz/models.py
from django.db import models

class Categoria(models.Model):
    # id_categoria (será o id/pk automático do Django)
    nome_categoria = models.CharField(max_length=200)
    # id_categoria_pai será um ForeignKey para Categoria (self)
    # Permitimos que seja nulo para categorias raiz
    id_categoria_pai = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='subcategorias')
    descricao_categoria = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nome_categoria

    class Meta:
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"

class Pergunta(models.Model):
    # id_pergunta (será o id/pk automático do Django)
    texto_pergunta = models.TextField()
    url_imagem = models.URLField(max_length=500, blank=True, null=True) # Aumentado max_length
    referencia_bibliografica = models.CharField(max_length=200, blank=True, null=True)
    # categoria_ids será uma relação ManyToManyField com Categoria
    categorias = models.ManyToManyField(Categoria, related_name='perguntas')
    nivel_dificuldade = models.CharField(max_length=50, choices=[
        ('Fácil', 'Fácil'),
        ('Médio', 'Médio'),
        ('Difícil', 'Difícil'),
    ], default='Fácil')
    # Adicionaremos campos que estão faltando do seu JSON, como explicacao_resposta, se necessário
    explicacao_resposta = models.TextField(blank=True, null=True, help_text="Explicação geral da resposta correta.")


    def __str__(self):
        return f"ID {self.pk}: {self.texto_pergunta[:50]}..." # Mostra os primeiros 50 caracteres

    class Meta:
        verbose_name = "Pergunta"
        verbose_name_plural = "Perguntas"

class OpcaoResposta(models.Model):
    # id_opcao_resposta (será o id/pk automático do Django)
    # id_pergunta será um ForeignKey para Pergunta
    pergunta = models.ForeignKey(Pergunta, related_name='opcoes', on_delete=models.CASCADE)
    texto_opcao = models.CharField(max_length=500) # Aumentado max_length
    eh_correta = models.BooleanField(default=False)
    ordem_exibicao = models.PositiveIntegerField(default=0, help_text="Usado para ordenar as opções, se necessário.")
    feedback_opcao = models.TextField(blank=True, null=True, help_text="Feedback específico para esta opção.")


    def __str__(self):
        return f"Opção para Pergunta ID {self.pergunta.pk}: {self.texto_opcao[:50]}..."

    class Meta:
        verbose_name = "Opção de Resposta"
        verbose_name_plural = "Opções de Resposta"
        ordering = ['pergunta', 'ordem_exibicao'] # Ordena por pergunta e depois pela ordem de exibição