from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from quiz.models import UserPreferences


class UserPreferencesSignalTests(TestCase):
    def test_preferences_created_when_user_is_created(self):
        user = User.objects.create_user(username='alice', password='test123', email='alice@example.com')
        self.assertTrue(UserPreferences.objects.filter(user=user).exists())


class AccountPreferencesViewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bob', password='secret123', email='bob@example.com')
        self.client.login(username='bob', password='secret123')

    def test_account_view_includes_preferences_context(self):
        response = self.client.get(reverse('quiz:account'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('preferences_form', response.context)
        self.assertIn('user_preferences', response.context)
        self.assertIn('theme_options', response.context)
        self.assertIn('selected_theme', response.context)
        self.assertEqual(
            response.context['selected_theme'],
            response.context['user_preferences'].theme_preference,
        )
        self.assertTrue(
            any(
                option['value'] == UserPreferences.ThemePreference.LIGHT
                for option in response.context['theme_options']
            )
        )

    def test_update_preferences_successfully_updates_record(self):
        url = reverse('quiz:update_preferences')
        response = self.client.post(url, {
            'theme_preference': UserPreferences.ThemePreference.DARK,
            'receive_progress_reports': 'on',
        })
        self.assertRedirects(response, reverse('quiz:account') + '#preferences')

        preferences = UserPreferences.objects.get(user=self.user)
        self.assertEqual(preferences.theme_preference, UserPreferences.ThemePreference.DARK)
        self.assertTrue(preferences.receive_progress_reports)
        self.assertFalse(preferences.receive_product_updates)

    def test_update_preferences_invalid_theme_renders_errors(self):
        url = reverse('quiz:update_preferences')
        response = self.client.post(url, {
            'theme_preference': 'invalid-theme',
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('preferences_form', response.context)
        self.assertTrue(response.context['preferences_form'].errors)
        self.assertEqual(response.context.get('active_tab_on_error'), 'preferences-content')
