import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateFormationPDF } from "../../artifacts/api-server/src/lib/formationPdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(process.cwd(), "formations-pdf");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Toutes les formations (gratuites + pro + canal-plus) ────────────────────
const FREE_IDS = [
  "vie-financiere",
  "fin-mois-sans-argent",
  "deuxieme-source-revenu",
  "business-stable",
  "revenus-etudes",
  "canal-plus",
  "vendre-whatsapp",
  "convertir-contacts",
  "viral-reseaux",
  "confiance-en-soi",
  "serieux-30-jours",
  "controle-90-jours",
  "meilleure-version",
  "telephone",
  "intelligence-artificielle",
];

const PRO_IDS = [
  "tiktok-monetisable",
  "tiktok-clients",
  "whatsapp-systeme",
  "ia-vendre",
  "whatsapp-business",
  "marketing-affiliation",
  "business-telephone",
  "recruter-trixhub",
];

const ALL: { id: string; type: "gratuite" | "pro" }[] = [
  ...FREE_IDS.map(id => ({ id, type: "gratuite" as const })),
  ...PRO_IDS.map(id => ({ id, type: "pro" as const })),
];

// ─── Génération ──────────────────────────────────────────────────────────────
let ok = 0;
let ko = 0;

for (const { id, type } of ALL) {
  const subDir = path.join(OUT_DIR, type);
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

  const outPath = path.join(subDir, `${id}.pdf`);

  try {
    const doc = generateFormationPDF(id, {
      lokkeUrl: id === "canal-plus" ? "https://trixhub.site/api/formations/lokke/download" : undefined,
    });

    if (!doc) {
      console.error(`  ❌  ${id} — formation introuvable dans formationPdf.ts`);
      ko++;
      continue;
    }

    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    await new Promise<void>((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`  ✅  [${type}] ${id}.pdf  (${sizeKb} Ko)`);
    ok++;
  } catch (err) {
    console.error(`  ❌  ${id} — erreur:`, err);
    ko++;
  }
}

console.log(`\n✅  ${ok} PDFs générés dans : ${OUT_DIR}`);
if (ko > 0) console.log(`❌  ${ko} échec(s)`);
console.log("\nStructure :");
console.log(`  formations-pdf/`);
console.log(`  ├── gratuite/   (${FREE_IDS.length} formations)`);
console.log(`  └── pro/        (${PRO_IDS.length} formations)`);
