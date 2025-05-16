# quiz/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User

class CustomAuthenticationForm(AuthenticationForm):
    """
    Formulário de autenticação personalizado para adicionar classes CSS aos campos.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Usuário'}
        )
        self.fields['password'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Senha'}
        )

class CustomUserCreationForm(UserCreationForm):
    """
    Um formulário personalizado para criação de usuários.
    """
    email = forms.EmailField(
        max_length=254,
        required=True,
        help_text='Obrigatório. Um endereço de email válido.',
        label='Email' # Adicionado Label
    )
    first_name = forms.CharField(
        max_length=150,
        required=True, # Alterado para True como no seu HTML
        label='Nome'
    )
    last_name = forms.CharField(
        max_length=150,
        required=True, # Alterado para True como no seu HTML
        label='Sobrenome'
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'first_name', 'last_name', 'email') # Ordem como no seu HTML
        # Removido 'password1' e 'password2' de fields, pois UserCreationForm já os inclui.

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Atributos comuns para os campos de texto e email
        common_input_attrs = {'class': 'form-control'}

        self.fields['username'].widget.attrs.update({
            **common_input_attrs,
            'placeholder': 'Seu nome de usuário'
        })
        self.fields['first_name'].widget.attrs.update({
            **common_input_attrs,
            'placeholder': 'Primeiro nome'
        })
        self.fields['last_name'].widget.attrs.update({
            **common_input_attrs,
            'placeholder': 'Sobrenome'
        })
        self.fields['email'].widget.attrs.update({
            **common_input_attrs,
            'placeholder': 'seuemail@exemplo.com'
        })

        # Para os campos de senha (password1 e password2 são os nomes internos no UserCreationForm)
        self.fields['password1'].widget.attrs.update({
            **common_input_attrs,
            'placeholder': 'Mínimo 6 caracteres' # Ou o help_text padrão se preferir
        })
        # O label padrão para password1 já é "Senha", se quiser alterar:
        # self.fields['password1'].label = "Senha"

        self.fields['password2'].widget.attrs.update({
            **common_input_attrs,
            'placeholder': 'Repita a senha'
        })
        # O label padrão para password2 já é "Confirmação de senha", se quiser alterar:
        # self.fields['password2'].label = "Confirmar Senha"

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise forms.ValidationError("Este endereço de email já está cadastrado. Por favor, utilize outro.")
        return email