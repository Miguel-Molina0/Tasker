# Tasker — Redis, Firebase Storage e Firebase Cloud Messaging

## O que foi preparado
- Django Channels usa Redis quando `REDIS_URL` está definida; em produção ela é obrigatória.
- Celery usa o mesmo Redis como broker por padrão; para executar notificações de modo assíncrono é necessário um **Background Worker** separado (`bash start-worker.sh`).
- Fotos de perfil (`Usuario.tp_foto`) passam a ser armazenadas em Firebase Storage (bucket Google Cloud Storage) quando `FIREBASE_STORAGE_BUCKET` está definida.
- Objetos são privados; os links de mídia gerados pelo servidor são **assinados e expiram em 1 hora**. Um app aberto por muito tempo deve atualizar o perfil para obter outra URL.
- Firebase Admin SDK continua enviando pushes FCM por meio das tasks existentes. O app Expo **ainda precisa obter e registrar um token FCM nativo** para receber push; este pacote não implementa registro de token no frontend.
- Não altera anúncios com imagens embutidas em JSON, nem migra fotos antigas existentes em `media/`.

## 1. Criar Redis/Valkey no Render
1. Dashboard Render > New > Key Value.
2. Crie na **mesma região** do Web Service do Django.
3. Em **Connect**, copie a **Internal URL** (`redis://...` ou `rediss://...`).
4. No Web Service do backend, em Environment, adicione `REDIS_URL` com a URL exata. Não use `localhost` na hospedagem.
5. Reinicie/redeploy o backend.

## 2. Firebase Storage
1. No Firebase Console, crie/abra o projeto, entre em Storage e habilite o bucket. Confira o plano, a disponibilidade e os custos atuais do Firebase antes de ativar.
2. Copie o **nome exato** do bucket, como `projeto.firebasestorage.app` (alguns projetos usam `projeto.appspot.com`).
3. Em Configurações do projeto > Contas de serviço > Gerar nova chave privada, baixe o JSON e mantenha-o somente no backend, fora do Git.
4. No Render Web Service > Environment, adicione `FIREBASE_STORAGE_BUCKET` = nome do bucket e `FIREBASE_CREDENTIALS_JSON` = conteúdo completo do JSON da conta de serviço, em uma linha. Garanta que a conta tenha permissões apropriadas de leitura, escrita e assinatura de URLs do bucket.
5. Para desenvolvimento local, em vez do JSON na env, use `FIREBASE_CREDENTIALS` apontando para o caminho absoluto da chave privada fora do repositório.
6. Nunca configure regras públicas de leitura como solução para tornar fotos disponíveis: este backend gera URLs assinadas. Proteja e, se necessário, restrinja a distribuição dessas URLs.

**Atenção:** as Firebase Storage Rules aplicam-se aos SDKs cliente; o Admin SDK/service account acessa o bucket por IAM. Limite o acesso à conta de serviço.

## 3. Celery worker para FCM e e-mails
1. No Render, crie um **Background Worker** (serviço separado) conectado ao mesmo repositório.
2. Root Directory: `tasker-backend`; Build: `bash build.sh`; Start: `bash start-worker.sh`.
3. Repita no worker as variáveis `SECRET_KEY`, `DEBUG=false`, `REDIS_URL`, `FIREBASE_CREDENTIALS_JSON`, `FIREBASE_STORAGE_BUCKET` e todas as variáveis de banco e e-mail necessárias.
4. Sem worker, enviar notificações por `.delay()` coloca tarefas na fila, mas elas não serão consumidas.
5. Para economizar recursos em desenvolvimento, deixe `REDIS_URL` ausente: tasks rodam inline (`CELERY_TASK_ALWAYS_EAGER=True`) e Channels usa memória; **não use essa alternativa em produção**.

## 4. Verificar conexões
Com o ambiente Python ativo e as dependências instaladas:

```bash
python manage.py check
python manage.py shell -c "from django.conf import settings; print(settings.CHANNEL_LAYERS['default']['BACKEND']); print(settings.STORAGES['default']['BACKEND'])"
python manage.py shell -c "import redis,os; print(redis.from_url(os.environ['REDIS_URL']).ping())"
```

Para validar foto, atualize `tp_foto` pelo endpoint de perfil já existente e confira no console Firebase Storage. Para testar notificações push, use token FCM válido de um aplicativo nativo configurado para o mesmo projeto Firebase e mantenha o worker ativo.

## 5. Produção e limitações
- `SECRET_KEY` forte, `DEBUG=false`, PostgreSQL configurado, HTTPS e domínios corretos.
- Links de fotos expiram; não assuma que `/media/` do Render servirá as novas imagens.
- Fotos antigas armazenadas em disco local **não** são automaticamente migradas; é necessário migrá-las separadamente antes de desligar o volume antigo.
- Redis/Key Value e Background Worker podem gerar custos; consulte os preços do Render.
- Conta Firebase Admin NÃO deve ser colocada no Expo nem no código cliente.
- Armazenamento funciona no lado Django; não habilita Firebase Authentication nem Firestore (o app continua usando autenticação JWT e PostgreSQL).
