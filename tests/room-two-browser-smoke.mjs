import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";

const managedServer = !process.env.ROOM_SMOKE_URL;
const restartContainer = process.env.ROOM_SMOKE_RESTART_CONTAINER;
const port = process.env.ROOM_SMOKE_PORT ?? "3107";
const baseUrl = process.env.ROOM_SMOKE_URL ?? `http://127.0.0.1:${port}`;
const executablePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dbPath = join(mkdtempSync(join(tmpdir(), "bara-room-smoke-")), "rooms.sqlite");
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Room smoke server did not become ready.");
}

async function startServer() {
  server = spawn("npm", ["start"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, ROOM_DB_PATH: dbPath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
}

async function stopServer() {
  if (!server) return;
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  server = undefined;
}

if (managedServer) await startServer();
const healthResponse = await fetch(`${baseUrl}/api/health`);
if (!healthResponse.ok || (await healthResponse.json()).status !== "healthy") {
  throw new Error("Room database health preflight failed.");
}
const browser = await chromium.launch({ headless: true, executablePath });

try {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  await host.goto(baseUrl);
  await host.getByRole("button", { name: "EN" }).click();
  await host.getByRole("button", { name: /Group room/ }).click();
  await host.locator(".gameTile").filter({ hasText: "Charades" }).getByRole("button", { name: "Play now" }).click();
  await host.getByLabel("Your name").fill("Smoke Host");
  await host.getByRole("button", { name: "Create room" }).click();
  await host.locator(".roomCode").waitFor();
  const inviteUrl = host.url();
  if (!/[?&]room=[A-Z0-9]{6}/.test(inviteUrl)) throw new Error(`Invalid invite URL: ${inviteUrl}`);

  if (managedServer) {
    await stopServer();
    await startServer();
  } else if (restartContainer) {
    execFileSync("docker", ["restart", restartContainer], { stdio: "ignore" });
    await waitForServer();
  }
  await guest.goto(inviteUrl);
  await guest.getByRole("button", { name: "EN" }).click();
  await guest.getByLabel("Your name").fill("Smoke Guest");
  await guest.getByRole("button", { name: "Join room" }).click();
  await guest.getByText("Smoke Host").waitFor();
  await host.getByText("Smoke Guest").waitFor();
  await host.getByRole("button", { name: "Start game" }).click();
  await host.locator('[data-room-status="playing"]').waitFor();
  await guest.locator('[data-room-status="playing"]').waitFor({ timeout: 6_000 });

  const session = await host.evaluate(() => {
    const key = Object.keys(localStorage).find((value) => value.startsWith("bara-room:"));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
  const stateText = await host.evaluate(({ code, playerToken }) =>
    fetch(`/api/rooms/${code}/state`, { headers: { authorization: `Bearer ${playerToken}` } }).then((response) => response.text()), session);
  const domText = `${await host.locator("body").innerText()} ${await guest.locator("body").innerText()}`;
  for (const secret of [session.playerToken, session.hostToken]) {
    if (stateText.includes(secret) || domText.includes(secret)) throw new Error("Credential leaked into visible state.");
  }
  console.log(JSON.stringify({
    databaseHealth: true,
    hostCreatedFromUi: true,
    freshInviteContextJoined: true,
    synchronizedPlayers: 2,
    synchronizedStatus: "playing",
    inviteUrlRoutedAtRoot: true,
    persistedAcrossServerRestart: managedServer || Boolean(restartContainer),
    credentialLeak: false,
  }));
} finally {
  await browser.close();
  await stopServer();
}
