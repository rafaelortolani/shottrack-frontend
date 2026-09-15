# FUC05 - Alterar senha

## Objetivo
Permitir que o atleta troque sua senha, confirmando a senha atual.

## Referência backend
UC05 (alterar senha) — `PATCH /api/users/me/password`

## Campos do formulário
- Senha atual (senha, obrigatório)
- Nova senha (senha, obrigatório, mínimo 8 caracteres)

## Estados da tela
- Padrão: formulário vazio
- Salvando: botão desabilitado, texto "Alterando..."
- Erro `INVALID_CURRENT_PASSWORD`: "Senha atual incorreta"
- Erro `PASSWORD_UNCHANGED`: "A nova senha precisa ser diferente da atual"
- Erro de validação (nova senha curta): mensagem inline no campo
- Sucesso: mensagem de confirmação, volta pro `/perfil`

## Navegação
- Acessível a partir do link "Alterar" na seção de senha do `/perfil` (FUC03)
- "Cancelar" volta pro `/perfil` sem salvar

## Definição de pronto
- [ ] Tela reflete o padrão visual já estabelecido
- [ ] Troca de senha bem-sucedida (e login funciona com a senha nova depois)
- [ ] Erro de senha atual incorreta exibido corretamente
- [ ] Erro de nova senha igual à atual exibido corretamente
- [ ] Teste E2E (Playwright) cobrindo o fluxo principal, incluindo login
  com a senha antiga falhando e com a nova funcionando

## Referências
- Backend: UC05