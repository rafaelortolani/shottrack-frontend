# FUC17 - Boas-vindas (pós-login)

## Objetivo
Tela intermediária depois do login, adaptativa: mostra a configuração
pendente no primeiro acesso, e vira só uma saudação limpa nos acessos
seguintes. Substitui o Dashboard como destino automático pós-login.

## Estrutura de navegação
Rota própria (`/boas-vindas`), dentro do shell normal do app (mesma nav
lateral de Dashboard/Treinos/Acervo/Usuário) — não é uma tela isolada
como login/cadastro. Não tem botão de ação dedicado: sair dela é só
clicar em qualquer item da nav, igual qualquer outra tela.

## Landing condicional (atualiza o FUC15)
Depois do login bem-sucedido:
- **Com visita em andamento**: continua indo direto pra `/treinos`, sem
  passar por boas-vindas — não faz sentido interromper uma sessão ativa
  com uma tela de saudação.
- **Sem visita em andamento**: vai pra `/boas-vindas` (era `/dashboard`
  antes — deixa de ser o destino automático).

`/dashboard` continua existindo como item de menu, sempre acessível.

## Referência backend
Reaproveita `GET /api/dashboard` (UC42) — já retorna onboarding, ação
principal e treinos recentes, tudo que essa tela precisa. Nenhum
endpoint novo.

## Conteúdo — dois estados
**Com pendência de onboarding** (resposta da API traz `onboarding` com
itens pendentes):
- Logo (LogoWordmark), saudação ("Bem-vindo, {nome}")
- Checklist de configuração (mesmos 3 itens do onboarding do Dashboard:
  criar perfil, configurar modalidades, cadastrar arma), com check nos já
  concluídos
- Botão "Continuar configuração" — único CTA da tela, leva pro primeiro
  item pendente

**Sem pendência** (onboarding ausente na resposta):
- Logo, saudação dinâmica pelo horário (Bom dia / Boa tarde / Boa noite)
  + nome
- Uma linha de contexto rápido (ex: "9 treinos este mês · última visita
  há 2 dias", derivado de `trainingsThisMonth` e do treino mais recente
  em `recentTrainings`)
- Sem botão — a pessoa navega pela sidebar normalmente

Anel de fundo (`TargetRings`) maior e mais presente que nas outras telas,
já que essa tela não compete com formulário nenhum.

## Definição de pronto
- [ ] Estado de onboarding com pendência exibido corretamente, com CTA
- [ ] Estado sem pendência exibido corretamente, sem CTA, saudação
  variando pelo horário
- [ ] Landing condicional atualizada (visita ativa → Treinos; senão →
  Boas-vindas, não mais Dashboard)
- [ ] `/dashboard` continua acessível normalmente pela nav
- [ ] Teste E2E (Playwright) cobrindo: login de atleta novo cai em
  boas-vindas com onboarding; login de atleta configurado cai em
  boas-vindas sem CTA, com saudação e dado de contexto corretos; login
  com visita ativa pula direto pra Treinos

## Referências
- Backend: UC42
- FUC15 (Dashboard — onboarding sai de lá, vive só aqui agora)
- FUC13 (Visitas — destino quando há visita ativa)