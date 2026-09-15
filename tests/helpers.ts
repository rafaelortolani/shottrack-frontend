/**
 * Helpers de teste E2E. Criam dados direto no backend (via fetch) pra
 * preparar cenários, sem depender da UI pra isso — só a parte que
 * o teste realmente quer validar passa pela interface.
 */
const BACKEND_URL = "http://localhost:8080";

export function randomEmail() {
  return `teste.${Date.now()}.${Math.floor(Math.random() * 10000)}@shottrack.com`;
}

export async function createUser(email: string, password = "senha12345") {
  const response = await fetch(`${BACKEND_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Usuário de Teste", email, password }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao criar usuário de teste: ${response.status}`);
  }
  return response.json();
}