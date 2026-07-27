import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(process.env.QA_URL ?? "http://127.0.0.1:4173", { waitUntil: "networkidle" });

await page.screenshot({ path: "/tmp/bara-ar-mobile.png", fullPage: true });
await page.getByRole("button", { name: "EN" }).click();
await page.screenshot({ path: "/tmp/bara-en-mobile.png", fullPage: true });
await page.getByRole("button", { name: "Start the game" }).click();

for (const name of ["Noor", "Hisham", "Fatima"]) {
  await page.getByPlaceholder("Add a player name").fill(name);
  await page.getByRole("button", { name: "Add player" }).click();
}

const assignedNames = await page.locator(".playerChip").allTextContents();
if (assignedNames.length !== 3 || assignedNames.some((name) => !name.trim())) {
  throw new Error(`Player setup failed: ${JSON.stringify(assignedNames)}`);
}
if (!(await page.getByRole("button", { name: /Assign roles/ }).isEnabled())) {
  throw new Error("Assign roles should enable with three players");
}
await page.screenshot({ path: "/tmp/bara-en-setup-mobile.png", fullPage: true });
await browser.close();

console.log("mobile bilingual QA passed");
