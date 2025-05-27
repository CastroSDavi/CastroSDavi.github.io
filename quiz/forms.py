# quiz/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm, PasswordChangeForm
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _ # For translation

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
        label='Email'
    )
    first_name = forms.CharField(
        max_length=150,
        required=True,
        label='Nome'
    )
    last_name = forms.CharField(
        max_length=150,
        required=True,
        label='Sobrenome'
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'first_name', 'last_name', 'email')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        common_input_attrs = {'class': 'form-control'}
        self.fields['username'].widget.attrs.update({**common_input_attrs, 'placeholder': 'Seu nome de usuário'})
        self.fields['first_name'].widget.attrs.update({**common_input_attrs, 'placeholder': 'Primeiro nome'})
        self.fields['last_name'].widget.attrs.update({**common_input_attrs, 'placeholder': 'Sobrenome'})
        self.fields['email'].widget.attrs.update({**common_input_attrs, 'placeholder': 'seuemail@exemplo.com'})
        self.fields['password1'].widget.attrs.update({**common_input_attrs, 'placeholder': 'Mínimo 8 caracteres'})
        self.fields['password2'].widget.attrs.update({**common_input_attrs, 'placeholder': 'Repita a senha'})

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise forms.ValidationError("Este endereço de email já está cadastrado. Por favor, utilize outro.")
        return email

class UserUpdateForm(forms.ModelForm):
    email = forms.EmailField(
        max_length=254,
        required=True,
        label='Email',
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Seu email'})
    )
    first_name = forms.CharField(
        max_length=150,
        required=False,
        label='Nome',
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Primeiro nome'})
    )
    last_name = forms.CharField(
        max_length=150,
        required=False,
        label='Sobrenome',
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Sobrenome'})
    )

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exclude(pk=self.instance.pk).exists():
            raise forms.ValidationError(_("Este endereço de email já está em uso por outro usuário."))
        return email

class AccountDeleteForm(forms.Form):
    password = forms.CharField(
        label=_("Senha Atual"),
        strip=False,
        widget=forms.PasswordInput(attrs={'autocomplete': 'current-password', 'class': 'form-control', 'placeholder': 'Confirme sua senha atual'}),
    )

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_password(self):
        password = self.cleaned_data.get("password")
        if not self.user.check_password(password):
            raise forms.ValidationError(
                _("Sua senha está incorreta. Por favor, tente novamente."),
                code='password_incorrect',
            )
        return password

# Formulário de Alteração de Senha Customizado
class CustomPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Aplicando classes e placeholders para consistência visual
        # Os nomes dos campos (old_password, new_password1, new_password2) são definidos pelo PasswordChangeForm base do Django.
        self.fields['old_password'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Sua senha atual'}
        )
        self.fields['new_password1'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Nova senha (mínimo 8 caracteres)'} # O help_text já informa sobre a validação
        )
        self.fields['new_password2'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Confirme a nova senha'}
        )
        # Opcional: Ajustar labels se necessário, embora os padrões do Django sejam geralmente bons.
        # self.fields['old_password'].label = _("Senha Antiga")
        # self.fields['new_password1'].label = _("Nova Senha")
        # self.fields['new_password2'].label = _("Confirmação da Nova Senha")