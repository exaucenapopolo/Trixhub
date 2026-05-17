import app from "./app";
import { logger } from "./lib/logger";
import { warmupServices } from "./lib/swychr";
import { checkAllPendingTransactions } from "./lib/paymentProcessor";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Pré-chauffe les tokens et les méthodes AccountPE en arrière-plan
  setTimeout(() => {
    warmupServices().catch((e) => logger.warn({ err: e }, "[AccountPE] warmup échoué"));
  }, 2_000);

  // Cron : vérification automatique des transactions en attente toutes les 5 minutes.
  // Garantit que les paiements réussis sont traités même si le webhook ou le polling
  // frontend a échoué (utilisateur qui ferme le navigateur, réseau instable, etc.)
  const PENDING_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  setTimeout(() => {
    checkAllPendingTransactions(logger).catch((e) =>
      logger.warn({ err: e }, "[cron] checkAllPendingTransactions échoué"),
    );
    setInterval(() => {
      checkAllPendingTransactions(logger).catch((e) =>
        logger.warn({ err: e }, "[cron] checkAllPendingTransactions échoué"),
      );
    }, PENDING_CHECK_INTERVAL_MS);
  }, 30_000); // Première vérification 30s après démarrage
});
