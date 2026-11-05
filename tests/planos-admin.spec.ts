import { test, expect } from "@playwright/test";
import { seedPhotos, setup } from "./foto-helpers";
import { backendJson, createUser, loginAndGetToken, randomEmail } from "./helpers";
import {
  MB,
  createAdmin,
  assignPlanByEmail,
  createAthleteOnPlan,
  defaultPlanCode,
  editLimits,
  listPlans,
  loginAs,
  myPlan,
  openAdminPlans,
  planCard,
  sharedPlan,
  uniquePlanCode,
  updatePlan,
} from "./planos-helpers";

/**
 * FUC27 — Administração: planos e limites. Backend REAL: os planos e atletas são criados pela API do backend e a
 * tela é o que se valida. O backend não exclui plano e aceita no máximo 20 por banco, por isso cada teste cria só
 * o que precisa. Nada aqui edita o plano padrão (FREE), exceto a troca de padrão, que sempre restaura o original.
 */
const limitInput = (card: ReturnType<typeof planCard>, label: string) => card.getByLabel(label, { exact: true });

test.describe("Planos e limites (FUC27) — acesso", () => {
  test("atleta comum não vê o item de menu nem acessa a tela (redireciona), inclusive subcaminhos", async ({ page }) => {
    const email = randomEmail();
    await createUser(email);
    await loginAs(page, email);

    await expect(page.locator("aside").getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
    await page.goto("/admin/planos");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Planos e limites" })).toHaveCount(0);
  });

  test("admin chega pela página Admin, vê o plano padrão com a etiqueta e o número de atletas", async ({ page }) => {
    const admin = await createAdmin();
    await loginAs(page, admin.email);
    await page.goto("/admin");
    await page.getByRole("link", { name: "Planos e limites" }).click();
    await expect(page).toHaveURL(/\/admin\/planos$/);

    const free = planCard(page, "FREE");
    await expect(free.getByRole("heading", { name: "Gratuito" })).toBeVisible();
    await expect(free.getByText("Padrão", { exact: true })).toBeVisible();
    await expect(free.getByText(/\d+ atletas?/)).toBeVisible();
    // valores padrão do backend
    await expect(limitInput(free, "Fotos por série")).toHaveValue("5");
    await expect(limitInput(free, "Fotos por atleta")).toHaveValue("500");
    await expect(limitInput(free, "Espaço total por atleta")).toHaveValue("512");
    await expect(limitInput(free, "Envios de foto por hora")).toHaveValue("30");
    // IA: reservada, desabilitada, com a nota
    await expect(limitInput(free, "Análises de IA por mês")).toBeDisabled();
    await expect(free.getByText("Ainda não aplicado (etapa de análise de alvos)")).toBeVisible();
  });
});

test.describe("Planos e limites (FUC27) — criar, renomear, ativar/desativar, padrão", () => {
  test("cria plano sem cópia (limites padrão) e com cópia de outro plano", async ({ page }, testInfo) => {
    const admin = await openAdminPlans(page);
    const source = await sharedPlan(admin.token, "SRC", testInfo);
    await editLimits(admin.token, source.code, { PHOTOS_PER_SERIES: 7, UPLOADS_PER_HOUR: 11, STORAGE_BYTES_PER_ATHLETE: 64 * MB });
    await page.reload();

    // sem cópia
    const plainCode = uniquePlanCode();
    await page.getByRole("button", { name: "Novo plano" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo plano" });
    await dialog.getByLabel("Nome").fill(`Plano ${plainCode}`);
    await dialog.getByLabel("Código").fill(plainCode.toLowerCase());
    await expect(dialog.getByLabel("Código")).toHaveValue(plainCode); // sempre em maiúsculas
    await expect(dialog.getByText("O código não muda depois de criado.")).toBeVisible();
    await dialog.getByRole("button", { name: "Criar plano" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Plano Plano ${plainCode} criado.` })).toBeVisible();
    const plain = planCard(page, plainCode);
    await expect(limitInput(plain, "Fotos por série")).toHaveValue("5");
    await expect(limitInput(plain, "Espaço total por atleta")).toHaveValue("512");

    // com cópia
    const copyCode = uniquePlanCode();
    await page.getByRole("button", { name: "Novo plano" }).click();
    const copyDialog = page.getByRole("dialog", { name: "Novo plano" });
    await copyDialog.getByLabel("Nome").fill(`Cópia ${copyCode}`);
    await copyDialog.getByLabel("Código").fill(copyCode);
    await copyDialog.getByLabel("Copiar limites de (opcional)").selectOption({ label: source.name });
    await copyDialog.getByRole("button", { name: "Criar plano" }).click();
    const copy = planCard(page, copyCode);
    await expect(copy).toBeVisible();
    await expect(limitInput(copy, "Fotos por série")).toHaveValue("7");
    await expect(limitInput(copy, "Envios de foto por hora")).toHaveValue("11");
    await expect(limitInput(copy, "Espaço total por atleta")).toHaveValue("64");

    const plans = await listPlans(admin.token);
    expect(plans.find((p) => p.code === plainCode)?.limits.find((l) => l.key === "PHOTOS_PER_SERIES")?.value).toBe(5);
    expect(plans.find((p) => p.code === copyCode)?.limits.find((l) => l.key === "STORAGE_BYTES_PER_ATHLETE")?.value).toBe(64 * MB);
  });

  test("o diálogo valida o código no cliente e mostra os erros do backend inline (código e nome repetidos)", async ({ page }) => {
    const admin = await openAdminPlans(page);
    const attemptedCodes: string[] = ["1ABC", "FREE"];

    await page.getByRole("button", { name: "Novo plano" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo plano" });
    const create = dialog.getByRole("button", { name: "Criar plano" });

    // formato inválido e nome curto: nem chega ao backend
    await dialog.getByLabel("Nome").fill("A");
    await dialog.getByLabel("Código").fill("1ABC");
    await create.click();
    await expect(dialog.getByRole("alert").filter({ hasText: /Código inválido/ })).toBeVisible();
    await expect(dialog.getByRole("alert").filter({ hasText: /nome deve ter de 2 a 60/ })).toBeVisible();

    // código já existente (o do plano padrão)
    await dialog.getByLabel("Nome").fill(`Outro ${uniquePlanCode()}`);
    await dialog.getByLabel("Código").fill("FREE");
    await create.click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Já existe um plano com este código." })).toBeVisible();

    // nome já existente
    const unusedCode = uniquePlanCode();
    attemptedCodes.push(unusedCode);
    await dialog.getByLabel("Nome").fill("Gratuito");
    await dialog.getByLabel("Código").fill(unusedCode);
    await create.click();
    await expect(dialog.getByRole("alert").filter({ hasText: "Já existe um plano com este nome." })).toBeVisible();

    // Esc fecha sem criar nada
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // nenhuma das tentativas criou plano (o código FREE é o do plano que já existia)
    const plans = await listPlans(admin.token);
    expect(plans.filter((p) => attemptedCodes.includes(p.code)).map((p) => p.code)).toEqual(["FREE"]);
    expect(plans.find((p) => p.code === "FREE")?.name).toBe("Gratuito");
  });

  test("renomeia um plano; nome repetido dá erro inline", async ({ page }, testInfo) => {
    const admin = await openAdminPlans(page);
    const plan = await sharedPlan(admin.token, "RENAME", testInfo);
    await page.reload();
    const card = planCard(page, plan.code);

    await card.getByRole("button", { name: "Renomear" }).click();
    await card.getByLabel("Nome do plano").fill("Gratuito");
    await card.getByRole("button", { name: "Salvar nome" }).click();
    await expect(card.getByRole("alert").filter({ hasText: "Já existe um plano com este nome." })).toBeVisible();

    const newName = `Renomeado ${plan.code}`;
    await card.getByLabel("Nome do plano").fill(newName);
    await card.getByRole("button", { name: "Salvar nome" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Plano renomeado para ${newName}.` })).toBeVisible();
    await expect(planCard(page, plan.code).getByRole("heading", { name: newName })).toBeVisible();
    expect((await listPlans(admin.token)).find((p) => p.code === plan.code)?.name).toBe(newName);
  });

  test("desativa com confirmação (mostra os atletas), o plano some do seletor de atribuição, quem o tem o mantém; reativa; histórico com conta excluída", async ({ page }, testInfo) => {
    const admin = await openAdminPlans(page);
    const plan = await sharedPlan(admin.token, "LIFE", testInfo);
    const athlete = await createAthleteOnPlan(admin.token, plan.code);
    await page.reload();
    const card = planCard(page, plan.code);
    await expect(card.getByText(/\d+ atletas?/)).toBeVisible();

    // desativar: a confirmação diz quantos atletas e que quem já tem o plano o mantém
    await card.getByRole("button", { name: "Desativar" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/\d+ (atleta tem|atletas têm) este plano\./)).toBeVisible();
    await expect(dialog.getByText("Quem já tem este plano mantém o plano e os limites; ele só deixa de poder ser atribuído a outros atletas.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    expect((await listPlans(admin.token)).find((p) => p.code === plan.code)?.active).toBe(true);

    await card.getByRole("button", { name: "Desativar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(planCard(page, plan.code).getByText("Inativo", { exact: true })).toBeVisible();
    await expect(planCard(page, plan.code)).toHaveClass(/opacity-70/); // esmaecido
    await expect(planCard(page, plan.code).getByRole("button", { name: "Definir como padrão" })).toHaveCount(0);
    expect((await myPlan(athlete.token)).plan.code).toBe(plan.code); // quem já tem mantém

    // aba Atletas: o resultado mostra o plano inativo; o seletor só oferece planos ativos
    await page.getByRole("tab", { name: "Atletas" }).click();
    await page.getByLabel("E-mail do atleta").fill(athlete.email);
    await page.getByRole("button", { name: "Buscar" }).click();
    const row = page.getByRole("list", { name: "Resultado da busca" }).getByRole("listitem");
    await expect(row.getByText(athlete.email)).toBeVisible();
    await expect(row.getByText("Inativo", { exact: true })).toBeVisible();
    const select = row.getByLabel("Novo plano");
    await expect(select.locator("option", { hasText: plan.name })).toHaveCount(0);
    await expect(select.locator("option", { hasText: "Gratuito" })).toHaveCount(1);

    // reativar: volta ao seletor
    await page.getByRole("tab", { name: "Limites" }).click();
    await planCard(page, plan.code).getByRole("button", { name: "Ativar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(planCard(page, plan.code).getByText("Inativo", { exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Atletas" }).click();
    await page.getByLabel("E-mail do atleta").fill(athlete.email);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByLabel("Novo plano").locator("option", { hasText: plan.name })).toHaveCount(1);

    // histórico: ativação/desativação registradas; depois de excluir a conta, o alvo vira "conta excluída"
    await page.getByRole("tab", { name: "Limites" }).click();
    const audit = page.getByRole("region", { name: "Histórico" });
    await expect(audit.getByText(`Plano ${plan.code}: situação: ativo → inativo`)).toBeVisible();
    await expect(audit.getByText(`Plano ${plan.code}: situação: inativo → ativo`)).toBeVisible();
    await expect(audit.getByText(`Plano de Usuário de Teste (${athlete.email}): FREE → ${plan.code}`)).toBeVisible();

    const deletion = await backendJson(athlete.token, "/api/users/me/deletion", "POST", { password: "senha12345" });
    expect(deletion.status).toBe(200);
    await page.reload();
    await expect(page.getByRole("region", { name: "Histórico" }).getByText(`Plano de conta excluída: ${await defaultPlanCode(admin.token)} → ${plan.code}`)).toBeVisible();
  });

  test("plano padrão não pode ser desativado (botão desabilitado com explicação); inativo não vira padrão; a troca de padrão pede confirmação e vale para novos cadastros", async ({ page }, testInfo) => {
    const admin = await openAdminPlans(page);
    const original = await defaultPlanCode(admin.token);
    expect(original).toBe("FREE");
    const next = await sharedPlan(admin.token, "NEXT", testInfo);
    const inactive = await sharedPlan(admin.token, "INACT", testInfo);
    expect((await updatePlan(admin.token, inactive.code, { active: false })).status).toBe(200);
    await page.reload();

    const free = planCard(page, "FREE");
    const deactivate = free.getByRole("button", { name: "Desativar" });
    await expect(deactivate).toBeDisabled();
    await expect(free.getByText("Defina outro plano como padrão antes de desativar este.")).toBeVisible();
    await expect(free.getByRole("button", { name: "Definir como padrão" })).toHaveCount(0); // já é o padrão
    await expect(planCard(page, inactive.code).getByRole("button", { name: "Definir como padrão" })).toHaveCount(0); // inativo

    try {
      await planCard(page, next.code).getByRole("button", { name: "Definir como padrão" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Novos cadastros passarão a receber este plano.")).toBeVisible();
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      expect(await defaultPlanCode(admin.token)).toBe("FREE");

      await planCard(page, next.code).getByRole("button", { name: "Definir como padrão" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
      await expect(planCard(page, next.code).getByText("Padrão", { exact: true })).toBeVisible();
      await expect(planCard(page, "FREE").getByText("Padrão", { exact: true })).toHaveCount(0);
      await expect(planCard(page, "FREE").getByRole("button", { name: "Desativar" })).toBeEnabled();

      // novo cadastro recebe o novo padrão
      const email = randomEmail();
      await createUser(email);
      expect((await myPlan(await loginAndGetToken(email))).plan.code).toBe(next.code);
    } finally {
      expect((await updatePlan(admin.token, "FREE", { default: true })).status).toBe(200);
    }
    expect(await defaultPlanCode(admin.token)).toBe("FREE");
  });
});

test.describe("Planos e limites (FUC27) — limites", () => {
  test("edita limites: validação de faixa inline, MB com 1 casa, restaurar padrão por linha, resumo com aviso e confirmação", async ({ page }, testInfo) => {
    const admin = await openAdminPlans(page);
    const plan = await sharedPlan(admin.token, "LIMITS", testInfo);
    await page.reload();
    const card = planCard(page, plan.code);
    const save = card.getByRole("button", { name: "Salvar alterações" });
    const perSeries = limitInput(card, "Fotos por série");
    const perAthlete = limitInput(card, "Fotos por atleta");
    const storage = limitInput(card, "Espaço total por atleta");
    const perHour = limitInput(card, "Envios de foto por hora");

    await expect(save).toBeDisabled(); // nada mudou

    // restaurar padrão por linha: só vale para o campo; não grava
    await perSeries.fill("8");
    await expect(save).toBeEnabled();
    await card.getByRole("button", { name: "Restaurar padrão: Fotos por série" }).click();
    await expect(perSeries).toHaveValue("5");
    await expect(save).toBeDisabled();
    expect((await listPlans(admin.token)).find((p) => p.code === plan.code)?.limits.find((l) => l.key === "PHOTOS_PER_SERIES")?.value).toBe(5);

    // validação de faixa e formato (a faixa vem do backend)
    await perSeries.fill("21");
    await expect(card.getByRole("alert").filter({ hasText: "Informe um valor de 0 a 20." })).toBeVisible();
    await expect(save).toBeDisabled();
    await perSeries.fill("8");
    await perAthlete.fill("abc");
    await expect(card.getByRole("alert").filter({ hasText: "Informe um valor de 0 a 100.000." })).toBeVisible();
    await perAthlete.fill("300");
    await storage.fill("1,25");
    await expect(card.getByRole("alert").filter({ hasText: /no máximo 1 casa decimal/ })).toBeVisible();
    await storage.fill("102401");
    await expect(card.getByRole("alert").filter({ hasText: /0 a 102\.400 MB/ })).toBeVisible();
    await storage.fill("0,5");
    await perHour.fill("0");
    await expect(card.getByRole("alert").filter({ hasText: "Informe um valor de 1 a 1.000." })).toBeVisible();
    await expect(save).toBeDisabled();
    await perHour.fill("20");
    await expect(card.getByRole("alert")).toHaveCount(0);
    await expect(save).toBeEnabled();

    // resumo antes de salvar, com o aviso fixo; cancelar não grava
    await save.click();
    const dialog = page.getByRole("dialog", { name: "Salvar alterações nos limites?" });
    await expect(dialog.getByText("Fotos por série: 5 → 8")).toBeVisible();
    await expect(dialog.getByText("Fotos por atleta: 500 → 300")).toBeVisible();
    await expect(dialog.getByText("Espaço total por atleta: 512 MB → 0,5 MB")).toBeVisible();
    await expect(dialog.getByText("Envios de foto por hora: 30 → 20")).toBeVisible();
    await expect(dialog.getByText("Reduzir um limite não apaga fotos já enviadas; só impede novos envios.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    expect((await listPlans(admin.token)).find((p) => p.code === plan.code)?.limits.find((l) => l.key === "PHOTOS_PER_SERIES")?.value).toBe(5);

    await save.click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Limites do plano ${plan.name} salvos.` })).toBeVisible();

    // o backend recebeu bytes; a tela mostra de volta em MB e marca como personalizado
    const saved = (await listPlans(admin.token)).find((p) => p.code === plan.code)!;
    const value = (key: string) => saved.limits.find((l) => l.key === key)!.value;
    expect(value("PHOTOS_PER_SERIES")).toBe(8);
    expect(value("PHOTOS_PER_ATHLETE")).toBe(300);
    expect(value("STORAGE_BYTES_PER_ATHLETE")).toBe(524_288);
    expect(value("UPLOADS_PER_HOUR")).toBe(20);
    const fresh = planCard(page, plan.code);
    await expect(limitInput(fresh, "Espaço total por atleta")).toHaveValue("0,5");
    await expect(fresh.getByText(/personalizado/).first()).toBeVisible();
    await expect(fresh.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();

    // histórico atualizado depois da alteração (espaço em MB, não em bytes)
    const audit = page.getByRole("region", { name: "Histórico" });
    await expect(audit.getByText(`Plano ${plan.code}: Fotos por série: 5 → 8`)).toBeVisible();
    await expect(audit.getByText(`Plano ${plan.code}: Espaço total por atleta: 512 MB → 0,5 MB`)).toBeVisible();

    // restaurar o padrão de uma linha e salvar volta ao padrão
    await limitInput(fresh, "Fotos por série").fill("3");
    await fresh.getByRole("button", { name: "Descartar" }).click();
    await expect(limitInput(fresh, "Fotos por série")).toHaveValue("8");
  });
});

test.describe("Planos e limites (FUC27) — atletas", () => {
  test("busca de atleta inexistente, termo curto e troca de plano com confirmação", async ({ page }, testInfo) => {
    const admin = await openAdminPlans(page);
    const plan = await sharedPlan(admin.token, "ATH", testInfo);
    const athlete = await createAthleteOnPlan(admin.token, "FREE");
    await page.reload();
    await page.getByRole("tab", { name: "Atletas" }).click();
    const search = page.getByLabel("E-mail do atleta");
    const submit = page.getByRole("button", { name: "Buscar" });

    // curto demais: nem consulta; inexistente: mensagem própria
    await search.fill("ab");
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "Digite ao menos 3 caracteres do e-mail." })).toBeVisible();
    await search.fill(`inexistente-${uniquePlanCode().toLowerCase()}@nada.example`);
    await submit.click();
    await expect(page.getByText("Atleta não encontrado.")).toBeVisible();

    // acha pelo trecho do e-mail e troca o plano (com confirmação)
    await search.fill(athlete.email.split("@")[0]);
    await submit.click();
    const row = page.getByRole("list", { name: "Resultado da busca" }).getByRole("listitem").filter({ hasText: athlete.email });
    await expect(row.getByText("Plano atual:")).toContainText("Gratuito");
    const change = row.getByRole("button", { name: /Alterar plano de/ });
    await expect(change).toBeDisabled(); // mesmo plano
    await row.getByLabel("Novo plano").selectOption({ label: plan.name });
    await change.click();
    await expect(page.getByRole("dialog").getByText(new RegExp(`de Gratuito para ${plan.name}`))).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    expect((await myPlan(athlete.token)).plan.code).toBe("FREE");

    await change.click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(row.getByText("Plano atual:")).toContainText(plan.name);
    expect((await myPlan(athlete.token)).plan.code).toBe(plan.code);
    await expect(page.getByRole("region", { name: "Histórico" }).getByText(new RegExp(`FREE → ${plan.code}`))).toBeVisible();
  });
});

test.describe("Planos e limites (FUC27) — uso do atleta na busca", () => {
  test("atleta sem fotos mostra zeros; com fotos mostra os números reais; acima do limite do plano é destacado com texto", async ({ page, browser }, testInfo) => {
    // atleta com fotos reais (sessão própria)
    const athleteContext = await browser.newContext();
    const athletePage = await athleteContext.newPage();
    const withPhotos = await setup(athletePage);
    await seedPhotos(athletePage, withPhotos.token, withPhotos.seriesIds[0], 3);
    await athleteContext.close();

    const admin = await openAdminPlans(page);
    const plan = await sharedPlan(admin.token, "ATH", testInfo);
    const empty = await createAthleteOnPlan(admin.token, "FREE");
    await page.getByRole("tab", { name: "Atletas" }).click();

    const search = async (email: string) => {
      await page.getByLabel("E-mail do atleta").fill(email);
      await page.getByRole("button", { name: "Buscar" }).click();
      return page.getByRole("list", { name: "Resultado da busca" }).getByRole("listitem").filter({ hasText: email });
    };

    // sem fotos
    const emptyRow = await search(empty.email);
    await expect(emptyRow.getByTestId("athlete-usage")).toHaveText("Uso: 0 fotos · 0 MB");
    await expect(emptyRow.getByTestId("athlete-over-limit")).toHaveCount(0);

    // com 3 fotos: os mesmos números que o backend informa
    const row = await search(withPhotos.email);
    const usage = (await myPlan(withPhotos.token)).usage;
    expect(usage.photos).toBe(3);
    const mb = Math.round((usage.storageBytes / (1024 * 1024)) * 10) / 10;
    await expect(row.getByTestId("athlete-usage")).toHaveText(`Uso: 3 fotos · ${String(mb).replace(".", ",")} MB`);
    await expect(row.getByTestId("athlete-over-limit")).toHaveCount(0); // 3 de 500

    // plano com limite menor que o uso: destaque em texto, e as fotos continuam
    await editLimits(admin.token, plan.code, { PHOTOS_PER_ATHLETE: 2 });
    await assignPlanByEmail(admin.token, withPhotos.email, plan.code);
    await page.reload();
    await page.getByRole("tab", { name: "Atletas" }).click();
    const overRow = await search(withPhotos.email);
    await expect(overRow.getByTestId("athlete-usage")).toContainText("3 fotos");
    await expect(overRow.getByTestId("athlete-over-limit")).toContainText("Acima do limite do plano: fotos (limite 2).");
    await expect(overRow.getByTestId("athlete-over-limit")).toContainText("só novos envios ficam bloqueados");
  });
});
