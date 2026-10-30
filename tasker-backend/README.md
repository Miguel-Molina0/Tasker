# Tasker Backend — corrigido

Backend Django/DRF para o marketplace Tasker. Este pacote não contém o aplicativo Expo.
Validado com Python 3.12 e Django 5.2 LTS. As dependências estão fixadas nas versões instaladas durante os testes.

## Executar no Windows (PowerShell)

Abra o terminal **dentro da pasta tasker-backend**, onde está manage.py:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Caso o PowerShell bloqueie a ativação, use diretamente `.\.venv\Scripts\python.exe` em lugar de `python`; não é preciso alterar a política do Windows.
No Linux/macOS: `python3 -m venv .venv`, `source .venv/bin/activate`, `pip install -r requirements.txt`, `cp .env.example .env`; depois execute os comandos manage.py acima.

Admin: http://localhost:8000/admin/ . Swagger: http://localhost:8000/api/docs/swagger/ .
Cadastre as categorias no admin, crie uma conta autônomo e publique anúncios pela API.
As senhas do cadastro e de atualização seguem os validadores de segurança do Django.

## Conectar o aplicativo no celular

Celular e computador precisam estar na mesma rede. Descubra o IPv4 do computador com `ipconfig`, coloque esse IP em ALLOWED_HOSTS no .env e use `http://SEU_IP:8000/api/` como base da API no app. Reinicie o servidor após alterar .env. Libere a porta 8000 no firewall da rede privada se necessário. `localhost` no celular aponta para o próprio celular.
JWT: POST /api/token/ com username e password; use `Authorization: Bearer ACCESS_TOKEN` nas requisições. Renovação: POST /api/token/refresh/.

## Fluxo e endpoints

- POST /api/usuarios/: cadastro público. GET /api/usuarios/ e GET /api/usuarios/{id}/: apenas o próprio usuário (administradores têm acesso ampliado). GET/PUT/PATCH /api/usuarios/me/: perfil próprio. CPF, telefone e email não ficam em listagens públicas.
- /api/anuncios/: leitura pública, busca `search`, filtros de categoria, preço, st_anuncio e localização (`latitude`, `longitude`, `raio_km`). Escrita restrita ao dono; apenas autônomos publicam. O proprietário não pode ser transferido por PATCH. Para anúncios contratados, desative usando st_anuncio=false.
- /api/categorias/: leitura pública; escrita administrativa.
- POST /api/contratacoes/: informe fk_id_anuncio, dt_agendamento (AAAA-MM-DD), hr_inicio e hr_final (HH:MM). Cria solicitação PENDENTE, compromisso PENDENTE nas duas agendas e registro financeiro. Horários são obrigatórios. Prestador_id está incluído na resposta.
- PATCH /api/contratacoes/{id}/aceitar/: apenas prestador; confirma as duas agendas após revalidar conflitos do cliente e do prestador.
- PATCH /api/contratacoes/{id}/recusar/: apenas prestador. PATCH .../cancelar/: participante. Preserva o histórico e libera o horário, bloqueando o repasse.
- PATCH /api/contratacoes/{id}/concluir/: cada parte confirma; somente as duas confirmações levam a CONCLUIDO. Repetir a conclusão não gera outro repasse.
- GET /api/calendarios/: apenas agenda própria. Compromissos são gerenciados pelas ações da contratação; não aceitam edição direta.
- GET /api/pagamentos/: somente participantes e administradores; não aceita alteração direta. `retido` representa o estado contábil local, não um produto de custódia/escrow do gateway.
- POST /api/pagamentos/{id}/estornar/: somente administrador; cancela cobrança ainda não recebida ou solicita estorno integral para contratação cancelada/recusada. Não reenvia tentativas automaticamente; o estorno real é confirmado por PAYMENT_REFUNDED.
- POST /api/pagamentos/{id}/liberar/: somente administrador, contratação concluída por ambos e recebimento comprovado. Em Asaas, registra uma tentativa e aguarda TRANSFER_DONE para marcar como liberado.
- /api/avaliacao/: avaliações de serviços concluídos; uma por participante e contratação. Apenas autor pode editar/excluir.
- /api/mensagens/?contratacao=ID: histórico dos participantes. POST com fk_id_contratacao e ds_mensagem; o servidor determina o remetente. Mensagens não aceitam edição/exclusão pelo endpoint.

Algumas operações antes abertas foram deliberadamente restringidas. Ajuste o front para usar /usuarios/me/ e as ações da contratação, sem gravar calendários ou pagamentos diretamente.

## Chat

