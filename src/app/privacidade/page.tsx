import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade — ShotTrack" };

export default function PrivacidadePage() {
  return <LegalPage document="politica-de-privacidade" />;
}
