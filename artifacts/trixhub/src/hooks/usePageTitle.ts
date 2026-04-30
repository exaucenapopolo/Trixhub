import { useEffect } from "react";

const SITE_NAME = "TRIXHUB";

/**
 * Met à jour le titre de l'onglet du navigateur.
 * Format : "<pageTitle> — TRIXHUB"
 * Si aucun titre fourni, utilise "TRIXHUB — Plateforme d'affiliation".
 */
export function usePageTitle(pageTitle?: string) {
  useEffect(() => {
    const title = pageTitle
      ? `${pageTitle} — ${SITE_NAME}`
      : `${SITE_NAME} — Plateforme d'affiliation`;
    document.title = title;
    return () => {
      document.title = `${SITE_NAME} — Plateforme d'affiliation`;
    };
  }, [pageTitle]);
}
