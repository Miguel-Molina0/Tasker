# Alterações no cadastro e perfil do Tasker

- Cadastro de profissionais: seleção obrigatória da área de atuação.
- Data de nascimento: três seletores (dia, mês e ano), sem digitação manual, com validação de idade mínima de 18 anos.
- Cidade: seleção dos nove municípios da Baixada Santista no cadastro e na edição do perfil.
- Redes sociais: edição de links HTTPS de Instagram, Facebook e LinkedIn, exibidos como botões clicáveis no perfil público e no próprio perfil.
- Backend: campos persistidos em `Usuario`, serializados tanto nos dados privados quanto no perfil público.

## Como atualizar o servidor e o aplicativo

1. Atualize o código do backend no Render (o `build.sh` existente executa as migrações automaticamente). Se atualizar manualmente, execute `python manage.py migrate` na pasta `tasker-backend`.
2. Atualize o aplicativo na pasta `tasker-app` com `npm ci` e `npx expo start --clear`.
3. Novos campos no servidor somente funcionarão após a migração `0008_usuario_area_atuacao_redes_sociais` ser aplicada.

Observação: os campos de área de atuação de contas antigas permanecem opcionais, mas a seleção é obrigatória no novo cadastro de profissional. O ambiente de preparação não concluiu a instalação de dependências, então não foi possível executar integralmente o typecheck nem o aplicativo.
