"""Serializers encapsulating validation for quiz API endpoints."""

from django import forms

from rest_framework import serializers


class QuizDataQuerySerializer(serializers.Serializer):
    category_ids = forms.CharField(required=False)
    difficulty_levels = forms.CharField(required=False)
    mode = forms.CharField(required=False)
    count = forms.CharField(required=False)
    num_questions = forms.CharField(required=False)
    quiz_definicao_id = forms.IntegerField(required=False)
    search_query = forms.CharField(required=False)


class FilteredQuestionCountSerializer(serializers.Serializer):
    category_ids = forms.CharField(required=False)
    difficulty_levels = forms.CharField(required=False)
    search_query = forms.CharField(required=False)


class StartQuizSessionSerializer(serializers.Serializer):
    modo_quiz = forms.CharField(required=True)
    categoria_ids = forms.JSONField(required=False)
    question_ids_in_session = forms.JSONField(required=True)
    quiz_definicao_id = forms.IntegerField(required=False)
    dificuldades_selecionadas = forms.JSONField(required=False)
    num_questoes_solicitadas = forms.IntegerField(required=False)

    def clean_categoria_ids(self):
        categoria_ids = self.cleaned_data.get('categoria_ids', [])
        if categoria_ids in (None, ''):
            return []
        if not isinstance(categoria_ids, list):
            raise forms.ValidationError('categoria_ids deve ser uma lista.')
        return categoria_ids

    def clean_question_ids_in_session(self):
        question_ids = self.cleaned_data['question_ids_in_session']
        if not isinstance(question_ids, list) or not all(isinstance(qid, int) for qid in question_ids):
            raise forms.ValidationError('question_ids_in_session deve ser uma lista de inteiros.')
        return question_ids

    def clean_dificuldades_selecionadas(self):
        dificuldades = self.cleaned_data.get('dificuldades_selecionadas')
        if dificuldades in (None, ''):
            return None
        if not isinstance(dificuldades, list):
            raise forms.ValidationError('dificuldades_selecionadas deve ser uma lista.')
        return dificuldades


class RegisterAnswerSerializer(serializers.Serializer):
    session_id = forms.IntegerField(required=True)
    pergunta_id = forms.IntegerField(required=True)
    opcao_id = forms.IntegerField(required=False)
    current_question_index = forms.IntegerField(required=False)


class EndQuizSessionSerializer(serializers.Serializer):
    session_id = forms.IntegerField(required=True)
    tempo_total_segundos = forms.IntegerField(required=False)


class StatisticsQuerySerializer(serializers.Serializer):
    period = forms.CharField(required=False)


class UserQuestionHistoryQuerySerializer(serializers.Serializer):
    """Validates filters applied to the question history endpoint."""

    session_id = serializers.IntegerField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                'end_date': 'A data final deve ser igual ou posterior à data inicial.'
            })

        return attrs
