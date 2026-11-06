import { describe, expect, it } from "vitest";
import { parsePullUrl } from "./domain";
import { createGithub } from "./github";

type Handler = (path: string, init: RequestInit | undefined) => Response;

function github(handler: Handler) {
  const calls: { path: string; init: RequestInit | undefined }[] = [];
  const client = createGithub({
    token: "test-token",
    fetch: async (input, init) => {
      const path = String(input).replace("https://api.github.com", "");
      calls.push({ path, init });
      return handler(path, init);
    },
  });
  return { client, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const pull = parsePullUrl("https://github.com/Northwind/billing-api/pull/482");
if (pull === null) throw new Error("bad test url");

describe("pullState", () => {
  it("treats pending reviewers and anyone who already reviewed as requested", async () => {
    const { client } = github((path) =>
      path.includes("/reviews")
        ? json([{ user: { login: "Jonas-L" } }, { user: null }])
        : json({
            state: "open",
            user: { login: "Lee-Park" },
            requested_reviewers: [{ login: "priya-k" }],
          }),
    );
    expect(await client.pullState(pull)).toEqual({
      ok: true,
      value: { open: true, author: "lee-park", requested: ["priya-k", "jonas-l"] },
    });
  });

  it("keeps working when the author is a bot, whose login is not a person's", async () => {
    const { client } = github((path) =>
      path.includes("/reviews")
        ? json([])
        : json({ state: "open", user: { login: "dependabot[bot]" }, requested_reviewers: [] }),
    );
    expect(await client.pullState(pull)).toMatchObject({ ok: true, value: { author: null } });
  });

  it("reports a closed PR", async () => {
    const { client } = github((path) =>
      path.includes("/reviews")
        ? json([])
        : json({ state: "closed", user: { login: "a" }, requested_reviewers: [] }),
    );
    expect(await client.pullState(pull)).toMatchObject({ ok: true, value: { open: false } });
  });

  it("reports an unusable token", async () => {
    const { client } = github(() => json({ message: "Bad credentials" }, 401));
    expect(await client.pullState(pull)).toMatchObject({
      ok: false,
      error: { kind: "unauthorized" },
    });
  });

  it("reports a repo the token cannot see", async () => {
    const { client } = github(() => json({ message: "Not Found" }, 404));
    expect(await client.pullState(pull)).toMatchObject({ ok: false, error: { kind: "notFound" } });
  });

  it("reports an unexpected response instead of throwing", async () => {
    const { client } = github(() => json({ surprise: true }));
    expect(await client.pullState(pull)).toMatchObject({ ok: false, error: { kind: "rejected" } });
  });
});

describe("askReviewer", () => {
  it("posts one reviewer to the PR with the token", async () => {
    const { client, calls } = github(() => json({}, 201));
    const result = await client.askReviewer({ pull, reviewer: "mira-chen" });
    expect(result.ok).toBe(true);
    expect(calls[0]?.path).toBe("/repos/northwind/billing-api/pulls/482/requested_reviewers");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ reviewers: ["mira-chen"] }));
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer test-token");
  });

  it("explains a person without repo access", async () => {
    const { client } = github(() => json({ message: "Reviews may only be requested" }, 422));
    expect(await client.askReviewer({ pull, reviewer: "dana-w" })).toMatchObject({
      ok: false,
      error: { note: "no repo access" },
    });
  });

  it("reports a network failure instead of throwing", async () => {
    const client = createGithub({
      token: "t",
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    expect(await client.askReviewer({ pull, reviewer: "dana-w" })).toMatchObject({
      ok: false,
      error: { kind: "network" },
    });
  });
});

describe("candidates", () => {
  it("collects assignable people across pages and skips bots", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ login: `user-${index}` }));
    const { client, calls } = github((path) =>
      path.endsWith("page=2")
        ? json([{ login: "Last-One" }, { login: "renovate[bot]" }])
        : json(firstPage),
    );
    const result = await client.candidates(pull);
    expect(result.ok && result.value.length).toBe(101);
    expect(result.ok && result.value.at(-1)).toBe("last-one");
    expect(calls).toHaveLength(2);
  });
});

describe("whoAmI", () => {
  it("returns the token's account", async () => {
    const { client } = github(() => json({ login: "Lee-Park" }));
    expect(await client.whoAmI()).toEqual({ ok: true, value: "lee-park" });
  });
});
