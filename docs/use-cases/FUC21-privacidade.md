# FUC21 - Usuário > Privacidade (exportar dados e excluir conta) + aceite de termos

## Objetivo
Dar ao atleta controle sobre os próprios dados (LGPD) e registrar o aceite
dos Termos e da Política de Privacidade.

## Referência backend
UC52 (excluir conta), UC53 (exportar dados), UC23 alterado (aceite).
Consultar as rotas exatas no Swagger.

## Telas
- **Usuário > Privacidade** (nova aba, mesmo padrão das abas Perfil e Modalidades):
  - Cartão "Seus dados": texto curto + botão "Baixar meus dados" (baixa o JSON).
  - Cartão "Excluir minha conta": texto de aviso (definitivo, apaga tudo, não
    dá para desfazer) + botão de perigo (vermelho) "Excluir minha conta".
  - Links para Termos de Uso e Política de Privacidade.
- **Diálogo de exclusão** (confirmação reforçada): lista o que será apagado,
  campo de senha, botão "Excluir definitivamente" desabilitado até a senha
  ser preenchida. Senha errada → mensagem inline, sem fechar o diálogo.
  Sucesso → limpa a sessão e vai para /login com o aviso "Sua conta foi
  excluída."
- **Cadastro (completar)**: checkbox obrigatório "Li e aceito os Termos de Uso
  e a Política de Privacidade" (links abrem em nova aba). Sem marcar, o botão
  fica desabilitado; erro `TERMS_NOT_ACCEPTED` do backend também é tratado.
- **Páginas públicas** `/termos` e `/privacidade`, renderizando o texto de
  `docs/legal/`. Links no rodapé das telas de login e cadastro.
- 429 (`TOO_MANY_REQUESTS`) na exportação e na exclusão: mensagem padrão do projeto.

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
