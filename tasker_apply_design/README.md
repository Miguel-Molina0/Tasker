# Tasker — Painel Administrativo com PostgreSQL

Este pacote inclui frontend web, API em Python/Flask e banco de dados PostgreSQL. Mantém o tema visual Tasker (azul-marinho/roxo) das referências.

## Requisitos
- Windows 10/11 com Docker Desktop instalado e aberto (recomendado).
- Alternativamente: Python 3.12+ e PostgreSQL 16 instalados localmente.

## Executar com Docker (mais fácil)
1. Extraia o ZIP em uma pasta.
2. Copie `.env.example` para `.env`.
3. Edite `.env` e troque `POSTGRES_PASSWORD`, `SECRET_KEY`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
4. Abra o terminal nessa pasta e execute:
   ```powershell
   docker compose up --build -d
   ```
5. Acesse http://localhost:8000
6. Entre com o e-mail e senha definidos no `.env`.
7. Para ver logs: `docker compose logs -f web`
8. Para parar: `docker compose down`
   Para parar sem apagar os dados, use esse comando. Os dados ficam no volume `tasker_pgdata`.
   **Não use `docker compose down -v` se quiser manter os dados**, pois remove o volume do banco.

## Executar sem Docker
1. Instale Python 3.12+ e PostgreSQL 16.
2. Crie um banco `tasker` e um usuário que tenha permissão nele.
3. No PowerShell, configure `DATABASE_URL`, `SECRET_KEY`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
4. `py -m venv .venv`
5. `\.venv\Scripts\Activate.ps1`
6. `py -m pip install -r requirements.txt`
7. `py app.py`
8. Abra http://localhost:8000

## Credenciais
As credenciais iniciais de desenvolvimento vêm de variáveis de ambiente. Se você não criar `.env`, o compose usa `admin@tasker.local` e `TaskerDemo!2026`. Troque-as antes de usar em qualquer ambiente compartilhado. A senha é armazenada com hash, não em texto puro.

## O que funciona com banco/API
- Login administrativo com sessão.
- Dashboard com contagens e somas calculadas no PostgreSQL.
- Listagem e busca de pagamentos; filtros por status; exportação CSV.
- Detalhes e transições administrativas de pagamentos (custódia/mediação/registro pago).
- Cadastro de usuários e suspensão/reativação.
- Listagem de contratos, relatórios e trilha de auditoria.
- Dados de demonstração inseridos automaticamente na primeira inicialização.

## Limite financeiro importante
A API de repasse (`release`) e estorno (`refund`) intencionalmente não movimenta dinheiro e retorna erro 501 até que um provedor real seja integrado. Isso evita mostrar um pagamento como enviado sem que exista transferência bancária. `mark_paid` é apenas um registro administrativo e não substitui confirmação do provedor.

Para ativar dinheiro real, precisamos escolher um provedor que atenda ao modelo marketplace (por exemplo, split/recebedores e PIX/transferências), criar conta empresarial, configurar credenciais apenas no servidor e implementar criação/captura de cobrança, webhooks assinados, idempotência, conciliação, estorno e transferência. Não coloque segredos no JavaScript do navegador. Também é necessário validar o fluxo de custódia/escrow com o provedor e com orientação jurídica/compliance; não presuma que qualquer API permita reter valores de terceiros.

## Segurança antes de publicar
Este é um scaffold funcional para desenvolvimento/TCC, não uma implantação pronta para produção. Antes de publicar na internet, configurar HTTPS, segredo aleatório, política de senhas, MFA, controle de acesso por função, proteção CSRF conforme arquitetura de autenticação, rate limiting, backups, monitoramento e revisão de segurança/LGPD.

## Integração Asaas (implementada em modo Sandbox)

A integração Asaas foi adicionada ao backend. Por padrão usa o **sandbox**, sem movimentar dinheiro real.

1. No arquivo `.env`, configure `ASAAS_ENV=sandbox`, `ASAAS_API_KEY` com uma chave do sandbox e `ASAAS_WEBHOOK_TOKEN` com um segredo aleatório forte (32+ caracteres, sem espaços).
2. Reinicie: `docker compose up --build -d`.
3. Configure no painel/API do Asaas um webhook com URL pública HTTPS `https://SEU-DOMINIO/webhooks/asaas`, token de autenticação igual a `ASAAS_WEBHOOK_TOKEN` e eventos de cobrança/transferência, incluindo `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_OVERDUE`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED` e `TRANSFER_BLOCKED`.
4. Cadastre o `walletId` da subconta Asaas aprovada de cada autônomo pelo endpoint autenticado `POST /api/users/{id}/asaas-wallet`, com JSON `{"walletId":"WALLET_ID_DA_SUBCONTA"}`.
5. Na tela Pagamentos, abra um pagamento pendente e use **Criar cobrança Asaas (Pix)**. O link da fatura será exibido.
6. O pagamento muda para **Em custódia** somente ao receber o webhook autenticado `PAYMENT_RECEIVED`. Marque o contrato como concluído após confirmar o serviço. Só então solicite o repasse.
7. O pagamento só muda para **Liberado** após o webhook `TRANSFER_DONE`.

### Endpoints financeiros
- `POST /api/payments/{id}/asaas-checkout` — cria cobrança no Asaas para o cliente associado ao pagamento; aceita `{"billingType":"PIX"}` (também `BOLETO`, `CREDIT_CARD` ou `UNDEFINED`).
- `POST /api/users/{id}/asaas-wallet` — registra o `walletId` da subconta do autônomo.
- `POST /api/contracts/{id}/complete` — marca contrato como concluído após confirmação operacional.
- `POST /api/payments/{id}/action` com `{"action":"release"}` — solicita transferência real quando elegível.
- `POST /webhooks/asaas` — endpoint público de webhook, autenticado por `asaas-access-token` e idempotente por ID do evento.

### Limites e cuidados antes de produção
- A chave API e o token do webhook ficam somente no servidor `.env`; nunca no frontend.
- A criação da cobrança não comprova pagamento. O webhook é que atualiza o status.
- A transferência só funciona quando o `walletId` pertence a uma subconta Asaas vinculada e elegível. A disponibilidade de subcontas e transferências depende da aprovação/contrato da conta Asaas.
- A retenção de valores até a conclusão não deve ser anunciada como custódia/escrow garantida. Valide o modelo de negócio, regras de liberação, chargebacks, reembolsos, KYC e obrigações regulatórias com o Asaas e assessoria jurídica antes de produção.
- Se a solicitação de transferência tiver resultado de rede incerto, o sistema mantém um marcador `REQUESTING-*` para impedir um segundo envio automático. Concilie a operação no Asaas antes de corrigir manualmente esse registro; nunca tente novamente às cegas.
- O estorno via API ainda não está implementado. O webhook de estorno/chargeback atualiza o registro, mas não inicia um reembolso.
- Use sandbox primeiro. Para produção, altere `ASAAS_ENV=production` somente após aprovação comercial/regulatória e testes completos com webhooks públicos HTTPS.
