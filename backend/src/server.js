import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { pipelineRouter } from "./routes/pipeline.js";
import { adminRouter } from "./routes/admin.js";
import { ingestionRouter } from "./routes/ingestion.js";
import { bomRouter } from "./routes/bom.js";
import { alertsRouter } from "./routes/alerts.js";
import { privacyRouter } from "./routes/privacy.js";
import { roiRouter } from "./routes/roi.js";
import { enterpriseRouter } from "./routes/enterprise.js";
import { errorHandler, notFound } from "./middleware/error.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", ...env.corsOrigin],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.corsOrigin.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  }
}));

app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, service: "berisa-api", version: "3.0-critical-high-remediation", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/pipeline", pipelineRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ingestion", ingestionRouter);
app.use("/api/bom", bomRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/privacy", privacyRouter);
app.use("/api/roi", roiRouter);
app.use("/api/v1", enterpriseRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => console.log(`Berisa API listening on port ${env.port}`));
