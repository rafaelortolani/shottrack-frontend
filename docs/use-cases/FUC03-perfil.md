# FUC03 - Perfil (consultar e editar nome/nível)

## Objetivo
Mostrar os dados do atleta autenticado e permitir editar nome e nível de
experiência.

## Referência backend
- UC03 (consultar perfil) — `GET /api/users/me`
- UC04 (editar perfil, parte de nome/nível) — `PATCH /api/users/me`

Atenção: o backend exige `name` E `experienceLevel` juntos no mesmo PATCH
(schema `UpdateProfileRequest`), mesmo editando só um dos dois — o
formulário sempre envia os dois campos.

## Campos do formulário
- Nome (texto, obrigatório)
- Nível de experiência (seleção: Iniciante / Intermediário / Avançado)

## Estados da tela
- Carregando: enquanto busca os dados em `GET /api/users/me`
- Padrão: formulário preenchido com os dados atuais
- Salvando: botão desabilitado, texto "Salvando..."
- Sucesso: mensagem de confirmação (ex: toast "Perfil atualizado")
- Erro de validação: mensagem inline no campo correspondente
- Sessão expirada (401 na consulta ou na edição): redireciona pro `/login`

## Navegação
- Seção de email (link "Alterar") leva pra tela do FUC04 (ainda não implementada)
- Seção de senha (link "Alterar") leva pra tela do FUC05 (ainda não implementada)
- Essas duas seções aparecem na tela mas os links podem ficar desabilitados
  ou indicar "em breve" até FUC04/FUC05 existirem

## Definição de pronto
- [ ] Tela reflete o mockup validado
- [ ] Dados atuais carregados corretamente ao abrir a tela
- [ ] Edição de nome bem-sucedida
- [ ] Edição de nível de experiência bem-sucedida
- [ ] Erro de validação exibido corretamente
- [ ] Teste E2E (Playwright) cobrindo consulta + edição bem-sucedida

## Referências
- Backend: UC03, UC04 (docs/use-cases/, repositório shottrack-backend)