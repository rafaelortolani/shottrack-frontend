import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertTestEnvironment, BACKEND_URL, BASE_URL, E2E_BACKEND_PORT, E2E_DB } from "./e2e-env";
import { createUser, randomEmail, runSql } from "./helpers";

/**
 * Travas antes da suíte (a 1ª, estática, já roda no playwright.config):
 *  1. as URLs são as de teste;
 *  2. o processo que escuta a porta do backend não aponta para outro banco;
 *  3. um usuário-sonda criado pelo backend aparece no banco `shottrack_test`
 *     (prova de que o backend grava no banco de teste);
 *  4. o front de teste conversa com esse backend (login do usuário-sonda pelo BFF).
 * Qualquer falha aborta a execução com a instrução de como corrigir.
 */
function backendProcessEnvironment(): string | null {
  try {
    const pid = execSync(`ss -ltnpH 'sport = :${E2E_BACKEND_PORT}'`).toString().match(/pid=(\d+)/)?.[1];
    return pid ? readFileSync(`/proc/${pid}/environ`, "utf8") : null;
  } catch {
    return null; // sem /proc (não-Linux) ou sem permissão: a sonda (3) cobre
  }
}

export default async function globalSetup() {
  assertTestEnvironment();

  const environment = backendProcessEnvironment();
  const datasource = environment?.match(/SPRING_DATASOURCE_URL=([^\0]*)/)?.[1];
  if (datasource !== undefined && !datasource.endsWith(`/${E2E_DB}`)) {
    throw new Error(`E2E recusado: o backend na porta ${E2E_BACKEND_PORT} aponta para ${datasource}, não para ${E2E_DB}.`);
  }

  const email = randomEmail();
  await createUser(email);
  if (!runSql(`SELECT 1 FROM users WHERE email = '${email}'`).includes("1")) {
    throw new Error(`E2E recusado: o backend em ${BACKEND_URL} não grava no banco ${E2E_DB}.`);
  }

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "senha12345" }),
  });
  if (!login.ok) {
    throw new Error(`E2E recusado: o front ${BASE_URL} não está ligado ao backend de teste ${BACKEND_URL}.`);
  }
}
