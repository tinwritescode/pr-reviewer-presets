import * as z from "zod/mini";

/** A GitHub username, lower-cased so one person always compares equal to themselves. */
export type Login = string & { readonly __brand: "Login" };
/** A GitHub org or user name, lower-cased. Presets are keyed by it. */
export type OrgName = string & { readonly __brand: "OrgName" };

const LOGIN_PATTERN = /^[a-z0-9][a-z0-9-]{0,38}$/;

function isLogin(value: string): value is Login {
  return LOGIN_PATTERN.test(value);
}

function isOrgName(value: string): value is OrgName {
  return LOGIN_PATTERN.test(value);
}

export function parseLogin(raw: string): Login | null {
  const normalized = raw.toLowerCase();
  return isLogin(normalized) ? normalized : null;
}

export type PullRef = { org: OrgName; repo: string; number: number };

const PULL_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/;

export function parsePullUrl(url: string): PullRef | null {
  if (!URL.canParse(url)) return null;
  const { hostname, pathname } = new URL(url);
  if (hostname !== "github.com") return null;
  const [, rawOrg, repo, number] = PULL_PATH.exec(pathname) ?? [];
  if (rawOrg === undefined || repo === undefined || number === undefined) return null;
  const org = rawOrg.toLowerCase();
  return isOrgName(org) ? { org, repo, number: Number(number) } : null;
}

export function storageKey(org: OrgName): string {
  return `presets:${org}`;
}

export const loginSchema = z.pipe(
  z.string(),
  z.transform((raw: string, context): Login => {
    const login = parseLogin(raw);
    if (login === null) {
      context.issues.push({ code: "custom", message: "not a GitHub login", input: raw });
      return z.NEVER;
    }
    return login;
  }),
);

const presetSchema = z.object({
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  members: z.array(loginSchema),
});

export type Preset = z.infer<typeof presetSchema>;

/** Reads presets from storage. A corrupt entry is dropped so it cannot hide the others. */
export function parsePresets(stored: unknown): Preset[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry) => {
    const parsed = presetSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export type MemberStatus = "askable" | "author" | "requested" | "failed";

export type AskPlan = {
  rows: { login: Login; status: MemberStatus }[];
  askable: Login[];
};

export function planAsk(input: {
  preset: Preset;
  author: Login | null;
  requested: Login[];
  failed: Login[];
}): AskPlan {
  const statusOf = (login: Login): MemberStatus => {
    if (login === input.author) return "author";
    if (input.requested.includes(login)) return "requested";
    if (input.failed.includes(login)) return "failed";
    return "askable";
  };
  const rows = input.preset.members.map((login) => ({ login, status: statusOf(login) }));
  const askable = rows.filter((row) => row.status === "askable").map((row) => row.login);
  return { rows, askable };
}

export type AskPhase =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "finished"; asked: Login[]; failed: Login[] };

export type LineView =
  | { kind: "ready"; shown: Login[]; more: number; failed: Login[] }
  | { kind: "sending"; total: number }
  | { kind: "asked"; shown: Login[]; more: number; failed: Login[] }
  | { kind: "allAsked" };

const NAMES_SHOWN = 2;

function summarize(logins: Login[]): { shown: Login[]; more: number } {
  return {
    shown: logins.slice(0, NAMES_SHOWN),
    more: Math.max(0, logins.length - NAMES_SHOWN),
  };
}

export function lineView(input: { plan: AskPlan; phase: AskPhase }): LineView {
  const { plan, phase } = input;
  if (phase.kind === "sending") return { kind: "sending", total: plan.askable.length };
  const failed = phase.kind === "finished" ? phase.failed : [];
  if (plan.askable.length > 0) return { kind: "ready", ...summarize(plan.askable), failed };
  if (phase.kind === "finished" && phase.asked.length + phase.failed.length > 0) {
    return { kind: "asked", ...summarize(phase.asked), failed };
  }
  return { kind: "allAsked" };
}
