from django.db import migrations, models
from django.utils.text import slugify


def generate_question_slugs(apps, schema_editor):
    Pergunta = apps.get_model('quiz', 'Pergunta')
    for question in Pergunta.objects.all():
        base_slug = slugify(question.texto_pergunta or '') or 'pergunta'
        base_slug = base_slug[:200].strip('-') or 'pergunta'
        slug_candidate = base_slug
        suffix = 2
        while Pergunta.objects.filter(slug=slug_candidate).exclude(pk=question.pk).exists():
            suffix_fragment = f'-{suffix}'
            available_length = 255 - len(suffix_fragment)
            slug_candidate = f"{base_slug[:available_length]}{suffix_fragment}"
            suffix += 1
        question.slug = slug_candidate
        question.save(update_fields=['slug'])


def update_home_urls(apps, schema_editor):
    HomePageSettings = apps.get_model('quiz', 'HomePageSettings')
    HomeRecentSessionCardSettings = apps.get_model('quiz', 'HomeRecentSessionCardSettings')
    HomeHeroCTA = apps.get_model('quiz', 'HomeHeroCTA')
    HomeQuickLink = apps.get_model('quiz', 'HomeQuickLink')

    hub_root = '/hub/'
    legacy_root = '/questions/'

    settings = HomePageSettings.objects.first()
    if settings and settings.intro_secondary_cta_url in {legacy_root, f'{legacy_root}#hub-predefined-section'}:
        new_value = hub_root if settings.intro_secondary_cta_url == legacy_root else f'{hub_root}#hub-predefined-section'
        settings.intro_secondary_cta_url = new_value
        settings.save(update_fields=['intro_secondary_cta_url'])

    session_card = HomeRecentSessionCardSettings.objects.first()
    if session_card and session_card.cta_url == legacy_root:
        session_card.cta_url = hub_root
        session_card.save(update_fields=['cta_url'])

    for cta in HomeHeroCTA.objects.all():
        if cta.url and cta.url.startswith(legacy_root):
            cta.url = cta.url.replace(legacy_root, hub_root, 1)
            cta.save(update_fields=['url'])

    for quick_link in HomeQuickLink.objects.all():
        if quick_link.url and quick_link.url.startswith(legacy_root):
            quick_link.url = quick_link.url.replace(legacy_root, hub_root, 1)
            quick_link.save(update_fields=['url'])


def noop(apps, schema_editor):
    """Migration reversal is intentionally left as a no-op."""


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0022_populate_home_challenge_card_defaults'),
    ]

    operations = [
        migrations.AddField(
            model_name='pergunta',
            name='slug',
            field=models.SlugField(
                blank=True,
                max_length=255,
                null=True,
                unique=True,
                help_text='Identificador único e legível usado para construir URLs públicas da questão.',
                verbose_name='Slug da Pergunta',
            ),
        ),
        migrations.RunPython(generate_question_slugs, reverse_code=noop),
        migrations.AlterField(
            model_name='pergunta',
            name='slug',
            field=models.SlugField(
                blank=True,
                max_length=255,
                unique=True,
                help_text='Identificador único e legível usado para construir URLs públicas da questão.',
                verbose_name='Slug da Pergunta',
            ),
        ),
        migrations.AlterField(
            model_name='homepagesettings',
            name='intro_secondary_cta_url',
            field=models.CharField(
                default='/hub/',
                help_text='URL relativa ou absoluta para o CTA secundário do card de passos.',
                max_length=255,
            ),
        ),
        migrations.AlterField(
            model_name='homerecentsessioncardsettings',
            name='cta_url',
            field=models.CharField(default='/hub/', max_length=255),
        ),
        migrations.RunPython(update_home_urls, reverse_code=noop),
    ]
