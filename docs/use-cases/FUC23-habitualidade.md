# FUC23 — Habitualidade (5ª aba do dashboard)

## Estrutura
Aba "Habitualidade" ao lado de Resumo | Evolução | Recordes | Modalidades, mesmo padrão de
abas (estado na URL `?aba=habitualidade`). Ignora o filtro global de modalidade. Mostra
selo/ponto na aba quando há mudança futura de regra ou nível a reescolher.

## Estados
1. **Sem acompanhamento**: explicação curta e botão "Escolher regra e nível" (UC56).
2. **Acompanhando**: regra (nome e referência legal), nível, janela ("de dd/mm/aaaa a
   hoje"), selo "Cumprido" ou "Faltam N", e uma barra por exigência
   ("Treinos: 5 de 8", "Competições estaduais: 0 de 2") com o descritivo dos filtros.
3. **Nível a reescolher** (`levelRequired`): aviso e seletor de nível da versão vigente.
4. **Regra inativa**: aviso e opção de escolher outra.
5. **Mudança futura** (`upcomingChange`): faixa "A regra muda em dd/mm/aaaa".

## Escolha de regra e nível
Seletor de regra (ativas), depois seletor de nível com as exigências visíveis; confirmar.
Trocar/remover acompanhamento.

## Meta pessoal
Bloco separado: "Minha meta de treinos no ano" com barra (feitos/meta) e edição inline;
remover meta.

## Texto fixo no rodapé da aba
"Controle pessoal. A comprovação oficial é feita pelo seu clube."

## Visita e local (fora da aba, mesmo FUC)
- Formulário de visita/treino: tipo (Treino/Competição) e, se competição, âmbito opcional.
- Formulário de local: caixa "Este local é um clube".

## Definição de pronto
- [x] Todos os estados; escolha e troca; meta pessoal
- [x] Campos novos nos formulários de visita e local
- [x] Mobile/PWA; E2E Playwright; lint e build

## Notas de implementação
- Escolher/trocar/remover e a meta pessoal passam pelo BFF (`/api/habituality/*`, `proxyToBackend`);
  erros do backend aparecem inline na aba.
- Tipo e âmbito ficam no formulário de nova visita/treino; "Este local é um clube" (`ClubField`)
  nos formulários de local. O tipo aparece nas listas de visitas e no detalhe.
- E2E: `tests/habitualidade.spec.ts` (aba, meta, nível perdido, mudança futura, regra inativa,
  erros) e `tests/mobile-smoke.spec.ts` (celular).
