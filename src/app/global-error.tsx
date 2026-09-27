"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        {/* Página de erro padrão do Next. O App Router não expõe o status
        do erro, então `statusCode={0}` renderiza a mensagem genérica. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
