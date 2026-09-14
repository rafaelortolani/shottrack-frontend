# FUC01 - Tela de cadastro

## Objetivo
Permitir que um visitante crie uma conta no ShotTrack pela interface web.

## Referência backend
UC01 (cadastro de usuário) — `POST /api/users`

## Campos do formulário
- Nome (texto, obrigatório)
- Email (texto, obrigatório, formato de email)
- Senha (senha, obrigatório, mínimo 8 caracteres)

## Validações no cliente
Espelham as regras do backend, pra dar feedback antes de enviar:
- Nome não pode ficar vazio
- Email precisa ter formato válido
- Senha precisa ter no mínimo 8 caracteres

Mesmo com validação no cliente, o formulário sempre trata a resposta de
erro do backend (ex: `EMAIL_ALREADY_REGISTERED`) — validação client-side é
só uma camada de feedback rápido, nunca substitui o tratamento do erro real.

## Estados da tela
- Padrão: formulário vazio, pronto pra preencher
- Enviando: botão desabilitado, texto "Criando conta..."
- Erro de validação (campo específico): mensagem inline abaixo do campo
- Erro `EMAIL_ALREADY_REGISTERED`: mensagem "Já existe uma conta com esse email"
- Sucesso: redireciona pra `/login` com uma mensagem de confirmação

## Navegação
- Link "Já tem conta? Entrar" leva pra `/login`
- Depois do cadastro bem-sucedido, vai direto pra `/login` (não loga
  automaticamente — atleta precisa entrar com as credenciais que acabou de criar)

## Definição de pronto
- [ ] Tela reflete o mockup validado (identidade visual, campos)
- [ ] Cadastro bem-sucedido redireciona pra `/login`
- [ ] Erro de email duplicado exibido corretamente
- [ ] Erros de validação de cada campo exibidos corretamente
- [ ] Estado de carregamento visível durante o envio

## Referências
- Backend: UC01 (docs/use-cases/UC01-cadastro-usuario.md, no repositório shottrack-backend)
