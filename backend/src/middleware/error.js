import { ZodError } from "zod";

export function notFound(req, res) {
  res.status(404).json({ error: "Ruta no encontrada." });
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Datos inválidos.",
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    });
  }

  if (error.status) {
    return res.status(error.status).json({ error: error.publicMessage || error.message });
  }

  console.error(error);
  res.status(500).json({ error: "Error interno del servidor." });
}
