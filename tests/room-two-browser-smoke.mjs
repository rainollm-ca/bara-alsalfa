import { chromium } from "playwright-core";

const baseUrl = process.env.ROOM_SMOKE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
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
    hostCreatedFromUi: true,
    freshInviteContextJoined: true,
    synchronizedPlayers: 2,
    synchronizedStatus: "playing",
    inviteUrlRoutedAtRoot: true,
    credentialLeak: false,
  }));
} finally {
  await browser.close();
}
