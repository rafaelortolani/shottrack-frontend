"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { ExportDataDialog } from "@/components/ExportDataDialog";
import { tooManyRequestsMessage } from "@/lib/rateLimit";
import { safeFetch } from "@/lib/safeFetch";

function todayStamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

/** Nome do arquivo vindo do Content-Disposition do backend; cai no padrão se faltar. */
function filenameFrom(disposition: string | null) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? `shottrack-dados-${todayStamp()}.json`;
}

export default function PrivacidadeTabPage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDownload(password: string) {
    setDownloadError(null);
    setDownloading(true);

    const response = await safeFetch("/api/users/me/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password }),
    });

    if (!response.ok) {
      setDownloading(false);
      const { error } = await response.json().catch(() => ({ error: null }));

      // o backend responde 401 também para senha errada: confere o código antes de tratar como sessão expirada
      if (error?.code === "INVALID_CURRENT_PASSWORD") {
        setDownloadError("Senha atual incorreta");
      } else if (response.status === 401) {
        router.push("/login");
      } else if (response.status === 429) {
        setDownloadError(tooManyRequestsMessage(response.headers.get("Retry-After")));
      } else {
        setDownloadError(error?.message ?? "Não foi possível baixar seus dados");
      }
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filenameFrom(response.headers.get("Content-Disposition"));
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloading(false);
    setExportDialogOpen(false);
  }

  function closeExportDialog() {
    setExportDialogOpen(false);
    setDownloadError(null);
  }

  async function handleDelete(password: string) {
    setDeleteError(null);
    setDeleting(true);

    const response = await safeFetch("/api/users/me/deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.push("/login?conta=excluida");
      return;
    }

    setDeleting(false);
    const { error } = await response.json().catch(() => ({ error: null }));

    if (response.status === 429) {
      setDeleteError(tooManyRequestsMessage(response.headers.get("Retry-After")));
    } else if (error?.code === "INVALID_CURRENT_PASSWORD") {
      setDeleteError("Senha atual incorreta");
    } else if (response.status === 401) {
      router.push("/login");
    } else {
      setDeleteError(error?.message ?? "Não foi possível excluir a conta");
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setDeleteError(null);
  }

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ href: "/usuario", label: "Usuário" }, { label: "Privacidade" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Privacidade</h1>

      <section aria-labelledby="seus-dados" className="rounded-md bg-surface p-5">
        <h2 id="seus-dados" className="font-display text-base font-semibold mb-1">
          Seus dados
        </h2>
        <p className="text-sm text-foreground-muted mb-3">
          Baixe uma cópia de tudo o que guardamos sobre você — perfil, acervo, treinos, séries e
          resultados — em um arquivo JSON.
        </p>
        <button
          type="button"
          onClick={() => setExportDialogOpen(true)}
          className="rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium py-2 px-4 transition-colors"
        >
          Baixar meus dados
        </button>
      </section>

      <section aria-labelledby="excluir-conta" className="rounded-md bg-surface p-5 border-l-2 border-accent-brass">
        <h2 id="excluir-conta" className="font-display text-base font-semibold mb-1">
          Excluir minha conta
        </h2>
        <p className="text-sm text-foreground-muted mb-3">
          A exclusão é definitiva: apaga sua conta e todos os seus dados, e não dá para desfazer.
          Se quiser guardar uma cópia, baixe seus dados antes.
        </p>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded-md bg-accent-brass hover:bg-accent-brass/85 text-foreground text-sm font-medium py-2 px-4 transition-colors"
        >
          Excluir minha conta
        </button>
      </section>

      <p className="text-sm text-foreground-muted">
        <Link href="/termos" className="text-accent-brass hover:text-accent-brass-soft transition-colors">
          Termos de Uso
        </Link>
        {" · "}
        <Link href="/privacidade" className="text-accent-brass hover:text-accent-brass-soft transition-colors">
          Política de Privacidade
        </Link>
      </p>

      {exportDialogOpen && (
        <ExportDataDialog busy={downloading} error={downloadError} onConfirm={handleDownload} onCancel={closeExportDialog} />
      )}

      {dialogOpen && (
        <DeleteAccountDialog busy={deleting} error={deleteError} onConfirm={handleDelete} onCancel={closeDialog} />
      )}
    </div>
  );
}
