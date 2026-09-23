# FUC15 - Dashboard com dados reais e landing condicional

## Objetivo
Substituir os dados fictícios do dashboard por dados reais, e fazer a
página inicial depender do contexto (visita em andamento ou não).

## Referência backend
UC42 — `GET /api/dashboard` (conferir rota exata no Swagger)

## Landing condicional (pós-login)
Depois do login bem-sucedido:
- **Se o atleta tem visita `EM_ANDAMENTO`** → redireciona pra `/treinos`
  (aba Visitas), direto na visita ativa, sem passar pelo Dashboard
- **Se não tem visita em andamento** → redireciona pra `/dashboard`,
  como já era antes

`/dashboard` continua existindo como item de menu próprio, sempre
acessível a qualquer momento — a mudança é só qual tela aparece
automaticamente depois de logar.

## Tela do Dashboard
Substitui os dados fictícios (hoje hardcoded no componente) pelos dados
reais de `GET /api/dashboard`:
- Destaque dinâmico (UC42) — número grande: melhor valor do tipo de
  resultado mais registrado pelo atleta ("Melhor <tipo>"); "—" enquanto
  não houver resultado numérico registrado
- Treinos esse mês, Disparos esse mês, Modalidades praticadas —
  estatísticas secundárias
- Visitas recentes — lista, já existente, agora com dados reais (local,
  modalidades, data)

## Estados
- Carregando: enquanto busca `GET /api/dashboard`
- Atleta sem nenhum dado ainda: números aparecem como "—" ou "0", lista
  de visitas recentes mostra um estado vazio convidando a iniciar a
  primeira visita (link pra `/treinos`), em vez de card vazio sem
  explicação

## Definição de pronto
- [ ] Landing condicional funciona (visita ativa → Treinos, senão → Dashboard)
- [ ] Dashboard exibe destaque e estatísticas reais, vindos da API
- [ ] Visitas recentes exibidas com dados reais
- [ ] Estado de atleta sem dados tratado com convite pra ação, não card vazio
- [ ] Teste E2E (Playwright) cobrindo: login sem visita ativa cai no
  Dashboard, login com visita ativa cai em Treinos, números do dashboard
  batem com dados reais criados no teste

## Referências
- Backend: UC42
- FUC13 (Visitas — destino da landing condicional)