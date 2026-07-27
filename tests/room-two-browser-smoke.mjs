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
    env: { ...process.env, PORT: port, ROOM_DB_PATH: dbPath, ROOM_CREATE_LIMIT: "20" },
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
  await host.locator(".gameTile").filter({ hasText: "Category Challenge" }).getByRole("button", { name: "Play now" }).click();
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
  await host.locator('[data-game-id="category-challenge"][data-game-phase="play"]').waitFor();
  await guest.locator('[data-game-id="category-challenge"][data-game-phase="play"]').waitFor({ timeout: 6_000 });
  await host.getByRole("button", { name: "Correct: Smoke Host" }).click();
  await host.locator('[data-game-phase="result"]').waitFor();
  await guest.locator('[data-game-phase="result"]').waitFor({ timeout: 6_000 });
  if (!(await guest.locator(".roomScores").innerText()).includes("Smoke Host: 1") ||
      !(await guest.locator(".roomAnswer").isVisible())) {
    throw new Error("Authoritative category answer/score did not synchronize.");
  }

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
  const privacy = await host.evaluate(async () => {
    const post = (path, body, token) => fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then((response) => response.json());
    const created = await post("/api/rooms", { contractVersion: 1, hostName: "Private Host", gameId: "out-of-loop" });
    const guest = await post(`/api/rooms/${created.code}/join`, { contractVersion: 1, name: "Private Guest" });
    const outsider = await post(`/api/rooms/${created.code}/join`, { contractVersion: 1, name: "Private Outsider" });
    await post(`/api/rooms/${created.code}/action`, { contractVersion: 1, action: { type: "lobby/start" } }, created.hostToken);
    const state = (token) => fetch(`/api/rooms/${created.code}/state`, {
      headers: { authorization: `Bearer ${token}` },
    }).then((response) => response.json());
    const [hostState, guestState, outsiderState] = await Promise.all([
      state(created.playerToken), state(guest.playerToken), state(outsider.playerToken),
    ]);
    const outsiderText = JSON.stringify(outsiderState);
    const publicText = JSON.stringify(hostState.room.gameState.publicData);
    return {
      insidersHaveWord: Boolean(hostState.room.gameState.privateData.word && guestState.room.gameState.privateData.word),
      outsiderHasNoWord: outsiderState.room.gameState.privateData.role === "outsider" && !outsiderState.room.gameState.privateData.word,
      publicDoesNotRevealOutsider: !publicText.includes("outsiderPlayerId"),
      outsiderDoesNotReceiveWord: !outsiderText.includes("Damascus"),
    };
  });
  if (Object.values(privacy).some((value) => !value)) throw new Error("Out of Loop privacy projection failed.");
  const reducerMatrix = await host.evaluate(async () => {
    const postRaw = (path, body, token) => fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const post = async (path, body, token) => {
      const response = await postRaw(path, body, token);
      return { status: response.status, data: await response.json() };
    };
    const definitions = [
      ["category-challenge", 2], ["charades", 4], ["forbidden-word", 4], ["rapid-fire", 2],
      ["who-am-i", 2], ["most-likely-to", 3], ["out-of-loop", 3], ["two-truths-lie", 3],
    ];
    const results = {};
    for (const [gameId, count] of definitions) {
      const created = (await post("/api/rooms", { contractVersion: 1, hostName: `${gameId} Host`, gameId })).data;
      const participants = [{ playerToken: created.playerToken, id: created.room.self.id }];
      for (let index = 1; index < count; index += 1) {
        const joined = (await post(`/api/rooms/${created.code}/join`, { contractVersion: 1, name: `${gameId} P${index}` })).data;
        participants.push({ playerToken: joined.playerToken, id: joined.room.self.id });
      }
      const actionPath = `/api/rooms/${created.code}/action`;
      const started = (await post(actionPath, { contractVersion: 1, action: { type: "lobby/start" } }, created.hostToken)).data.room;
      const initialGuesser = count > 1 ? (await fetch(`/api/rooms/${created.code}/state`, {
        headers: { authorization: `Bearer ${participants[1].playerToken}` },
      }).then((response) => response.json())).room : null;
      let finalAction;
      let finalToken = created.hostToken;
      if (gameId === "category-challenge") finalAction = { type: "category/score", correctPlayerId: participants[1].id };
      else if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) finalAction = { type: `${gameId}/score`, correct: true };
      else if (gameId === "who-am-i") { finalAction = { type: "who-am-i/guess", correct: true }; finalToken = participants[0].playerToken; }
      else if (gameId === "most-likely-to") {
        for (const participant of participants) await post(actionPath, { contractVersion: 1, action: { type: "most-likely/vote", playerId: participants[0].id } }, participant.playerToken);
        finalAction = { type: "most-likely/vote", playerId: participants[0].id };
        finalToken = participants[0].playerToken;
      } else if (gameId === "out-of-loop") {
        await post(actionPath, { contractVersion: 1, action: { type: "out-of-loop/open-vote" } }, created.hostToken);
        for (const participant of participants) await post(actionPath, { contractVersion: 1, action: { type: "out-of-loop/vote", playerId: participants.at(-1).id } }, participant.playerToken);
        finalAction = { type: "out-of-loop/guess", word: "Damascus" };
        finalToken = participants.at(-1).playerToken;
        await post(actionPath, { contractVersion: 1, action: finalAction }, finalToken);
      } else {
        await post(actionPath, { contractVersion: 1, action: { type: "two-truths/submit", statements: ["A", "B", "C"], lieIndex: 1 } }, participants[0].playerToken);
        for (const participant of participants.slice(1)) await post(actionPath, { contractVersion: 1, action: { type: "two-truths/vote", index: 1 } }, participant.playerToken);
        finalAction = { type: "two-truths/vote", index: 1 };
        finalToken = participants[1].playerToken;
      }
      if (!["most-likely-to", "out-of-loop", "two-truths-lie"].includes(gameId)) {
        await post(actionPath, { contractVersion: 1, action: finalAction }, finalToken);
      }
      const replay = await post(actionPath, { contractVersion: 1, action: finalAction }, finalToken);
      const next = await post(actionPath, { contractVersion: 1, action: { type: "game/next-round" } }, created.hostToken);
      const before = started.gameState.publicData;
      const after = next.data.room.gameState.publicData;
      if (replay.status < 400 || next.status !== 200 || after.round !== 2 || after.promptIndex === before.promptIndex) {
        throw new Error(`${gameId} lifecycle/replay smoke failed`);
      }
      if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
        const publicText = JSON.stringify(started.gameState.publicData);
        if (publicText.includes('"prompt"') || initialGuesser.gameState.privateData?.prompt) throw new Error(`${gameId} prompt leaked`);
      }
      results[gameId] = { result: true, replayRejected: true, nextRound: 2 };
    }
    return results;
  });
  console.log(JSON.stringify({
    databaseHealth: true,
    hostCreatedFromUi: true,
    freshInviteContextJoined: true,
    synchronizedPlayers: 2,
    synchronizedStatus: "round-result",
    authoritativeCategoryRound: true,
    outOfLoopPrivacy: privacy,
    allGameRoundMatrix: reducerMatrix,
    inviteUrlRoutedAtRoot: true,
    persistedAcrossServerRestart: managedServer || Boolean(restartContainer),
    credentialLeak: false,
  }));
} finally {
  await browser.close();
  await stopServer();
}
