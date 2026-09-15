# FUC03 - Usuário > Perfil (consultar e editar nome/nível)

## Objetivo
Mostrar os dados do atleta autenticado e permitir editar nome e nível de
experiência, dentro da seção "Usuário" da navegação.

## Estrutura de navegação
Item de menu renomeado de "Perfil" pra **"Usuário"**, levando a uma área
com abas — mesmo padrão de abas já usado no Acervo (Armas/Munições/
Acessórios):
- Aba "Perfil" (padrão/primeira aba) — este use case
- Aba "Modalidades" — FUC06

Rota: `/usuario` (aba Perfil, padrão), `/usuario/modalidades` (aba Modalidades).

## Referência backend
- UC03 (consultar perfil) — `GET /api/users/me`
- UC04 (editar perfil, parte de nome/nível) — `PATCH /api/users/me`

Atenção: o backend exige `name` E `experienceLevel` juntos no mesmo PATCH
(schema `UpdateProfileRequest`), mesmo editando só um dos dois — o
formulário sempre envia os dois campos.

## Campos do formulário
- Nome (texto, obrigatório)
- Nível de experiência (seleção: Iniciante / Intermediário / Avançado)

## Seção de resumo (abaixo do formulário, mesma tela)
- Modalidades: resumo compacto ("Precisão, IPSC +1") com link "Editar" →
  leva pra aba Modalidades (`/usuario/modalidades`, FUC06)
- Email: valor atual com link "Alterar" → leva pro FUC04 (`/usuario/email`)
- Senha: mascarada com link "Alterar" → leva pro FUC05 (`/usuario/senha`)

## Estados da tela
- Carregando: enquanto busca os dados em `GET /api/users/me` e o resumo
  de modalidades praticadas
- Padrão: formulário preenchido com os dados atuais
- Salvando: botão desabilitado, texto "Salvando..."
- Sucesso: mensagem de confirmação (ex: toast "Perfil atualizado")
- Erro de validação: mensagem inline no campo correspondente
- Sessão expirada (401 em qualquer consulta): redireciona pro `/login`

## Definição de pronto
- [ ] Tela reflete o mockup validado (com as abas Perfil/Modalidades)
- [ ] Dados atuais carregados corretamente ao abrir a tela
- [ ] Edição de nome bem-sucedida
- [ ] Edição de nível de experiência bem-sucedida
- [ ] Resumo de modalidades exibido corretamente, link leva pra aba certa
- [ ] Links de email/senha levam pras telas corretas (FUC04/FUC05)
- [ ] Erro de validação exibido corretamente
- [ ] Teste E2E (Playwright) cobrindo consulta + edição bem-sucedida

## Referências
- Backend: UC03, UC04 (docs/use-cases/, repositório shottrack-backend)
- FUC06 (modalidades, aba irmã), FUC04, FUC05 (linkadas a partir daqui)