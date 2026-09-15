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

export type Modality = { id: string; name: string };

export async function loginAndGetToken(email: string, password = "senha12345") {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao logar usuário de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data.accessToken as string;
}

export async function getModalityCatalog(accessToken: string): Promise<Modality[]> {
  const response = await fetch(`${BACKEND_URL}/api/modality-catalog`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar catálogo de modalidades: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function addPracticedModality(accessToken: string, modalityId: string) {
  const response = await fetch(`${BACKEND_URL}/api/practiced-modalities`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ modalityId }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao adicionar modalidade praticada de teste: ${response.status}`);
  }
  return response.json();
}

export type WeaponCatalogItem = { id: string; name: string };

export async function getWeaponCatalog(accessToken: string) {
  const [typesRes, brandsRes, calibersRes] = await Promise.all([
    fetch(`${BACKEND_URL}/api/weapon-catalog/types`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    fetch(`${BACKEND_URL}/api/weapon-catalog/brands`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    fetch(`${BACKEND_URL}/api/weapon-catalog/calibers`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  ]);
  if (!typesRes.ok || !brandsRes.ok || !calibersRes.ok) {
    throw new Error("Falha ao buscar catálogo de armas de teste");
  }
  const { data: types } = await typesRes.json();
  const { data: brands } = await brandsRes.json();
  const { data: calibers } = await calibersRes.json();
  return { types, brands, calibers } as {
    types: WeaponCatalogItem[];
    brands: WeaponCatalogItem[];
    calibers: WeaponCatalogItem[];
  };
}

export async function getWeaponModels(accessToken: string, brandId: string): Promise<WeaponCatalogItem[]> {
  const response = await fetch(`${BACKEND_URL}/api/weapon-catalog/brands/${brandId}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar modelos de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function registerWeapon(
  accessToken: string,
  weapon: { typeId: string; brandId: string; modelId: string; caliberId: string }
) {
  const response = await fetch(`${BACKEND_URL}/api/weapons`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(weapon),
  });
  if (!response.ok) {
    throw new Error(`Falha ao cadastrar arma de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
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