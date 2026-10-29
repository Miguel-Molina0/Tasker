"""Fotos de perfil privadas no Cloudinary, com links assinados de uma hora."""
import posixpath
import time
from uuid import uuid4

import requests
from cloudinary import api, uploader, utils
from cloudinary.exceptions import NotFound
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.core.files.storage import Storage


class CloudinaryMediaStorage(Storage):
    def __init__(self):
        self.options = {
            'cloud_name': settings.CLOUDINARY_CLOUD_NAME,
            'api_key': settings.CLOUDINARY_API_KEY,
            'api_secret': settings.CLOUDINARY_API_SECRET,
            'resource_type': 'image',
            'type': 'authenticated',
            'secure': True,
        }
        if not all(self.options[key] for key in ('cloud_name', 'api_key', 'api_secret')):
            raise ImproperlyConfigured('Configure as três credenciais CLOUDINARY no backend.')

    def get_available_name(self, name, max_length=None):
        # UUID + overwrite=False evitam sobrescrever outra foto, sem consulta remota.
        extension = posixpath.splitext(name)[1].lower()
        name = f'tasker/perfis/{uuid4().hex}{extension}'
        if max_length is not None and len(name) > max_length:
            raise SuspiciousFileOperation('Nome da foto excede o limite do campo.')
        return name

    def _save(self, name, content):
        content.seek(0)
        result = uploader.upload(
            content,
            public_id=posixpath.splitext(name)[0],
            overwrite=False,
            timeout=30,
            **self.options,
        )
        return f"{result['public_id']}.{result['format']}"

    def url(self, name):
        if not name:
            return ''
        public_id, extension = posixpath.splitext(name)
        return utils.private_download_url(
            public_id,
            extension.lstrip('.'),
            attachment=False,
            expires_at=int(time.time()) + 3600,
            **self.options,
        )

    def _open(self, name, mode='rb'):
        if mode not in ('r', 'rb'):
            raise ValueError('Use save() para gravar fotos no Cloudinary.')
        response = requests.get(self.url(name), timeout=30)
        if response.status_code == 404:
            raise FileNotFoundError(name)
        response.raise_for_status()
        return ContentFile(response.content, name=name)

    def exists(self, name):
        try:
            api.resource(posixpath.splitext(name)[0], timeout=30, **self.options)
        except NotFound:
            return False
        return True

    def delete(self, name):
        if name:
            uploader.destroy(
                posixpath.splitext(name)[0],
                invalidate=True,
                timeout=30,
                **self.options,
            )
