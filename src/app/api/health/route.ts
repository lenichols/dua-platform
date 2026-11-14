import { getPool } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness and database readiness for container health checks and deploy
 * smoke tests. Deliberately returns no configuration or error details.
 */
export async function GET() {
  const started = Date.now();
  try {
    await getPool().query("select 1");
    return Response.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION ?? "0.1.0",
        checks: {
          database: { status: "ok", latency_ms: Date.now() - started },
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION ?? "0.1.0",
        checks: { database: { status: "error" } },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
