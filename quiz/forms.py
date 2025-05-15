# quiz/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User # Modelo de usuário padrão do Django

class CustomUserCreationForm(UserCreationForm):
    """
    Um formulário personalizado para criação de usuários, herdando do UserCreationForm padrão do Django,
    mas com a adição e personalização de campos como email, nome e sobrenome.
    """
    email = forms.EmailField(
        max_length=254, # Comprimento máximo padrão para emails
        required=True,  # Torna o campo de email obrigatório
        help_text='Obrigatório. Um endereço de email válido para contato e recuperação de senha.'
    )
    first_name = forms.CharField(
        max_length=150,
        required=False, # Nome não obrigatório, mas disponível
        label='Nome'    # Rótulo amigável para o template
    )
    last_name = forms.CharField(
        max_length=150,
        required=False, # Sobrenome não obrigatório
        label='Sobrenome' # Rótulo amigável
    )

    class Meta(UserCreationForm.Meta):
        model = User # Especifica que este formulário cria instâncias do modelo User
        # Define os campos que aparecerão no formulário, na ordem desejada.
        # Inclui os campos padrão do UserCreationForm (username, password1, password2)
        # e adiciona os novos campos (email, first_name, last_name).
        fields = ('username', 'email', 'first_name', 'last_name')

    def clean_email(self):
        """
        Método de validação específico para o campo de email.
        Verifica se o email fornecido já existe no banco de dados.
        """
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            # Se o email já existe, levanta um erro de validação.
            raise forms.ValidationError("Este endereço de email já está cadastrado. Por favor, utilize outro.")
        return email # Retorna o email limpo se for válido e único.