Conecte em `ws://SEU_IP:8000/ws/chat/ID/?token=ACCESS_TOKEN` (use wss em produção). Clientes React Native também podem enviar Bearer no cabeçalho. Não registre URLs com tokens nos logs de produção.
Envie `{"mensagem":"Olá"}`. O servidor ignora remetente_id informado pelo cliente, autentica JWT, confere participação e valida até 4000 caracteres. Também publica notificações de mudança do serviço. Clientes browser precisam usar uma origem autorizada pelos hosts; clientes nativos sem Origin ainda precisam autenticar.

## Pagamentos: demonstração e Asaas

**PAYMENTS_MODE=mock é o padrão.** Gera identificadores fictícios, simula recebimento e repasse sem chamar o Asaas ou mover dinheiro. Ideal para demonstrar o TCC.

Para testar integração externa, use PAYMENTS_MODE=asaas, API key de Sandbox e ASAAS_WEBHOOK_TOKEN secreto. Configure no painel Asaas o webhook público HTTPS `/api/webhooks/asaas/`, enviando o segredo em `asaas-access-token`.
O estado só passa para retido em PAYMENT_RECEIVED com valor correspondente; PAYMENT_CONFIRMED sozinho não libera saldo. Eventos de estorno/exclusão bloqueiam repasse. Transferências aguardam TRANSFER_DONE; TRANSFER_FAILED/CANCELLED bloqueiam e exigem conferência.
O autônomo cadastra chave_pix e tipo_chave_pix no próprio perfil. No ambiente externo o administrador inicia o repasse com POST .../liberar/ depois de conferir pagamento e conclusão. Não há repasse real automático.
Uma falha de geração da cobrança preserva a solicitação e retorna aviso_pagamento: **não repita a contratação**; confira o painel Asaas pela externalReference, igual ao ID da contratação. Falha ou timeout de repasse não gera outra tentativa automática: confira o painel e concilie antes de qualquer reenvio. Mudar PAYMENTS_MODE não converte pagamentos já existentes.
No cancelamento/recusa, o administrador deve conferir a cobrança e executar POST /api/pagamentos/{id}/estornar/. Cobranças não recebidas são canceladas; recebidas recebem pedido de estorno integral. PAYMENT_REFUNDED confirma dt_estorno. Falhas/timeout exigem conciliação no painel; bloquear o registro local não equivale a devolver dinheiro. Não habilite produção sem homologar esses procedimentos e as taxas/saldo da conta.

## Banco existente e produção

As migrações originais foram preservadas e novas migrações adicionam campos e unicidade. Faça backup antes de atualizar uma base existente. Duplicatas antigas de avaliação, agenda ou pagamento devem ser conciliadas antes de `migrate`; os dados não são apagados automaticamente para fazer uma migração passar.
SQLite e channel layer em memória são para teste local em um processo. Em produção configure PostgreSQL (DB_NAME etc.), Redis (REDIS_URL), broker Celery, worker `celery -A setup worker -l info`, email SMTP, Firebase opcional, DEBUG=false, segredo próprio, hosts e HTTPS. Configure o proxy para não registrar tokens de WebSocket. A proteção contra aceitações concorrentes usa bloqueios de PostgreSQL; os testes locais não homologam concorrência nesse banco.

## Verificação

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test core
```

Os testes cobrem autenticação, isolamento de dados, senha, solicitação/aceitação/recusa/cancelamento/conclusão, agendas, conflitos, avaliações, busca/localização, webhook, falha do gateway, repasse e chat JWT. Integrações reais não foram acessadas com credenciais; falhas HTTP foram simuladas nos testes.

## Extensões para o front-end integrado (10/10/2026)

Siga ../LEIA-ME.md para iniciar o pacote completo. Novos endpoints: perfis públicos (sem CPF/telefone/email), favoritos, bloqueios, compromissos pessoais, notificações e leitura, protocolos de suporte. Mensagens aceitam destinatario para conversar antes de contratar. WebSocket: /ws/conversa/USUARIO_ID/?token=ACCESS_TOKEN. Contratação armazena escopo/endereço, tem chave_solicitacao para idempotência e ações reagendar/responder-reagendamento/contestar. Conta tem ações alterar-senha, recuperar-senha, redefinir-senha e excluir-conta. Migração 0006 adiciona os campos/modelos. Anúncios têm dias_atendimento e imagens validadas; foto do perfil aceita imagem em base64. Protocolos/estados/respostas são gerenciados pelo admin. CHECK_REVOKE_TOKEN valida revogação após mudança de senha. Não use as regras locais antigas para simular gravação em paralelo à API.
