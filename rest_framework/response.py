"""Lightweight Response object compatible with JsonResponse."""

from django.http import JsonResponse


class Response(JsonResponse):
    def __init__(self, data=None, status=200, headers=None, safe=None):
        if safe is None:
            safe = not isinstance(data, list)
        super().__init__(data=data, status=status, safe=safe)
        headers = headers or {}
        for key, value in headers.items():
            self[key] = value
