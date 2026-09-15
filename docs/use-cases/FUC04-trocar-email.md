# FUC04 - Trocar email

## Objetivo
Permitir que o atleta troque o email de login, com verificação por código
(reflete a decisão do backend, ADR-0002/ADR-0007 equivalente de verificação).

## Referência backend
- UC04 (parte de troca de email) — `POST /api/users/me/email` (solicita)
  e `POST /api/users/me/email/confirmation` (confirma)

## Fluxo — duas etapas na mesma tela (ou dois passos, ver mockup)

### Etapa 1 — solicitar novo email
- Campo: novo email (obrigatório, formato de email)
- Ao confirmar, backend envia um código de 6 dígitos pro **novo** email
  (em dev, aparece no Mailpit — `http://localhost:8025`)
- Login continua com o email antigo até a confirmação

### Etapa 2 — confirmar código
- Campo: código de 6 dígitos (mockup já validado: 6 caixas individuais)
- Mensagem mostrando pra qual email o código foi enviado
- Link "Reenviar código"
- Expira em 15 minutos

## Estados da tela
- Etapa 1, enviando: botão desabilitado
- Etapa 1, erro `EMAIL_ALREADY_REGISTERED`: "Esse email já está em uso por outra conta"
- Etapa 2, código incorreto: erro `INVALID_VERIFICATION_CODE` → "Código incorreto"
- Etapa 2, código expirado: erro `VERIFICATION_CODE_EXPIRED` → "Código expirado, peça um novo"
- Etapa 2, sucesso: confirma troca, volta pro `/perfil` com o novo email já refletido

## Navegação
- Acessível a partir do link "Alterar" na seção de email do `/perfil` (FUC03)
- "Voltar" na etapa 2 retorna pra etapa 1 (permite corrigir o email digitado)

## Definição de pronto
- [ ] Tela reflete o mockup validado (etapa 1 e etapa 2)
- [ ] Fluxo completo funciona de ponta a ponta (testável via Mailpit)
- [ ] Erro de email já cadastrado exibido corretamente
- [ ] Erro de código incorreto exibido corretamente
- [ ] Teste E2E (Playwright) cobrindo o fluxo completo, lendo o código
  direto do backend/Mailpit (não da UI) pra não depender de interação manual

## Referências
- Backend: UC04, ADR-0002/ADR-0007 (mecanismo de verificação por código)