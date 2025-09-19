"""Router that mirrors a very small portion of DRF's DefaultRouter."""

from django.urls import re_path


class DefaultRouter:
    def __init__(self):
        self.registry = []

    def register(self, prefix, viewset, basename=None):
        cleaned_prefix = prefix.strip('/')
        self.registry.append((cleaned_prefix, viewset, basename or cleaned_prefix.replace('/', '-')))

    @property
    def urls(self):
        urlpatterns = []
        for prefix, viewset, basename in self.registry:
            lookup_field = getattr(viewset, 'lookup_field', 'pk')
            lookup_regex = getattr(viewset, 'lookup_value_regex', '[^/]+')

            base_mapping = {}
            if hasattr(viewset, 'list'):
                base_mapping['get'] = 'list'
            if hasattr(viewset, 'create'):
                base_mapping['post'] = 'create'
            if base_mapping:
                urlpatterns.append(
                    re_path(rf'^{prefix}/$', viewset.as_view(base_mapping), name=f'{basename}-list')
                )

            for action in viewset.get_extra_actions():
                methods = getattr(action, 'bind_to_methods', ['get'])
                mapping = {method: action.__name__ for method in methods}
                url_path = getattr(action, 'url_path', action.__name__.replace('_', '-'))
                url_name = getattr(action, 'url_name', url_path)
                if getattr(action, 'detail', False):
                    route = rf'^{prefix}/(?P<{lookup_field}>{lookup_regex})/{url_path}/$'
                else:
                    route = rf'^{prefix}/{url_path}/$'
                urlpatterns.append(
                    re_path(route, viewset.as_view(mapping), name=f'{basename}-{url_name}')
                )
        return urlpatterns
