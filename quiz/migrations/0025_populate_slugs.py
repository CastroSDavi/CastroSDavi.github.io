import uuid

from django.db import migrations
from django.db.models import Q
from django.utils.text import slugify


def _generate_slug(model, instance, base_value: str, *, slug_field: str, default_prefix: str, max_length: int) -> str:
    base_slug = slugify(base_value or '')[:max_length].strip('-')
    if not base_slug:
        base_slug = f"{slugify(default_prefix) or default_prefix}-{uuid.uuid4().hex[:6]}"

    slug_candidate = base_slug
    counter = 2
    lookup_kwargs = {slug_field: slug_candidate}
    queryset = model.objects.exclude(pk=instance.pk)
    while queryset.filter(**lookup_kwargs).exists():
        suffix = f"-{counter}"
        slug_candidate = f"{base_slug[: max_length - len(suffix)]}{suffix}"
        lookup_kwargs[slug_field] = slug_candidate
        counter += 1
    return slug_candidate


def populate_slugs(apps, schema_editor):
    Pergunta = apps.get_model('quiz', 'Pergunta')
    QuizDefinicao = apps.get_model('quiz', 'QuizDefinicao')

    for question in Pergunta.objects.filter(Q(slug__isnull=True) | Q(slug='')):
        base = (question.texto_pergunta or '')[:140] or question.codigo_importacao or ''
        question.slug = _generate_slug(Pergunta, question, base, slug_field='slug', default_prefix='pergunta', max_length=220)
        question.save(update_fields=['slug'])

    for quiz in QuizDefinicao.objects.filter(Q(slug__isnull=True) | Q(slug='')):
        quiz.slug = _generate_slug(QuizDefinicao, quiz, quiz.nome_quiz, slug_field='slug', default_prefix='quiz', max_length=180)
        quiz.save(update_fields=['slug'])


def revert_slugs(apps, schema_editor):
    Pergunta = apps.get_model('quiz', 'Pergunta')
    QuizDefinicao = apps.get_model('quiz', 'QuizDefinicao')
    Pergunta.objects.update(slug=None)
    QuizDefinicao.objects.update(slug=None)


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0024_pergunta_slug_quizdefinicao_slug'),
    ]

    operations = [
        migrations.RunPython(populate_slugs, reverse_code=revert_slugs),
    ]
