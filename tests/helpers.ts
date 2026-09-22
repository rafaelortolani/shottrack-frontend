/**
 * Helpers de teste E2E. Criam dados direto no backend (via fetch) pra
 * preparar cenários, sem depender da UI pra isso — só a parte que
 * o teste realmente quer validar passa pela interface.
 */
import { execSync } from "node:child_process";

const BACKEND_URL = "http://localhost:8080";
const MAILPIT_URL = "http://localhost:8025";

export function randomEmail() {
  return `teste.${Date.now()}.${Math.floor(Math.random() * 10000)}@shottrack.com`;
}

/**
 * Busca no Mailpit o token do link de confirmação de cadastro (FUC01/FUC10)
 * mais recente endereçado pro email dado. Usa a busca filtrada por
 * destinatário (`to:`), não a última mensagem da caixa inteira — os testes
 * de cadastro e de completar cadastro rodam em arquivos diferentes e podem
 * ser escalonados em paralelo por workers distintos, então "a mensagem mais
 * recente" pode ser de outro teste.
 */
export async function getLatestRegistrationToken(recipient: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}&limit=1`
    );
    const { messages } = await response.json();
    const latest = messages?.[0];

    if (latest) {
      const match = latest.Snippet?.match(/token=([\w-]+)/);
      if (match) {
        return match[1];
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Não encontrei o link de cadastro pra ${recipient} no Mailpit`);
}

/**
 * Cria um usuário fazendo o fluxo real de cadastro em duas etapas
 * (FUC01/FUC10): solicita o cadastro, pega o token do link no Mailpit e
 * completa o cadastro — não existe mais um endpoint de criação direta no
 * backend (UC01 revisado/UC23).
 */
export async function createUser(email: string, password = "senha12345") {
  const registrationResponse = await fetch(`${BACKEND_URL}/api/users/registration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!registrationResponse.ok) {
    throw new Error(`Falha ao solicitar cadastro de teste: ${registrationResponse.status}`);
  }

  const token = await getLatestRegistrationToken(email);

  const completionResponse = await fetch(`${BACKEND_URL}/api/users/registration/completion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, name: "Usuário de Teste", password }),
  });
  if (!completionResponse.ok) {
    throw new Error(`Falha ao completar cadastro de teste: ${completionResponse.status}`);
  }
  return completionResponse.json();
}

/**
 * Força a expiração de um token de cadastro pendente pra testar o estado de
 * link expirado (FUC10) sem esperar 24h de verdade — não existe endpoint
 * pra isso, então ajusta a linha direto no Postgres (mesmo container que já
 * roda pro backend local), mantendo o teste como integração real e não uma
 * simulação da API.
 */
export function expireRegistrationToken(token: string) {
  if (!/^[\w-]+$/.test(token)) {
    throw new Error(`Token de cadastro com formato inesperado: ${token}`);
  }

  const containerId = execSync(`docker ps --filter "publish=5432" --format "{{.ID}}"`)
    .toString()
    .trim()
    .split("\n")[0];

  if (!containerId) {
    throw new Error("Não encontrei o container do Postgres (porta 5432) pra simular expiração de token");
  }

  execSync(
    `docker exec ${containerId} psql -U shottrack -d shottrack -c "UPDATE pending_registrations SET expires_at = now() - interval '1 day' WHERE token = '${token}'"`,
    { stdio: "pipe" }
  );
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

export async function getResultTypeCatalog(accessToken: string): Promise<Modality[]> {
  const response = await fetch(`${BACKEND_URL}/api/result-type-catalog`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar catálogo de tipos de resultado: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

/**
 * Tipos de resultado já configurados pra uma modalidade praticada —
 * inclui a sugestão padrão aplicada automaticamente pelo backend
 * (ADR-0011) assim que a modalidade é praticada pela primeira vez.
 */
export async function getConfiguredResultTypes(accessToken: string, modalityId: string): Promise<Modality[]> {
  const response = await fetch(`${BACKEND_URL}/api/practiced-modalities/${modalityId}/result-types`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar tipos de resultado configurados de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function addConfiguredResultType(accessToken: string, modalityId: string, resultTypeId: string) {
  const response = await fetch(`${BACKEND_URL}/api/practiced-modalities/${modalityId}/result-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ resultTypeId }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao configurar tipo de resultado de teste: ${response.status}`);
  }
  return response.json();
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

export async function getAmmunitionManufacturers(accessToken: string): Promise<WeaponCatalogItem[]> {
  const response = await fetch(`${BACKEND_URL}/api/ammunition-catalog/manufacturers`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar fabricantes de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function registerAmmunition(accessToken: string, payload: Record<string, unknown>) {
  const response = await fetch(`${BACKEND_URL}/api/ammunitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Falha ao cadastrar munição de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function getAccessoryTypes(accessToken: string): Promise<WeaponCatalogItem[]> {
  const response = await fetch(`${BACKEND_URL}/api/accessory-catalog/types`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar tipos de acessório de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function registerAccessory(accessToken: string, payload: Record<string, unknown>) {
  const response = await fetch(`${BACKEND_URL}/api/accessories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Falha ao cadastrar acessório de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function startVisit(accessToken: string, trainingLocationId: string) {
  const response = await fetch(`${BACKEND_URL}/api/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ trainingLocationId }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao iniciar visita de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function closeVisit(accessToken: string, visitId: string) {
  const response = await fetch(`${BACKEND_URL}/api/visits/${visitId}/closure`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao encerrar visita de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function openTraining(accessToken: string, visitId: string, modalityId: string) {
  const response = await fetch(`${BACKEND_URL}/api/trainings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ visitId, modalityId }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao abrir treino de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function closeTraining(accessToken: string, trainingId: string) {
  const response = await fetch(`${BACKEND_URL}/api/trainings/${trainingId}/closure`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Falha ao encerrar treino de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function registerSeries(accessToken: string, payload: Record<string, unknown>) {
  const response = await fetch(`${BACKEND_URL}/api/series`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Falha ao registrar série de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function registerTrainingLocation(accessToken: string, payload: Record<string, unknown>) {
  const response = await fetch(`${BACKEND_URL}/api/training-locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Falha ao cadastrar local de treino de teste: ${response.status}`);
  }
  const { data } = await response.json();
  return data;
}

export async function associateAccessoryWeapon(accessToken: string, accessoryId: string, weaponId: string) {
  const response = await fetch(`${BACKEND_URL}/api/accessories/${accessoryId}/weapons`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ weaponId }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao associar arma de teste: ${response.status}`);
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