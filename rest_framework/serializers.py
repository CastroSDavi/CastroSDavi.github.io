"""Very small serializer abstraction built on top of Django forms."""

from django import forms


class ValidationError(Exception):
    """Exception raised when serializer data is invalid."""


class Serializer(forms.Form):
    """Serializer compatible API for the pieces used in the project."""

    def __init__(self, data=None, context=None, **kwargs):
        self.context = context or {}
        super().__init__(data=data, **kwargs)
        self.validated_data = {}

    def is_valid(self, *, raise_exception=False):
        valid = super().is_valid()
        if valid:
            self.validated_data = getattr(self, "cleaned_data", {})
        else:
            self.validated_data = {}
            if raise_exception:
                raise ValidationError(self.errors)
        return valid

    def save(self, **kwargs):
        if not hasattr(self, "validated_data"):
            raise AssertionError("You must call `.is_valid()` before calling `.save()`.")
        return self.validated_data
