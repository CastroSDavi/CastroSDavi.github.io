"""Minimal subset of Django REST framework required for the project tests."""

from . import serializers, viewsets, status  # noqa: F401
from .decorators import action  # noqa: F401
from .response import Response  # noqa: F401
from .routers import DefaultRouter  # noqa: F401

__all__ = [
    "serializers",
    "viewsets",
    "status",
    "Response",
    "DefaultRouter",
    "action",
]
