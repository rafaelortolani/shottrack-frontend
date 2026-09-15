# FUC07 - Acervo: Armas

## Objetivo
Permitir que o atleta cadastre, liste, edite e exclua armas do seu acervo.

## Estrutura de navegação
Item "Acervo" na nav principal, com abas — mesmo padrão já usado em
Usuário (Perfil/Modalidades): **Armas** (aba padrão), Munições (FUC08),
Acessórios (FUC09).

Rotas: `/acervo` (aba Armas, padrão), `/acervo/armas/nova` (cadastro),
`/acervo/armas/[id]` (edição).

## Referência backend
- UC06 (cadastrar) — `POST /api/weapons`
- UC07 (listar) — `GET /api/weapons`
- UC08 (excluir) — `DELETE /api/weapons/{id}`
- UC09 (catálogo) — `GET /api/weapon-catalog/types`, `/brands`,
  `/brands/{brandId}/models`, `/calibers`
- UC10 (editar) — `PATCH /api/weapons/{id}`

## Telas (mockups já validados)
1. **Lista** — cards com ícone por tipo, nome/apelido, tipo+calibre.
   Estado vazio: convite pra cadastrar a primeira arma (mockup validado).
2. **Cadastro** — seleção em cascata: Tipo → Marca → Modelo → Calibre
   (todos do catálogo fechado, sem apelido nesse momento — ver observação
   no UC06 do backend).
3. **Edição** — mesmos campos do cadastro + apelido (opcional), e botão
   "Excluir arma".
4. **Bloqueio de exclusão** — se a arma já foi usada (erro `WEAPON_IN_USE`),
   mostra o aviso já validado no mockup, sem permitir a exclusão.

## Estados
- Carregando catálogo/lista
- Salvando (cadastro ou edição)
- Erro de validação por campo (ex: modelo não pertence à marca escolhida)
- Exclusão bloqueada (`WEAPON_IN_USE`)
- Exclusão bem-sucedida: volta pra lista, arma removida

## Definição de pronto
- [ ] As 4 telas refletem os mockups validados
- [ ] Cadastro completo (seleção em cascata) funciona
- [ ] Lista mostra as armas do atleta, estado vazio tratado
- [ ] Edição (incluindo apelido) funciona
- [ ] Bloqueio de exclusão exibido corretamente quando aplicável
- [ ] Exclusão bem-sucedida quando a arma nunca foi usada
- [ ] Teste E2E (Playwright) cobrindo: cadastro, listagem, edição,
  exclusão bem-sucedida

## Referências
- Backend: UC06, UC07, UC08, UC09, UC10, ADR-0003, ADR-0004, ADR-0006