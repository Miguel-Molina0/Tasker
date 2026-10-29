# Tasker — Redis, Cloudinary e Firebase Cloud Messaging

## Armazenamento e notificações

- Fotos de perfil (`Usuario.tp_foto`) usam **Cloudinary** quando as três variáveis `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` estão definidas. Configuração parcial gera erro, inclusive em desenvolvimento.
- Em produção (`DEBUG=false`), Cloudinary e Redis são obrigatórios. Sem credenciais Cloudinary e com `DEBUG=true`, fotos ficam em `MEDIA_ROOT` local.
- As imagens são enviadas como `authenticated`, sem sobrescrever arquivos, com IDs únicos em `tasker/perfis/`. A API mantém o campo `tp_foto` e devolve um link HTTPS assinado de download, inline, que expira em uma hora. O app deve atualizar o perfil para renovar o link. Não use uploads públicos como substituição.
- Firebase Admin continua somente para notificações FCM. Firebase Storage não é mais utilizado. O app Expo ainda precisa obter e registrar um token FCM nativo para receber push.
- Imagens de anúncios continuam no campo JSON existente; esta alteração só troca o storage das fotos de perfil.

## 1. Redis/Valkey no Render

1. Crie um serviço Key Value na mesma região do backend.
2. Configure `REDIS_URL` com a Internal URL exata (`redis://...` ou `rediss://...`). Não use `localhost` na hospedagem.
3. Crie um Background Worker com `bash start-worker.sh` para consumir notificações assíncronas.
4. Em desenvolvimento, deixe `REDIS_URL` e `CELERY_BROKER_URL` ausentes para Channels em memória e Celery inline. Esse modo não serve para produção com múltiplas instâncias.

## 2. Cloudinary para fotos de perfil

1. Crie ou selecione um product environment no console Cloudinary.
2. Na seção de API Keys, obtenha o Cloud Name, a API Key e o API Secret.
3. Configure **somente no backend**, pelas variáveis seguras do serviço:

   ```dotenv
   CLOUDINARY_CLOUD_NAME=nome-do-seu-cloud
   CLOUDINARY_API_KEY=sua-api-key
   CLOUDINARY_API_SECRET=seu-api-secret
   ```

4. Instale `requirements.txt` e reinicie o backend. Não é necessário upload preset público ou upload direto pelo Expo: o backend assina os envios.
5. Atualize uma foto pelo endpoint existente de perfil e confira o recurso `authenticated` na Media Library. Verifique que o link retornado carrega a imagem e expira após uma hora. URLs assinadas permitem acesso a quem as receber até expirarem; não as registre em logs.
6. Remova `FIREBASE_STORAGE_BUCKET` da configuração antiga. Se não utilizar FCM, as credenciais Firebase também podem ser removidas. Se utilizar FCM, mantenha-as apenas no backend e no worker.

Nunca coloque o API Secret, a chave de service account ou qualquer variável de credencial no bundle Expo, no Git ou em mensagens. Para desenvolvimento com Cloudinary, preencha as três variáveis em `.env` ignorado; sem elas o backend local funciona sem acesso externo.

Em redes restritas, o backend precisa acessar `api.cloudinary.com` por HTTPS (upload, consulta, exclusão e download assinado). O SDK oficial permite configurar um proxy com `CLOUDINARY_API_PROXY`; mantenha a verificação TLS e a cadeia de confiança da implantação. API Secret é usado localmente para assinar requisições, portanto precisa ser um segredo real no processo backend; um placeholder de proxy não atende a esse uso.

## 3. Firebase apenas para FCM

1. Se utilizar push, obtenha uma conta de serviço do mesmo projeto Firebase do aplicativo nativo.
2. No Render, forneça `FIREBASE_CREDENTIALS_JSON` com o JSON da conta de serviço. Em desenvolvimento, a alternativa é `FIREBASE_CREDENTIALS` com o caminho absoluto da chave fora do repositório.
3. Configure essas variáveis no backend e no worker. Não é necessário bucket Firebase.
4. No worker, repita as variáveis de banco, e-mail, `SECRET_KEY`, `DEBUG=false`, `REDIS_URL` e as três variáveis Cloudinary: o worker carrega as mesmas configurações Django.

## 4. Verificação

Com o ambiente Python ativo, na pasta `tasker-backend`:

```bash
python -m pip install -r requirements.txt
python manage.py check
python manage.py test core.test_storage --noinput
python manage.py shell -c "from django.conf import settings; print(settings.STORAGES['default']['BACKEND'])"
```

Os testes de storage simulam chamadas externas: validam upload pela API, assinatura e expiração das URLs, remoção e modo local sem credenciais. A validação real do serviço exige uma conta Cloudinary configurada. Para FCM, use um token nativo válido e um worker ativo.

## 5. Fotos existentes e produção

- Não há migração automática de fotos antigas do Firebase ou do disco local. Copie os arquivos originais para Cloudinary como recursos `authenticated` e atualize `tp_foto` com `<public_id>.<formato>` (por exemplo, `tasker/perfis/abc123.jpg`) antes de desativar o armazenamento anterior. Não grave a URL temporária no banco. Preserve um backup dos objetos e do banco durante essa migração.
- Ativar o novo backend não copia arquivos: nomes antigos podem apontar para fotos inexistentes no Cloudinary até concluir a migração. Não apague o bucket Firebase ou `media/` antes disso.
- Excluir um arquivo via `tp_foto.delete()` remove o recurso Cloudinary. A política atual de substituir fotos ou excluir contas não faz limpeza automática de todos os recursos antigos; programe a retenção/limpeza separadamente.
- Use PostgreSQL, HTTPS, `SECRET_KEY` forte e domínios corretos em produção. Configure e valide pagamentos, e-mail e notificações reais separadamente. Confira limites e custos de Cloudinary, Redis e workers.
