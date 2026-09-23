# FUC14 - Registro rápido de série

## Objetivo
Permitir registrar e completar séries dentro de um treino, com o mínimo
de passos possível — reflete o princípio "registrar primeiro, organizar
depois" do produto.

## Estrutura de navegação
Sem rota própria — vive dentro da tela de Visitas (FUC13). Cada treino
(na visita ativa, ou num treino de uma visita do histórico) é expansível
(accordion): ao tocar, mostra a lista compacta de séries já registradas e
o card de registro rápido de nova série. Na visita ativa, treino em
andamento já abre expandido — treino recém-aberto mostra direto o estado
vazio abaixo; treino encerrado e treinos do histórico começam recolhidos.

Treino encerrado continua permitindo **editar** séries existentes
(completar dados depois é legítimo mesmo após o treino acabar), mas não
permite **registrar série nova** (mesma regra do UC36 — precisa do treino
`EM_ANDAMENTO`).

## Estado vazio: treino sem nenhuma série
Enquanto um treino recém-aberto não tem nenhuma série, em vez de mostrar
direto o card de registro rápido (que pode passar despercebido pra quem
não sabe que precisa disso), mostra um bloco de estado vazio primeiro:
ícone, título "Nenhuma série registrada ainda", texto curto ("cada série
é um disparo ou sequência de disparos"), e um **botão** "Registrar série"
em destaque, que revela o card de registro rápido ao ser tocado. Assim
que existir pelo menos uma série, entra o botão secundário (contorno,
ícone +) "Registrar nova série" (a pessoa já entendeu o padrão). Treino encerrado sem série mostra
só o texto, sem botão — não aceita série nova.

## Referência backend
- UC36 (registrar série) — `POST /api/trainings/{trainingId}/series`
- UC37 (listar séries) — `GET /api/trainings/{trainingId}/series`
- UC38 (editar série, parcial) — `PATCH /api/series/{id}`
- UC39 (registrar resultado) — `POST /api/series/{id}/results`
- UC40 (remover resultado) — `DELETE /api/series/{id}/results/{resultTypeId}`
- UC41 (excluir série) — `DELETE /api/series/{id}`
(conferir rotas exatas no Swagger depois de implementado)

## Card de registro rápido
Campos visíveis por padrão (sem precisar expandir nada):
- Arma (seleção do acervo, opcional)
- Quantidade de disparos (numérico, opcional)
- Um campo por tipo de resultado configurado no Perfil de Modalidade
  daquele treino (UC30) — input conforme o tipo (numérico, sim/não, ou
  texto livre), cada um com uma forma de marcar "não aplicável" (ex: um
  toggle "N/A" ao lado do campo)

Atrás de um link "+ mais detalhes" (expansível, fechado por padrão):
- Munição (seleção do acervo, opcional)
- Distância em metros (numérico, opcional)
- Alvo (texto livre, opcional — ver ADR-0013 sobre evolução futura)
- Observações (texto, opcional)

## Salvar
Um único botão "Salvar série" (criação) ou "Salvar alterações" (edição).
Internamente, isso é composto: cria/atualiza a série com os campos base
(UC36/UC38), depois registra ou remove cada resultado alterado (UC39/
UC40) — o atleta não percebe essa composição, só vê uma ação.

## Lista de séries já registradas
Linha compacta por série: número/ordem, resumo dos resultados preenchidos
(ex: "Pontuação: 92") ou "Sem dados ainda" se nada foi preenchido, arma se
houver. Tocar abre o card de edição, pré-preenchido.

## Excluir série
Ação disponível em qualquer série, inclusive de treino encerrado, sem
bloqueio (ADR-0013) — direto na linha da lista ("Excluir") ou pelo card
de edição ("Excluir série"). Confirmação simples, sem aviso de "em uso".

## Estados
- Nenhuma modalidade com tipos de resultado configurados → registro
  rápido funciona normalmente, só sem os campos de resultado (nada a
  mostrar)
- Erro ao salvar (ex: arma/munição inválida) → mensagem inline, sem
  perder o que já foi digitado no formulário

## Definição de pronto
- [ ] Registrar série totalmente vazia funciona (só o clique em "Salvar")
- [ ] Registrar série com campos rápidos preenchidos funciona
- [ ] "+ mais detalhes" expande os campos secundários
- [ ] Marcar um resultado como "não aplicável" funciona
- [ ] Editar uma série já registrada (completar depois) funciona
- [ ] Excluir série funciona
- [ ] Treino encerrado bloqueia nova série mas permite editar existentes
- [ ] Teste E2E (Playwright) cobrindo: registrar série vazia, completar
  depois com arma e um resultado, marcar outro resultado como não
  aplicável, editar um campo, excluir a série

## Referências
- Backend: UC36, UC37, UC38, UC39, UC40, UC41, ADR-0013
- FUC13 (Visitas — tela onde isso se integra)