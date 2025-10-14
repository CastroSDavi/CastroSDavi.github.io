from django.db import migrations


def update_training_mode_colors(apps, schema_editor):
    TrainingMode = apps.get_model('quiz', 'TrainingMode')

    new_colors = {
        'modo-revisao-inteligente': '#4b6fa9',
        'modo-blitz-diagnostica': '#d9824b',
    }

    for slug, color in new_colors.items():
        try:
            mode = TrainingMode.objects.get(slug=slug)
        except TrainingMode.DoesNotExist:
            continue
        mode.accent_color = color
        mode.save(update_fields=['accent_color'])


def revert_training_mode_colors(apps, schema_editor):
    TrainingMode = apps.get_model('quiz', 'TrainingMode')

    previous_colors = {
        'modo-revisao-inteligente': '#5d8dee',
        'modo-blitz-diagnostica': '#f28a2b',
    }

    for slug, color in previous_colors.items():
        try:
            mode = TrainingMode.objects.get(slug=slug)
        except TrainingMode.DoesNotExist:
            continue
        mode.accent_color = color
        mode.save(update_fields=['accent_color'])


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0032_questionissuereport_categoria'),
    ]

    operations = [
        migrations.RunPython(
            update_training_mode_colors,
            revert_training_mode_colors,
        ),
    ]
