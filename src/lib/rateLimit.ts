/**
 * Mensagem do 429 (TOO_MANY_REQUESTS, ADR-0018). Usa o Retry-After (em
 * segundos) quando o BFF o repassa; sem ele, a versão genérica.
 */
export function tooManyRequestsMessage(retryAfter: string | null): string {
  const seconds = Number(retryAfter);

  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) {
    return "Muitas tentativas. Tente novamente em alguns minutos.";
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `Muitas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
  }

  const hours = Math.ceil(minutes / 60);
  return `Muitas tentativas. Tente novamente em ${hours} ${hours === 1 ? "hora" : "horas"}.`;
}
