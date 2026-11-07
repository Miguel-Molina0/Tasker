# Deploy do backend Tasker no Render

1. Crie um repositório **privado** no GitHub e envie `tasker-backend/` e `tasker-app/`. Nunca envie arquivos `.env`, credenciais ou o diretório `venv`/`node_modules`.
2. Crie um banco PostgreSQL no Supabase. Copie os parâmetros do **Session Pooler**, inclusive porta e usuário exatos.
3. No Render, New > Web Service > conecte seu repositório. Configure Language: Python, Root Directory: `tasker-backend`, Build Command: `bash build.sh`, Start Command: `bash start.sh`.
4. Configure as variáveis de ambiente do serviço:
   - `DEBUG=false`
   - `SECRET_KEY` = chave longa aleatória, exclusiva de produção
   - `ALLOWED_HOSTS` = `seu-servico.onrender.com`
   - `CSRF_TRUSTED_ORIGINS` = `https://seu-servico.onrender.com`
   - `DB_NAME` = `postgres`
   - `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` = dados exatos do pooler Supabase
   - `PGSSLMODE=require`
   - `CORS_ALLOWED_ORIGINS` = endereço HTTPS do frontend web (se houver)
   - `REDIS_URL` = URL interna do serviço Redis/Valkey (obrigatória em produção)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` = credenciais do product environment Cloudinary (obrigatórias em produção, somente no backend)
   - Outras variáveis de integrações (ASAAS, e-mail, Firebase **somente para FCM**) apenas quando utilizadas. Firebase Storage não é usado.
5. Faça o deploy. Execute `python manage.py migrate` via Shell do Render, ou como job de migração controlado; não execute migrações automaticamente em cada instância.
6. Configure `EXPO_PUBLIC_API_URL=https://seu-servico.onrender.com/api/` no frontend Expo e gere novo build/reinicie o bundler.
7. Configure Redis gerenciado e `REDIS_URL` para WebSockets com múltiplas instâncias. O InMemoryChannelLayer só serve para uma instância/testes.
8. Fotos de perfil são persistidas no Cloudinary como imagens `authenticated`, com links assinados que expiram em uma hora. Configure e valide o upload antes de liberar o serviço; migre as fotos antigas antes de desativar o bucket Firebase ou o disco anterior. Consulte [Redis, Cloudinary e FCM](CONFIGURAR-REDIS-CLOUDINARY-FIREBASE.md). Para produção, configure e valide pagamentos, webhooks e e-mails separadamente.
9. Troque quaisquer segredos que tenham sido compartilhados anteriormente, inclusive em arquivos compactados.

Observação: perfis autônomos preexistentes que ainda têm CPF precisarão informar um CNPJ válido ao editar cadastro ou para pagamentos (migração não converte CPF em CNPJ).
