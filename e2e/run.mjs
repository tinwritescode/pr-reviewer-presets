// Runs the built extension in Chromium on a live GitHub PR page, signed out. It catches GitHub
// changing the sidebar. The GitHub API is stubbed and the tokens are fake, so nobody is notified.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const EXTENSION = resolve("dist");
const REPO = "cli/cli";
const LOAD_TIMEOUT = 20_000;

/** Any open PR will do, so the run does not depend on one staying open. */
async function openPullUrl() {
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {};
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/pulls?state=open&per_page=1`,
    { headers },
  );
  assert.equal(response.status, 200, "could not list open PRs");
  const [pull] = await response.json();
  assert.ok(pull, `${REPO} has no open PR to test on`);
  return pull.html_url;
}

function stubGithubApi(route, posts) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const json = (body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  if (request.method() === "POST") {
    if (!path.endsWith("/requested_reviewers")) return json({});
    const { reviewers } = JSON.parse(request.postData());
    posts.push(...reviewers);
    return reviewers.includes("dana-w")
      ? json({ message: "Reviews may only be requested from collaborators" }, 422)
      : json({}, 201);
  }
  if (path.endsWith("/reviews")) return json([]);
  if (path.endsWith("/assignees")) {
    return json(["mira-chen", "jonas-l", "dana-w", "sam-ortiz"].map((login) => ({ login })));
  }
  if (path === "/user") return json({ login: "lee-park" });
  return json({
    state: "open",
    user: { login: "lee-park" },
    requested_reviewers: [{ login: "priya-k" }],
  });
}

async function checkPrFlow({ page, worker, url, posts }) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByText("Connect a GitHub token").waitFor({ timeout: LOAD_TIMEOUT });

  await worker.evaluate(() => chrome.storage.local.set({ githubToken: "fake-test-token" }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Set up reviewer presets for cli" })
    .click({ timeout: LOAD_TIMEOUT });

  await page.getByRole("button", { name: "New preset" }).click();
  await page.locator("#preset-name").fill("Backend");
  await page.getByRole("button", { name: "mira-chen" }).waitFor();
  for (const name of ["mira-chen", "jonas-l", "dana-w"]) {
    await page.getByRole("button", { name }).click();
  }
  await page.locator("#preset-search").fill("priya-k");
  await page.getByRole("button", { name: "Add priya-k" }).click();
  await page.locator("#preset-search").fill("");
  await page.getByRole("button", { name: "Save preset" }).click();
  await page.getByRole("button", { name: "Close" }).click();

  const line = page.getByRole("button", { name: /Ask for/ });
  await line.waitFor();
  assert.equal((await line.innerText()).replace(/\s+/g, " "), "Ask for mira-chen, jonas-l +1 review");

  await line.hover();
  await page.getByText("Already asked").waitFor();

  await line.click();
  const failure = page.locator(".failed");
  await failure.waitFor();
  assert.equal(await failure.innerText(), "dana-w could not be asked: no repo access");
  assert.deepEqual(posts, ["mira-chen", "jonas-l", "dana-w"]);

  const stored = await worker.evaluate(() => chrome.storage.sync.get(null));
  assert.deepEqual(Object.keys(stored), ["presets:cli"]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Ask for/ }).waitFor({ timeout: LOAD_TIMEOUT });
}

async function checkOptionsPage({ context, worker }) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const connected = options.getByText("Connected as lee-park");
  await connected.waitFor({ timeout: LOAD_TIMEOUT });
  await options.getByRole("button", { name: "Remove token" }).click();
  await options.getByText("No token saved.").waitFor();
  await options.locator("#token").fill("another-fake-test-token");
  await options.getByRole("button", { name: "Check and save" }).click();
  await connected.waitFor();
}

const url = await openPullUrl();
const profile = await mkdtemp(join(tmpdir(), "pr-reviewer-presets-"));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
});

try {
  const posts = [];
  await context.route("https://api.github.com/**", (route) => stubGithubApi(route, posts));
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await checkPrFlow({ page, worker, url, posts });
  await checkOptionsPage({ context, worker });
  assert.deepEqual(pageErrors, []);
  console.log(`e2e passed on ${url}`);
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
