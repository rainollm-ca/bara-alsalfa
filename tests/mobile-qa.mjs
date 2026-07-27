import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

async function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

const port = process.env.QA_URL ? null : await reservePort();
const baseUrl = process.env.QA_URL ?? `http://127.0.0.1:${port}`;
const outputDir = new URL("../outputs/mobile-qa/", import.meta.url);
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
];
const locales = [
  { id: "ar", dir: "rtl", switchLabel: "AR" },
  { id: "en", dir: "ltr", switchLabel: "EN" },
];
const gameCount = 8;

async function waitForServer(url, server, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(`Production server exited early with code ${server.exitCode}`);
    }
    let response;
    try {
      response = await fetch(url);
    } catch {}
    if (response?.ok) {
      const html = await response.text();
      assert.match(html, /برا السالفة \| Party Games/, "unexpected app served on QA port");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Production server did not become ready at ${url}`);
}

async function assertMobilePage(page, locale, label) {
  const documentLocale = await page.locator("html").evaluate((root) => ({
    lang: root.lang,
    dir: root.dir,
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
  }));
  assert.equal(documentLocale.lang, locale.id, `${label}: wrong document language`);
  assert.equal(documentLocale.dir, locale.dir, `${label}: wrong document direction`);
  assert.ok(
    documentLocale.scrollWidth <= documentLocale.clientWidth,
    `${label}: horizontal overflow (${documentLocale.scrollWidth}px > ${documentLocale.clientWidth}px)`,
  );

  const primaryActions = page.locator('main button[data-action="primary"]:enabled');
  const count = await primaryActions.count();
  assert.ok(count > 0, `${label}: no explicitly marked primary action`);

  const diagnostics = [];
  for (let index = 0; index < count; index += 1) {
    const action = primaryActions.nth(index);
    const result = await action.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      return {
        text: button.textContent?.trim().replace(/\s+/g, " ") ?? "",
        playwrightVisible:
          Boolean(rect.width && rect.height) &&
          style.display !== "none" &&
          style.visibility !== "hidden",
        rendered:
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0,
        touchTarget: rect.height >= 44 && rect.width >= 44,
        inInitialViewport:
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= viewportHeight &&
          rect.right <= viewportWidth,
        rect: {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
    result.playwrightVisible = result.playwrightVisible && await action.isVisible();
    diagnostics.push(result);
    if (
      result.playwrightVisible &&
      result.rendered &&
      result.touchTarget &&
      result.inInitialViewport
    ) return;
  }

  assert.fail(
    `${label}: no enabled, visible, initial-viewport 44px product action: ${JSON.stringify(diagnostics)}`,
  );
}

async function setLocale(page, locale) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const newGame = page.locator(".resumeSession .ghostButton");
  if (await newGame.isVisible().catch(() => false)) await newGame.click();
  const switchButton = page.getByRole("button", { name: locale.switchLabel, exact: true });
  if ((await page.locator("html").getAttribute("lang")) !== locale.id) {
    await switchButton.click();
  }
  await page.waitForFunction(
    ({ lang, dir }) =>
      document.documentElement.lang === lang && document.documentElement.dir === dir,
    { lang: locale.id, dir: locale.dir },
  );
}

async function runOfflineQa(browser) {
  for (const locale of locales) {
    const context = await browser.newContext({ viewport: viewports[1], serviceWorkers: "allow" });
    const page = await context.newPage();
    await setLocale(page, locale);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".gameAction").nth(2).click();
    await page.locator(".setupShell").waitFor();

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    const resume = page.locator(".resumeSession .primaryButton");
    await resume.click();
    await page.locator(".setupShell").waitFor();
    await assertMobilePage(page, locale, `offline local shell ${locale.id}`);

    const apiWasCached = await page.evaluate(async () => {
      try {
        await fetch("/api/rooms");
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(apiWasCached, false, `offline API must not be served from cache (${locale.id})`);

    await page.getByRole("button", { name: locale.id === "ar" ? "المكتبة" : "Game library" }).click();
    const discard = page.locator(".resumeSession .ghostButton");
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await page.locator(".modeOption").nth(1).click();
    await page.locator(".gameAction").first().click();
    await page.waitForFunction(() => !navigator.onLine);
    await expectText(page.locator(".pwaStatus"), locale.id === "ar" ? "الغرف تحتاج اتصالاً" : "Rooms need a connection");
    await context.close();
  }
}

async function expectText(locator, text) {
  await locator.waitFor();
  assert.match(await locator.textContent(), new RegExp(text));
}

async function capture(page, name) {
  await page.screenshot({
    path: new URL(`${name}.png`, outputDir).pathname,
    fullPage: true,
  });
}

async function runMobileMatrix(browser) {
  for (const viewport of viewports) {
    for (const locale of locales) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await setLocale(page, locale);
      await assertMobilePage(page, locale, `library ${locale.id} ${viewport.width}x${viewport.height}`);

      const gameButtons = page.locator(".gameAction");
      assert.equal(await gameButtons.count(), gameCount, "library must expose every game");

      if (viewport.width === 390) {
        await capture(page, `${locale.id}-library`);
      }

      for (let gameIndex = 0; gameIndex < gameCount; gameIndex += 1) {
        await setLocale(page, locale);
        await page.locator(".gameAction").nth(gameIndex).click();

        // Out of the Loop has a welcome screen before setup.
        const welcomeStart = page.locator(".hero .primary");
        if (await welcomeStart.isVisible().catch(() => false)) await welcomeStart.click();

        await assertMobilePage(
          page,
          locale,
          `game ${gameIndex + 1} ${locale.id} ${viewport.width}x${viewport.height}`,
        );

        if (viewport.width === 390 && gameIndex === 2) {
          await capture(page, `${locale.id}-action-setup`);
        }
        if (viewport.width === 390 && gameIndex === 6) {
          await capture(page, `${locale.id}-social-setup`);
        }
      }

      if (viewport.width === 390) {
        await setLocale(page, locale);
        await page.locator(".modeOption").nth(1).click();
        await page.locator(".gameAction").first().click();
        await page.locator(".roomField input").first().fill(
          locale.id === "ar" ? "لاعب" : "Player",
        );
        await assertMobilePage(page, locale, `room ${locale.id}`);
        await capture(page, `${locale.id}-room`);
      }

      await context.close();
    }
  }
}

async function captureCategoryBoard(browser, locale) {
  const context = await browser.newContext({ viewport: viewports[1] });
  const page = await context.newPage();
  await setLocale(page, locale);
  await page.locator(".gameAction").first().click();
  await page.locator(".challengeCategories button").evaluateAll((buttons) => {
    for (const button of buttons.slice(0, 6)) button.click();
  });
  const teamInputs = page.locator(".teamNameField input");
  await teamInputs.nth(0).fill(locale.id === "ar" ? "الفريق الأول" : "Team One");
  await teamInputs.nth(1).fill(locale.id === "ar" ? "الفريق الثاني" : "Team Two");
  await page.locator(".challengeActions .primaryButton").click();
  await page.locator(".challengeBoard").waitFor();
  await assertMobilePage(page, locale, `category board ${locale.id}`);
  await capture(page, `${locale.id}-category-board`);
  await context.close();
}

async function validatePwaRoutes() {
  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200, "manifest route must return 200");
  assert.match(
    manifestResponse.headers.get("content-type") ?? "",
    /manifest\+json|application\/json/,
    "manifest must use a JSON manifest content type",
  );
  const manifest = await manifestResponse.json();
  assert.ok(manifest.name && manifest.short_name, "manifest requires names");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  const requiredIcons = [
    ["/icons/icon-192.png", 192, "any"],
    ["/icons/icon-512.png", 512, "any"],
    ["/icons/icon-maskable-512.png", 512, "maskable"],
  ];
  for (const [src, size, purpose] of requiredIcons) {
    assert.ok(
      manifest.icons?.some((icon) =>
        icon.src === src &&
        icon.sizes === `${size}x${size}` &&
        icon.type === "image/png" &&
        icon.purpose === purpose),
      `manifest requires ${src}`,
    );
    await validatePng(src, size);
  }
  await validatePng("/icons/apple-touch-icon.png", 180);
}

async function validatePng(path, expectedSize) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200, `${path} must return 200`);
  assert.match(response.headers.get("content-type") ?? "", /image\/png/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(
    [...bytes.slice(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${path} must have a PNG signature`,
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(16), expectedSize, `${path} width`);
  assert.equal(view.getUint32(20), expectedSize, `${path} height`);
}

await mkdir(outputDir, { recursive: true });
const server = process.env.QA_URL
  ? null
  : spawn("npm", ["start", "--", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    });

let serverError = "";
server?.stderr.on("data", (chunk) => {
  serverError += chunk.toString();
});

try {
  await waitForServer(baseUrl, server);
  await validatePwaRoutes();
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  try {
    await runMobileMatrix(browser);
    for (const locale of locales) await captureCategoryBoard(browser, locale);
    await runOfflineQa(browser);
  } finally {
    await browser.close();
  }
  console.log("mobile bilingual PWA QA passed");
} catch (error) {
  if (serverError) console.error(serverError);
  throw error;
} finally {
  if (server && server.exitCode === null) {
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (server.exitCode === null) {
      try { process.kill(-server.pid, "SIGKILL"); } catch {}
      await new Promise((resolve) => server.once("exit", resolve));
    }
  }
}
