import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app: Express = express();

// ─── TRUST PROXY (proxy Replit) ───────────────────────────────────────────────
// Obligatoire pour que le rate-limiting se base sur l'IP réelle du client
// et non l'IP interne du proxy.
app.set("trust proxy", 1);

// ─── LOGGING ──────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── HEADERS DE SÉCURITÉ HTTP (Helmet) ───────────────────────────────────────
// Protège contre le clickjacking (X-Frame-Options), le sniffing MIME
// (X-Content-Type-Options), active HSTS, etc.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Seuls les domaines TRIXHUB (Replit) et localhost (dev) sont autorisés.
// Cela bloque les requêtes cross-origin venant de sites tiers non autorisés.
const ALLOWED_ORIGINS_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /\.replit\.app$/,
  /\.repl\.co$/,
  /\.replit\.dev$/,
  /\.janeway\.replit\.dev$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = ALLOWED_ORIGINS_PATTERNS.some((p) => p.test(origin));
      if (allowed) return callback(null, true);
      callback(new Error(`CORS: origine non autorisée — ${origin}`));
    },
    credentials: true,
  }),
);

// ─── RATE LIMITING GLOBAL ─────────────────────────────────────────────────────
// 300 requêtes par 15 minutes par IP pour tous les endpoints.
// Les webhooks (appelés par AccountPE, pas par les utilisateurs) sont exclus.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
  },
  skip: (req) =>
    req.url?.startsWith("/api/accountpe/webhook") === true ||
    req.url?.startsWith("/api/webhook/") === true,
});

app.use(globalLimiter);

// ─── BODY PARSERS ─────────────────────────────────────────────────────────────
// rawBody est conservé en Buffer pour la vérification HMAC-SHA256 des webhooks.
// Limite à 1 Mo pour éviter les attaques par payload surdimensionné.
app.use(
  express.json({
    limit: "1mb",
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
