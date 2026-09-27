# ADR-0017: Observabilidade em produção (planejada — pendência registrada)

## Contexto
O projeto está prestes a subir pra um ambiente de produção real (Magalu
Cloud). Hoje não existe nenhuma camada de observabilidade além dos logs
padrão do Spring Boot no console e do painel de management do RabbitMQ
(usado manualmente durante desenvolvimento). Sem isso em produção, um
problema só é percebido quando alguém esbarra nele manualmente — não há
como saber, de forma proativa, que algo quebrou.

## Decisão
Observabilidade planejada em duas ondas.

**Onda 1 — antes ou logo após o primeiro deploy (baixo esforço, alto retorno):**
- **Sentry** (plano gratuito) pra rastreamento de erro, tanto no backend
  (Spring Boot) quanto no frontend (Next.js) — captura exceptions não
  tratadas com stack trace e contexto.
- **Health check + alerta de disponibilidade**: habilitar o Spring Boot
  Actuator (`/actuator/health`), monitorado por um serviço externo (ex:
  UptimeRobot, gratuito) que avisa por email/SMS se a aplicação cair.
- **Logs estruturados em arquivo** (JSON, com rotação via `logrotate`) —
  suficiente pra investigação manual via SSH nesse estágio, sem precisar
  de um serviço agregador de logs ainda.

**Onda 2 — adiada até o uso justificar (não implementar agora):**
- Métricas + dashboard (Prometheus + Grafana) — visão de tendência ao
  longo do tempo; peso de infraestrutura que só compensa com histórico
  de uso suficiente pra ter o que olhar.
- Alerta de profundidade de fila do RabbitMQ (mensagens acumulando sem
  consumir, sinal de consumidor caído) — relevante especialmente pro
  recalculador do dashboard (ADR-0015), já que uma falha ali é silenciosa
  por natureza (dado desatualizado, sem erro visível pro atleta).
- Tracing distribuído — baixo retorno pra um monólito numa VM só; só
  compensa se a arquitetura ficar mais distribuída no futuro.

## Alternativas consideradas
- Implementar tudo (Onda 1 + Onda 2) antes do primeiro deploy → rejeitado:
  Onda 2 é complexidade real (mais serviços rodando, mais manutenção) sem
  volume de uso que justifique ainda — mesmo raciocínio já aplicado a
  outras decisões de "adiar até ter necessidade real" no projeto.
- Não ter observabilidade nenhuma no primeiro deploy → rejeitado: mesmo
  a Onda 1 sozinha já é esforço baixo o suficiente pra não valer o risco
  de subir sem nenhuma visibilidade de erro em produção.

## Consequências
- Precisa criar conta no Sentry e instrumentar backend (dependência
  `sentry-spring-boot-starter` ou equivalente) e frontend (SDK
  `@sentry/nextjs`).
- Precisa habilitar o Spring Boot Actuator (já é dependência padrão do
  ecossistema Spring, só falta configurar exposição do endpoint de health).
- Nenhuma mudança de arquitetura necessária pra Onda 1 — é só
  instrumentação, não afeta nenhum domínio de negócio já implementado.
- Onda 2 fica registrada como pendência explícita — revisitar quando o
  volume de uso (ou um incidente real na fila) justificar.

## Referências
- ADR-0015 (dashboard pré-calculado via fila — motivo principal do alerta
  de profundidade de fila na Onda 2)