"""Simplified ViewSet implementation used for routing actions."""

from django.http import HttpResponseNotAllowed
from django.views import View


class ViewSet(View):
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options", "trace"]
    lookup_field = "pk"
    lookup_value_regex = "[^/]+"

    @classmethod
    def as_view(cls, actions=None, **initkwargs):
        if actions is None or not actions:
            raise TypeError("`actions` must be provided when calling `.as_view()` on a ViewSet")
        actions = {method.lower(): name for method, name in actions.items()}

        def view(request, *args, **kwargs):
            self = cls(**initkwargs)
            self.action_map = actions
            method = request.method.lower()
            if method not in actions:
                return HttpResponseNotAllowed([m.upper() for m in actions])
            handler = getattr(self, actions[method])
            self.request = request
            self.args = args
            self.kwargs = kwargs
            self.action = actions[method]
            return handler(request, *args, **kwargs)

        view.view_class = cls
        view.cls = cls
        view.actions = actions
        view.initkwargs = initkwargs
        return view

    @classmethod
    def get_extra_actions(cls):
        actions = []
        for attr in dir(cls):
            method = getattr(cls, attr)
            if callable(method) and hasattr(method, "bind_to_methods"):
                actions.append(method)
        return actions
