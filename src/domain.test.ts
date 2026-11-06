import { describe, expect, it } from "vitest";
import {
  lineView,
  parseLogin,
  parsePresets,
  parsePullUrl,
  planAsk,
  storageKey,
  type Login,
  type Preset,
} from "./domain";

function login(raw: string): Login {
  const parsed = parseLogin(raw);
  if (parsed === null) throw new Error(`bad test login ${raw}`);
  return parsed;
}

const logins = (...raw: string[]): Login[] => raw.map(login);

const backend: Preset = {
  id: "backend",
  name: "Backend",
  members: logins("mira-chen", "jonas-l", "priya-k", "dana-w", "lee-park"),
};

describe("parsePullUrl", () => {
  it("reads the org, repo and number from a PR url", () => {
    expect(parsePullUrl("https://github.com/Northwind/billing-api/pull/482")).toEqual({
      org: "northwind",
      repo: "billing-api",
      number: 482,
    });
  });

  it("accepts PR sub-pages", () => {
    expect(parsePullUrl("https://github.com/northwind/api/pull/7/files?w=1")?.number).toBe(7);
  });

  it.each([
    "https://github.com/northwind/api/issues/7",
    "https://github.com/northwind/api/pulls",
    "https://github.com/northwind/api/pull/abc",
    "https://evil.example/northwind/api/pull/7",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parsePullUrl(url)).toBeNull();
  });
});

describe("storageKey", () => {
  it("is the same for any casing of the org and differs between orgs", () => {
    const upper = parsePullUrl("https://github.com/Northwind/a/pull/1");
    const lower = parsePullUrl("https://github.com/northwind/b/pull/2");
    const other = parsePullUrl("https://github.com/acme/a/pull/1");
    if (upper === null || lower === null || other === null) throw new Error("bad test url");
    expect(storageKey(upper.org)).toBe(storageKey(lower.org));
    expect(storageKey(upper.org)).not.toBe(storageKey(other.org));
  });
});

describe("parseLogin", () => {
  it("normalises case so one person is never listed twice", () => {
    expect(parseLogin("Mira-Chen")).toBe("mira-chen");
  });

  it.each(["", "-leading", "has space", "<img>", "a/b"])("rejects %j", (raw) => {
    expect(parseLogin(raw)).toBeNull();
  });
});

describe("parsePresets", () => {
  it("returns no presets for a missing value", () => {
    expect(parsePresets(undefined)).toEqual([]);
  });

  it("returns no presets for corrupt storage", () => {
    expect(parsePresets({ nope: true })).toEqual([]);
  });

  it("reads saved presets", () => {
    expect(parsePresets([{ id: "b", name: "Backend", members: ["Mira-Chen"] }])).toEqual([
      { id: "b", name: "Backend", members: ["mira-chen"] },
    ]);
  });

  it("drops only the entry that is invalid", () => {
    const saved = [
      { id: "b", name: "Backend", members: ["mira-chen"] },
      { id: "x", name: "Bad", members: ["<img>"] },
    ];
    expect(parsePresets(saved).map((preset) => preset.id)).toEqual(["b"]);
  });
});

describe("planAsk", () => {
  it("skips the author and anyone already requested", () => {
    const plan = planAsk({
      preset: backend,
      author: login("lee-park"),
      requested: logins("priya-k"),
      failed: [],
    });
    expect(plan.askable).toEqual(logins("mira-chen", "jonas-l", "dana-w"));
    expect(plan.rows).toEqual([
      { login: "mira-chen", status: "askable" },
      { login: "jonas-l", status: "askable" },
      { login: "priya-k", status: "requested" },
      { login: "dana-w", status: "askable" },
      { login: "lee-park", status: "author" },
    ]);
  });

  it("does not re-offer someone whose request just failed", () => {
    const plan = planAsk({
      preset: backend,
      author: login("lee-park"),
      requested: [],
      failed: logins("dana-w"),
    });
    expect(plan.askable).not.toContain("dana-w");
    expect(plan.rows.find((row) => row.login === "dana-w")?.status).toBe("failed");
  });
});

describe("lineView", () => {
  const plan = (requested: Login[], failed: Login[] = []) =>
    planAsk({ preset: backend, author: login("lee-park"), requested, failed });

  it("shows two names and a count of the rest", () => {
    expect(lineView({ plan: plan(logins("priya-k")), phase: { kind: "idle" } })).toEqual({
      kind: "ready",
      shown: ["mira-chen", "jonas-l"],
      more: 1,
      failed: [],
    });
  });

  it("shows no count when everyone fits", () => {
    const view = lineView({
      plan: plan(logins("mira-chen", "priya-k")),
      phase: { kind: "idle" },
    });
    expect(view).toMatchObject({ kind: "ready", shown: ["jonas-l", "dana-w"], more: 0 });
  });

  it("reports how many are being asked while sending", () => {
    expect(lineView({ plan: plan([]), phase: { kind: "sending" } })).toEqual({
      kind: "sending",
      total: 4,
    });
  });

  it("names who was asked and who failed after sending", () => {
    const finished = {
      kind: "finished",
      asked: logins("mira-chen", "jonas-l", "priya-k"),
      failed: logins("dana-w"),
    } as const;
    const view = lineView({
      plan: plan(logins("mira-chen", "jonas-l", "priya-k"), logins("dana-w")),
      phase: finished,
    });
    expect(view).toEqual({
      kind: "asked",
      shown: ["mira-chen", "jonas-l"],
      more: 1,
      failed: ["dana-w"],
    });
  });

  it("says everyone was already asked when a fresh page has nobody left", () => {
    const view = lineView({
      plan: plan(logins("mira-chen", "jonas-l", "priya-k", "dana-w")),
      phase: { kind: "idle" },
    });
    expect(view).toEqual({ kind: "allAsked" });
  });

  it("offers the remaining people when the preset gains someone after sending", () => {
    const view = lineView({
      plan: plan(logins("mira-chen", "jonas-l", "priya-k")),
      phase: { kind: "finished", asked: logins("mira-chen"), failed: [] },
    });
    expect(view).toMatchObject({ kind: "ready", shown: ["dana-w"], more: 0 });
  });
});
