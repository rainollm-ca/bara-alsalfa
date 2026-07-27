import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const port = Number(process.env.QA_PORT ?? 4173);
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

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
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

  const controls = page.locator(
    "main button:not([aria-label^='Remove']):not([aria-label^='حذف'])",
  );
  assert.ok(await controls.count(), `${label}: expected a primary control`);
  const visibleControls = await controls.evaluateAll((buttons) =>
    buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return rect.width >= 40 && rect.height >= 40 && style.visibility !== "hidden";
    }).length,
  );
  assert.ok(visibleControls > 0, `${label}: no visible touch-sized primary control`);
}

async function setLocale(page, locale) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
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
  assert.ok(
    manifest.icons?.some((icon) => icon.src === "/icon.svg" && icon.sizes === "any"),
    "manifest requires a scalable install icon",
  );

  const iconResponse = await fetch(`${baseUrl}/icon.svg`);
  assert.equal(iconResponse.status, 200, "install icon route must return 200");
  assert.match(iconResponse.headers.get("content-type") ?? "", /image\/svg\+xml/);
}

await mkdir(outputDir, { recursive: true });
const server = process.env.QA_URL
  ? null
  : spawn("npm", ["start", "--", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production" },
    });

let serverError = "";
server?.stderr.on("data", (chunk) => {
  serverError += chunk.toString();
});

try {
  await waitForServer(baseUrl);
  await validatePwaRoutes();
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  try {
    await runMobileMatrix(browser);
    for (const locale of locales) await captureCategoryBoard(browser, locale);
  } finally {
    await browser.close();
  }
  console.log("mobile bilingual PWA QA passed");
} catch (error) {
  if (serverError) console.error(serverError);
  throw error;
} finally {
  server?.kill("SIGTERM");
}
