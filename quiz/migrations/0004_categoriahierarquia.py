from django.db import migrations, models
import django.db.models.deletion


def populate_categoria_hierarquia(apps, schema_editor):
    Categoria = apps.get_model('quiz', 'Categoria')
    CategoriaHierarquia = apps.get_model('quiz', 'CategoriaHierarquia')

    CategoriaHierarquia.objects.all().delete()

    parent_map = dict(Categoria.objects.all().values_list('pk', 'id_categoria_pai_id'))
    registros = []
    for descendant_id in parent_map.keys():
        depth = 0
        current_id = descendant_id
        visited = set()
        while current_id is not None and current_id not in visited:
            visited.add(current_id)
            registros.append(CategoriaHierarquia(
                ancestor_id=current_id,
                descendant_id=descendant_id,
                depth=depth,
            ))
            depth += 1
            current_id = parent_map.get(current_id)

    if registros:
        CategoriaHierarquia.objects.bulk_create(registros, batch_size=1000)


def clear_categoria_hierarquia(apps, schema_editor):
    CategoriaHierarquia = apps.get_model('quiz', 'CategoriaHierarquia')
    CategoriaHierarquia.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0003_configuracoesgeraisquiz_quizdefinicao_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CategoriaHierarquia',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('depth', models.PositiveIntegerField()),
                ('ancestor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hierarquia_descendentes', to='quiz.categoria')),
                ('descendant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hierarquia_ancestrais', to='quiz.categoria')),
            ],
            options={
                'indexes': [
                    models.Index(
                        fields=['ancestor', 'descendant'],
                        name='categoriahierarquia_ancestor_descendant_idx',
                    ),
                    models.Index(
                        fields=['descendant', 'ancestor'],
                        name='categoriahierarquia_descendant_ancestor_idx',
                    ),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=('ancestor', 'descendant'), name='unique_categoriahierarquia_ancestor_descendant'),
                ],
            },
        ),
        migrations.RunPython(populate_categoria_hierarquia, clear_categoria_hierarquia),
    ]
