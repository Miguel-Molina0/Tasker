import base64
import importlib.util
import os
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

from cloudinary import utils
from cloudinary.exceptions import AuthorizationRequired, Error, NotFound
from django.conf import settings
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .cloudinary_storage import CloudinaryMediaStorage
from .models import Usuario


CLOUDINARY_SETTINGS = {
    'CLOUDINARY_CLOUD_NAME': 'test-cloud',
    'CLOUDINARY_API_KEY': 'test-api-key',
    'CLOUDINARY_API_SECRET': 'test-api-secret',
    'STORAGES': {
        'default': {'BACKEND': 'core.cloudinary_storage.CloudinaryMediaStorage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    },
}


@override_settings(**CLOUDINARY_SETTINGS)
class CloudinaryStorageTests(SimpleTestCase):
    def setUp(self):
        self.storage = CloudinaryMediaStorage()

    def test_signed_image_url_expires_without_exposing_secret(self):
        with patch('core.cloudinary_storage.time.time', return_value=1800000000):
            url = self.storage.url('tasker/perfis/photo.png')
        parsed = urlparse(url)
        params = {key: value[0] for key, value in parse_qs(parsed.query).items()}
        self.assertEqual(parsed.scheme, 'https')
        self.assertEqual(parsed.netloc, 'api.cloudinary.com')
        self.assertEqual(parsed.path, '/v1_1/test-cloud/image/download')
        self.assertEqual(params['type'], 'authenticated')
        self.assertEqual(params['public_id'], 'tasker/perfis/photo')
        self.assertEqual(params['format'], 'png')
        self.assertEqual(params['attachment'], '0')
        self.assertEqual(params['expires_at'], '1800003600')
        signature = params.pop('signature')
        params.pop('api_key')
        self.assertEqual(signature, utils.api_sign_request(params, 'test-api-secret'))
        self.assertNotIn('test-api-secret', url)

    @patch('core.cloudinary_storage.uploader.upload', side_effect=Error('Upload unavailable'))
    def test_upload_failure_is_not_reported_as_a_saved_photo(self, upload):
        with self.assertRaises(Error):
            self.storage.save('perfis/photo.png', ContentFile(b'image'))

    @patch('core.cloudinary_storage.api.resource')
    def test_exists_only_treats_not_found_as_missing(self, resource):
        resource.side_effect = NotFound('Missing')
        self.assertFalse(self.storage.exists('tasker/perfis/photo.png'))
        resource.side_effect = AuthorizationRequired('Invalid key')
        with self.assertRaises(AuthorizationRequired):
            self.storage.exists('tasker/perfis/photo.png')

    @patch('core.cloudinary_storage.requests.get')
    def test_open_reads_remote_content_and_reports_missing_photo(self, get):
        get.return_value = Mock(status_code=200, content=b'image contents')
        self.assertEqual(self.storage.open('tasker/perfis/photo.png').read(), b'image contents')
        get.return_value = Mock(status_code=404)
        with self.assertRaises(FileNotFoundError):
            self.storage.open('tasker/perfis/missing.png')


@override_settings(**CLOUDINARY_SETTINGS)
class ProfilePhotoStorageTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_user(username='photo-user', nr_cpf='52998224725')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        image = BytesIO()
        Image.new('RGB', (2, 2), color='blue').save(image, format='PNG')
        self.image = 'data:image/png;base64,' + base64.b64encode(image.getvalue()).decode()

    @patch('core.cloudinary_storage.uploader.destroy')
    @patch('core.cloudinary_storage.uploader.upload')
    def test_existing_profile_api_uploads_private_images_without_overwriting(self, upload, destroy):
        upload.side_effect = lambda content, **options: {
            'public_id': options['public_id'], 'format': 'png',
        }
        names = []
        for _ in range(2):
            response = self.client.patch('/api/usuarios/me/', {'tp_foto': self.image}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.user.refresh_from_db()
            names.append(self.user.tp_foto.name)
            self.assertTrue(names[-1].startswith('tasker/perfis/'))
            self.assertLessEqual(len(names[-1]), Usuario._meta.get_field('tp_foto').max_length)
            params = parse_qs(urlparse(response.data['tp_foto']).query)
            self.assertEqual(params['type'], ['authenticated'])
            self.assertIn('expires_at', params)
            self.assertEqual(params['public_id'], [names[-1].removesuffix('.png')])
            self.assertNotIn('test-api-secret', str(response.data))
        self.assertNotEqual(*names)
        for call in upload.call_args_list:
            self.assertEqual(call.kwargs['type'], 'authenticated')
            self.assertEqual(call.kwargs['resource_type'], 'image')
            self.assertFalse(call.kwargs['overwrite'])
        public_profile = APIClient().get(f'/api/perfis/{self.user.pk}/')
        self.assertEqual(public_profile.status_code, 200)
        self.assertEqual(parse_qs(urlparse(public_profile.data['tp_foto']).query)['type'], ['authenticated'])
        self.user.tp_foto.delete()
        self.user.refresh_from_db()
        self.assertFalse(self.user.tp_foto)
        self.assertEqual(destroy.call_args.args[0], names[-1].removesuffix('.png'))
        self.assertEqual(destroy.call_args.kwargs['type'], 'authenticated')
        self.assertTrue(destroy.call_args.kwargs['invalidate'])

    def test_local_development_can_save_and_serve_profile_photo_without_cloud_credentials(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as media_root, override_settings(
            MEDIA_ROOT=media_root,
            STORAGES={
                'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
                'staticfiles': CLOUDINARY_SETTINGS['STORAGES']['staticfiles'],
            },
        ):
            response = self.client.patch('/api/usuarios/me/', {'tp_foto': self.image}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.user.refresh_from_db()
            self.assertTrue(Path(self.user.tp_foto.path).is_file())
            self.assertTrue(response.data['tp_foto'].startswith('http://testserver/media/perfis/'))


class StorageConfigurationTests(SimpleTestCase):
    def load_settings(self, **environ):
        spec = importlib.util.spec_from_file_location('storage_test_settings', settings.BASE_DIR / 'setup/settings.py')
        module = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, environ, clear=True), patch('dotenv.load_dotenv'):
            spec.loader.exec_module(module)
        return module

    def test_debug_without_cloud_credentials_uses_local_storage(self):
        config = self.load_settings(DEBUG='true')
        self.assertEqual(config.STORAGES['default']['BACKEND'], 'django.core.files.storage.FileSystemStorage')

    def test_all_three_credentials_select_cloudinary(self):
        config = self.load_settings(
            DEBUG='true', CLOUDINARY_CLOUD_NAME='test-cloud',
            CLOUDINARY_API_KEY='test-key', CLOUDINARY_API_SECRET='test-secret',
        )
        self.assertEqual(config.STORAGES['default']['BACKEND'], 'core.cloudinary_storage.CloudinaryMediaStorage')

    def test_partial_cloud_credentials_fail_instead_of_silently_using_local_disk(self):
        for key in ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'):
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, 'juntos'):
                self.load_settings(DEBUG='true', **{key: 'test-value'})

    def test_production_requires_cloudinary_instead_of_firebase_storage(self):
        with self.assertRaisesRegex(RuntimeError, 'CLOUDINARY_CLOUD_NAME'):
            self.load_settings(
                DEBUG='false', SECRET_KEY='test-production-key-not-a-real-secret',
                REDIS_URL='redis://localhost:6379/0', FIREBASE_STORAGE_BUCKET='old-bucket',
            )
