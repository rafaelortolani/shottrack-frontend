/**
 * Helpers de teste E2E. Criam dados direto no backend (via fetch) pra
 * preparar cenários, sem depender da UI pra isso — só a parte que
 * o teste realmente quer validar passa pela interface.
 */
const BACKEND_URL = "http://localhost:8080";
const MAILPIT_URL = "http://localhost:8025";

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

/**
 * Busca a mensagem mais recente no Mailpit (dev) endereçada pro
 * destinatário esperado e extrai o código de verificação de 6 dígitos —
 * substitui a leitura manual do código pra o teste rodar sozinho.
 */
export async function getLatestVerificationCode(recipient: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`);
    const { messages } = await response.json();
    const latest = messages?.[0];

    if (latest?.To?.[0]?.Address === recipient) {
      const match = latest.Snippet?.match(/\d{6}/);
      if (match) {
        return match[0];
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Não encontrei o código de verificação pra ${recipient} no Mailpit`);
}