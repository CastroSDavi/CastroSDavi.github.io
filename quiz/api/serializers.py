"""Serializers encapsulating validation for quiz API endpoints."""

from rest_framework import serializers


class QuizDataQuerySerializer(serializers.Serializer):
    category_ids = serializers.CharField(required=False, allow_blank=True)
    difficulty_levels = serializers.CharField(required=False, allow_blank=True)
    mode = serializers.CharField(required=False, allow_blank=True)
    count = serializers.CharField(required=False, allow_blank=True)
    num_questions = serializers.CharField(required=False, allow_blank=True)
    quiz_definicao_id = serializers.IntegerField(required=False)
    search_query = serializers.CharField(required=False, allow_blank=True)


class FilteredQuestionCountSerializer(serializers.Serializer):
    category_ids = serializers.CharField(required=False, allow_blank=True)
    difficulty_levels = serializers.CharField(required=False, allow_blank=True)
    search_query = serializers.CharField(required=False, allow_blank=True)


class StartQuizSessionSerializer(serializers.Serializer):
    modo_quiz = serializers.CharField(required=True, allow_blank=False)
    categoria_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        allow_null=True,
        default=list,
    )
    question_ids_in_session = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=False,
    )
    quiz_definicao_id = serializers.IntegerField(required=False, allow_null=True)
    dificuldades_selecionadas = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        allow_null=True,
    )
    num_questoes_solicitadas = serializers.IntegerField(required=False, allow_null=True)

    def validate_categoria_ids(self, value):
        if value in (None, ''):
            return []
        return value

    def validate_question_ids_in_session(self, value):
        if not value:
            raise serializers.ValidationError(
                'question_ids_in_session deve conter ao menos um ID de pergunta.'
            )
        return value

    def validate_dificuldades_selecionadas(self, value):
        if value in (None, ''):
            return None
        return value


class RegisterAnswerSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(required=True)
    pergunta_id = serializers.IntegerField(required=True)
    opcao_id = serializers.IntegerField(required=False, allow_null=True)
    current_question_index = serializers.IntegerField(required=False, allow_null=True)


class EndQuizSessionSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(required=True)
    tempo_total_segundos = serializers.IntegerField(required=False, allow_null=True)


class StatisticsQuerySerializer(serializers.Serializer):
    period = serializers.CharField(required=False, allow_blank=True)


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
