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
    env: { ...process.env, PORT: port, ROOM_DB_PATH: dbPath, ROOM_CREATE_LIMIT: "20", ROOM_ROUND_DURATION_MS: "5000" },
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
  await guest.getByRole("button", { name: "Correct: Smoke Host" }).click();
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
    const states = [hostState, guestState, outsiderState];
    const outsiderProjection = states.find((state) => state.room.gameState.privateData.role === "outsider");
    const insiderProjections = states.filter((state) => state.room.gameState.privateData.role === "insider");
    const word = insiderProjections[0]?.room.gameState.privateData.word?.en;
    const outsiderText = JSON.stringify(outsiderProjection);
    const publicText = JSON.stringify(hostState.room.gameState.publicData);
    return {
      insidersHaveWord: insiderProjections.length === 2 && insiderProjections.every((state) => state.room.gameState.privateData.word),
      outsiderHasNoWord: Boolean(outsiderProjection && !outsiderProjection.room.gameState.privateData.word),
      publicDoesNotRevealOutsider: !publicText.includes("outsiderPlayerId"),
      outsiderDoesNotReceiveWord: Boolean(word && !outsiderText.includes(word)),
    };
  });
  if (Object.values(privacy).some((value) => !value)) throw new Error("Out of Loop privacy projection failed.");
  const uiDefinitions = [
    ["charades", "Charades", 4],
    ["forbidden-word", "Forbidden Word", 4],
    ["rapid-fire", "Rapid Fire", 2],
    ["who-am-i", "Who Am I?", 2],
    ["most-likely-to", "Most Likely To", 3],
    ["out-of-loop", "Out of the Loop", 3],
    ["two-truths-lie", "Two Truths and a Lie", 3],
  ];
  const uiJourneys = {
    "category-challenge": { uiJourney: true, synchronized: true, nextRound: 2 },
  };
  await guest.locator('[data-action="next-round"]').click();
  await host.getByText("Round 2", { exact: true }).waitFor();
  await guest.getByText("Round 2", { exact: true }).waitFor({ timeout: 6_000 });

  for (const [gameId, title, playerCount] of uiDefinitions) {
    const contexts = [];
    const pages = [];
    for (let index = 0; index < playerCount; index += 1) {
      const context = await browser.newContext();
      contexts.push(context);
      pages.push(await context.newPage());
    }
    const journeyHost = pages[0];
    await journeyHost.goto(baseUrl);
    await journeyHost.getByRole("button", { name: "EN" }).click();
    await journeyHost.getByRole("button", { name: /Group room/ }).click();
    await journeyHost.locator(".gameTile").filter({ hasText: title }).getByRole("button", { name: "Play now" }).click();
    await journeyHost.getByLabel("Your name").fill(`${title} Host`);
    await journeyHost.getByRole("button", { name: "Create room" }).click();
    await journeyHost.locator(".roomCode").waitFor();
    const journeyUrl = journeyHost.url();

    for (let index = 1; index < playerCount; index += 1) {
      const page = pages[index];
      await page.goto(journeyUrl);
      await page.getByRole("button", { name: "EN" }).click();
      await page.getByLabel("Your name").fill(`${title} P${index}`);
      await page.getByRole("button", { name: "Join room" }).click();
    }
    await journeyHost.getByText(`${title} P${playerCount - 1}`).waitFor({ timeout: 8_000 });
    await journeyHost.getByRole("button", { name: "Start game" }).click();
    for (const page of pages) {
      await page.locator(`[data-game-id="${gameId}"]`).waitFor({ timeout: 8_000 });
    }

    if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
      const prompt = (await journeyHost.locator(".roomGameBoard > h1").innerText()).trim();
      if (!prompt || (await pages[1].locator("body").innerText()).includes(prompt)) {
        throw new Error(`${gameId} active prompt leaked to a non-actor UI.`);
      }
      const controlPage = gameId === "rapid-fire" ? pages[1] : journeyHost;
      await controlPage.locator('[data-action="correct"]').click();
      await controlPage.locator('[data-action="skip"]').click();
      const deadline = Number(await journeyHost.locator(".roomTimer").getAttribute("data-timer-ends-at"));
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now() + 50)));
      if (await controlPage.locator('[data-action="expire"]').count()) {
        await controlPage.locator('[data-action="expire"]').click();
      }
    } else if (gameId === "who-am-i") {
      const hostIdentities = await journeyHost.locator("section.roomGameBoard").innerText();
      const guestIdentities = await pages[1].locator("section.roomGameBoard").innerText();
      if (hostIdentities === guestIdentities) throw new Error("Who Am I private identity projections were identical.");
      let resolved = false;
      for (const page of pages) {
        if (await page.locator('[data-action="correct"]').count()) {
          await page.locator('[data-action="correct"]').click();
          resolved = true;
          break;
        }
      }
      if (!resolved) throw new Error("Who Am I active player control was not projected.");
    } else if (gameId === "most-likely-to") {
      for (const page of pages) {
        await page.locator('[data-action="vote-player"]').first().click();
      }
    } else if (gameId === "out-of-loop") {
      const roleTexts = await Promise.all(pages.map((page) => page.locator(".secretRoomValue").innerText()));
      const outsiderIndex = roleTexts.findIndex((value) => value.includes("out of the loop"));
      const insiderText = roleTexts.find((value) => value.includes("Secret word:"));
      const secretWord = insiderText?.split("Secret word:")[1]?.trim();
      const outsiderPage = pages[outsiderIndex];
      if (outsiderIndex < 0 || !outsiderPage || !secretWord || roleTexts[outsiderIndex].includes(secretWord)) {
        throw new Error("Out of Loop secret word privacy failed in rendered UI.");
      }
      await journeyHost.locator('[data-action="open-vote"]').click();
      for (const page of pages) {
        await page.locator('[data-action="vote-player"]').nth(outsiderIndex).click();
      }
      await outsiderPage.getByLabel("Guess the word").fill(secretWord);
      await outsiderPage.locator('[data-action="outsider-guess"]').click();
    } else {
      const submitterIndex = await Promise.all(pages.map((page) => page.locator('[data-action="submit-statements"]').count()))
        .then((counts) => counts.findIndex(Boolean));
      const submitter = pages[submitterIndex];
      if (!submitter) throw new Error("Two Truths submitter control was not projected.");
      await submitter.getByLabel("Statement 1").fill("One");
      await submitter.getByLabel("Statement 2").fill("Two");
      await submitter.getByLabel("Statement 3").fill("Three");
      await submitter.locator('[data-action="submit-statements"]').click();
      for (const [index, page] of pages.entries()) {
        if (index !== submitterIndex) await page.locator('[data-action="vote-statement"]').first().click();
      }
    }

    for (const page of pages) {
      await page.locator(`[data-game-id="${gameId}"][data-game-phase="result"]`).waitFor({ timeout: 8_000 });
    }
    if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
      const resultText = await journeyHost.locator(".roomGameBoard").innerText();
      if (!resultText.includes("Correct: 1") || !resultText.includes("Skip: 1") ||
          !(await journeyHost.locator(".roomScores").count()) ||
          resultText.includes("team-1") || resultText.includes("team-2")) {
        throw new Error(`${gameId} result did not render authoritative summary/team score.`);
      }
    }
    await journeyHost.locator('[data-action="next-round"]').click();
    for (const page of pages) {
      await page.getByText("Round 2", { exact: true }).waitFor({ timeout: 8_000 });
    }
    uiJourneys[gameId] = { uiJourney: true, synchronized: true, nextRound: 2 };
    for (const context of contexts) await context.close();
  }
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
      else if (["charades", "forbidden-word", "rapid-fire"].includes(gameId)) {
        finalAction = { type: `${gameId}/mark`, outcome: "correct" };
        await post(actionPath, { contractVersion: 1, action: finalAction }, created.hostToken);
        await new Promise((resolve) => setTimeout(resolve,
          Math.max(0, started.gameState.publicData.timerEndsAt - Date.now() + 50)));
        await post(actionPath, { contractVersion: 1, action: { type: "timed/expire" } }, created.hostToken);
      }
      else if (gameId === "who-am-i") {
        finalAction = { type: "who-am-i/guess", correct: true };
        finalToken = participants.find((participant) => participant.id === started.gameState.publicData.turnPlayerId).playerToken;
      }
      else if (gameId === "most-likely-to") {
        for (const participant of participants) await post(actionPath, { contractVersion: 1, action: { type: "most-likely/vote", playerId: participants[0].id } }, participant.playerToken);
        finalAction = { type: "most-likely/vote", playerId: participants[0].id };
        finalToken = participants[0].playerToken;
      } else if (gameId === "out-of-loop") {
        const projections = await Promise.all(participants.map(async (participant) => ({
          participant,
          state: await fetch(`/api/rooms/${created.code}/state`, {
            headers: { authorization: `Bearer ${participant.playerToken}` },
          }).then((response) => response.json()),
        })));
        const outsiderProjection = projections.find(({ state }) => state.room.gameState.privateData.role === "outsider");
        const insiderProjection = projections.find(({ state }) => state.room.gameState.privateData.role === "insider");
        if (!outsiderProjection || !insiderProjection) throw new Error("Out-of-loop private projections missing");
        await post(actionPath, { contractVersion: 1, action: { type: "out-of-loop/open-vote" } }, created.hostToken);
        for (const participant of participants) await post(actionPath, { contractVersion: 1, action: { type: "out-of-loop/vote", playerId: outsiderProjection.participant.id } }, participant.playerToken);
        finalAction = { type: "out-of-loop/guess", word: insiderProjection.state.room.gameState.privateData.word.en };
        finalToken = outsiderProjection.participant.playerToken;
        await post(actionPath, { contractVersion: 1, action: finalAction }, finalToken);
      } else {
        const submitter = participants.find((participant) => participant.id === started.gameState.publicData.turnPlayerId);
        const voters = participants.filter((participant) => participant !== submitter);
        await post(actionPath, { contractVersion: 1, action: { type: "two-truths/submit", statements: ["A", "B", "C"], lieIndex: 1 } }, submitter.playerToken);
        for (const participant of voters) await post(actionPath, { contractVersion: 1, action: { type: "two-truths/vote", index: 1 } }, participant.playerToken);
        finalAction = { type: "two-truths/vote", index: 1 };
        finalToken = voters[0].playerToken;
      }
      if (!["charades", "forbidden-word", "rapid-fire", "most-likely-to", "out-of-loop", "two-truths-lie"].includes(gameId)) {
        await post(actionPath, { contractVersion: 1, action: finalAction }, finalToken);
      }
      const replay = await post(actionPath, { contractVersion: 1, action: finalAction }, finalToken);
      const current = await fetch(`/api/rooms/${created.code}/state`, {
        headers: { authorization: `Bearer ${created.playerToken}` },
      }).then((response) => response.json());
      const next = await post(actionPath, {
        contractVersion: 1,
        action: { type: "game/next-round", expectedRevision: current.room.gameState.revision },
      }, created.hostToken);
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
    allGameUiJourneys: uiJourneys,
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
