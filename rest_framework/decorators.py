"""Decorators mimicking DRF's action helper."""

from functools import wraps


def action(detail=False, methods=None, url_path=None, url_name=None):
    methods = [method.lower() for method in (methods or ["get"])]

    def decorator(func):
        configured_url_path = url_path or func.__name__.replace("_", "-")
        configured_url_name = url_name or configured_url_path

        @wraps(func)
        def wrapped(*args, **kwargs):
            return func(*args, **kwargs)

        wrapped.bind_to_methods = methods
        wrapped.detail = detail
        wrapped.url_path = configured_url_path
        wrapped.url_name = configured_url_name
        return wrapped

    return decorator
