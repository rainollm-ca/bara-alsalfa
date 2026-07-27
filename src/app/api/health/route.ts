import {
  checkRoomDatabaseHealth,
  configuredRoomDatabasePath,
} from "../../../rooms/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const healthy = checkRoomDatabaseHealth(configuredRoomDatabasePath());
  return Response.json(
    healthy
      ? { status: "healthy" }
      : { status: "unhealthy", error: { code: "DATABASE_UNAVAILABLE" } },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
