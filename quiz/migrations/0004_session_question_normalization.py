from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


def forwards_populate_session_questions(apps, schema_editor):
    Sessao = apps.get_model('quiz', 'SessoesQuizUsuario')
    SessaoPergunta = apps.get_model('quiz', 'SessaoQuizPergunta')
    Resposta = apps.get_model('quiz', 'RespostasUsuarioPorSessao')

    batch_size = 500

    for sessao in Sessao.objects.iterator():
        pergunta_ids = getattr(sessao, 'ids_perguntas_json', None)
        if not isinstance(pergunta_ids, list) or not pergunta_ids:
            continue

        registros = []
        for ordem, pergunta_id in enumerate(pergunta_ids):
            if pergunta_id is None:
                continue
            registros.append(SessaoPergunta(
                sessao_id=sessao.pk,
                pergunta_id=pergunta_id,
                ordem=ordem,
            ))

        if registros:
            SessaoPergunta.objects.bulk_create(registros)

        mapping = {
            item.pergunta_id: item.id
            for item in SessaoPergunta.objects.filter(sessao_id=sessao.pk)
        }

        if mapping:
            resposta_ids = []
            queryset = Resposta.objects.filter(
                id_sessao_quiz_id=sessao.pk,
                sessao_pergunta__isnull=True,
                id_pergunta_id__in=list(mapping.keys())
            ).only('pk', 'id_pergunta_id')

            for resposta in queryset.iterator():
                sessao_pergunta_id = mapping.get(resposta.id_pergunta_id)
                if sessao_pergunta_id:
                    resposta_ids.append((resposta.pk, sessao_pergunta_id))

            for slice_start in range(0, len(resposta_ids), batch_size):
                slice_end = slice_start + batch_size
                for pk, sessao_pergunta_id in resposta_ids[slice_start:slice_end]:
                    Resposta.objects.filter(pk=pk).update(sessao_pergunta_id=sessao_pergunta_id)

        total_registros = SessaoPergunta.objects.filter(sessao_id=sessao.pk).count()
        if total_registros and sessao.total_perguntas_sessao != total_registros:
            Sessao.objects.filter(pk=sessao.pk).update(total_perguntas_sessao=total_registros)

        indice = sessao.indice_ultima_pergunta_vista
        if indice is not None:
            if total_registros == 0:
                Sessao.objects.filter(pk=sessao.pk).update(indice_ultima_pergunta_vista=None)
            elif indice >= total_registros:
                novo_indice = max(total_registros - 1, 0)
                Sessao.objects.filter(pk=sessao.pk).update(indice_ultima_pergunta_vista=novo_indice)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0003_configuracoesgeraisquiz_quizdefinicao_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SessaoQuizPergunta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(0)], verbose_name='Ordem na Sessao')),
                ('pergunta', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='instancias_em_sessoes', to='quiz.pergunta', verbose_name='Pergunta')),
                ('sessao', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='perguntas_da_sessao', to='quiz.sessoesquizusuario', verbose_name='Sessao')),
            ],
            options={
                'verbose_name': 'Pergunta da Sessao',
                'verbose_name_plural': 'Perguntas da Sessao',
                'ordering': ['sessao', 'ordem'],
            },
        ),
        migrations.AddField(
            model_name='respostasusuarioporsessao',
            name='sessao_pergunta',
            field=models.OneToOneField(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='resposta', to='quiz.sessaoquizpergunta', verbose_name='Registro da Pergunta na Sessao'),
        ),
        migrations.AddConstraint(
            model_name='sessaoquizpergunta',
            constraint=models.UniqueConstraint(fields=('sessao', 'ordem'), name='quiz_sessao_ordem_unica'),
        ),
        migrations.RunPython(forwards_populate_session_questions, noop_reverse),
        migrations.RemoveField(
            model_name='sessoesquizusuario',
            name='ids_perguntas_json',
        ),
    ]



