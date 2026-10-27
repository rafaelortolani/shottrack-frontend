import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso — ShotTrack" };

export default function TermosPage() {
  return <LegalPage document="termos-de-uso" />;
}
