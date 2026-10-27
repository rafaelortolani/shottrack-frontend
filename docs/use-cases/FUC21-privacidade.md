# FUC21 - Usuário > Privacidade (exportar dados e excluir conta) + aceite de termos

## Objetivo
Dar ao atleta controle sobre os próprios dados (LGPD) e registrar o aceite
dos Termos e da Política de Privacidade.

## Referência backend
UC52 (excluir conta), UC53 (exportar dados), UC23 alterado (aceite).
- `GET /api/users/me/export` — devolve o JSON cru (sem envelope) com
  `Content-Disposition: attachment; filename=shottrack-dados-AAAAMMDD.json`;
  limite de 3/hora por atleta.
- `POST /api/users/me/deletion` com `{ password }` — erro
  `INVALID_CURRENT_PASSWORD` (401) se a senha estiver errada; limite de
  5/hora por atleta.
- `POST /api/users/registration/completion` ganha `acceptedTerms`.

## BFF
`GET /api/users/me/export` repassa o arquivo e o `Content-Disposition`;
`POST /api/users/me/deletion` repassa o erro e, em sucesso, limpa os cookies.
Ambos repassam o 429 com `Retry-After`. O navegador baixa o arquivo via
`fetch` + `Blob` (pra poder mostrar o erro 429 na própria tela).

## Telas
- **Usuário > Privacidade** (`/usuario/privacidade`; entrada no submenu de
  Usuário com `IconShieldLock` e card no hub `/usuario`):
  - Cartão "Seus dados": texto curto + botão "Baixar meus dados" (baixa o JSON).
  - Cartão "Excluir minha conta": texto de aviso (definitivo, apaga tudo, não
    dá para desfazer) + botão de perigo (vermelho) "Excluir minha conta".
  - Links para Termos de Uso e Política de Privacidade.
- **Diálogo de exclusão** (confirmação reforçada): lista o que será apagado,
  campo de senha, botão "Excluir definitivamente" desabilitado até a senha
  ser preenchida. Senha errada → mensagem inline, sem fechar o diálogo.
  Sucesso → limpa a sessão e vai para `/login?conta=excluida` com o aviso
  "Sua conta foi excluída."
- **Cadastro (completar)**: checkbox obrigatório "Li e aceito os Termos de Uso
  e a Política de Privacidade" (links abrem em nova aba). Sem marcar, o botão
  fica desabilitado; erro `TERMS_NOT_ACCEPTED` do backend também é tratado.
- **Páginas públicas** `/termos` e `/privacidade`, renderizando o texto de
  `docs/legal/`. Links no rodapé das telas de login e cadastro.
- 429 (`TOO_MANY_REQUESTS`) na exportação e na exclusão: mensagem padrão do
  projeto (`src/lib/rateLimit.ts`), embaixo do botão de download e dentro do
  diálogo de exclusão.

## Testes
- `tests/privacidade.spec.ts` — aba e links, download (nome do arquivo,
  seções do JSON, sem hash/tokens), 429 real da exportação, senha errada,
  cancelar, exclusão com a senha certa (aviso no login, cookies limpos, conta
  antiga não entra) e 429 real da exclusão.
- `tests/termos-privacidade.spec.ts` — páginas públicas, fidelidade ao texto
  de `docs/legal/`, rodapé de login e cadastro.
- `tests/completar-cadastro.spec.ts` — aceite obrigatório e `TERMS_NOT_ACCEPTED`.
- Cada teste que estoura limite usa uma conta própria (o limite é por atleta).

## Definição de pronto
- [ ] Aba Privacidade com download e exclusão
- [ ] Download entrega o arquivo JSON
- [ ] Exclusão exige senha; senha errada mostra erro e não exclui
- [ ] Após excluir, sessão encerrada e login com a conta antiga falha
- [ ] Checkbox de aceite obrigatório no completar cadastro
- [ ] /termos e /privacidade públicas (sem login) e linkadas
- [ ] E2E Playwright: baixar dados, excluir com senha errada e correta,
      aceite obrigatório, páginas públicas

## Referências
- Backend: UC52, UC53, UC23 (alterado), ADR-0019
