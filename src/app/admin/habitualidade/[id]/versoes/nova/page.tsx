"use client";

import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { VersionEditor } from "../../../_components/VersionEditor";

export default function NovaVersaoPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <Breadcrumb
        items={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/habitualidade", label: "Habitualidade" },
          { href: `/admin/habitualidade/${id}`, label: "Regra" },
          { label: "Nova versão" },
        ]}
      />
      <h1 className="font-display text-lg font-semibold mb-4">Nova versão</h1>
      <VersionEditor ruleId={id} version={null} />
    </div>
  );
}
