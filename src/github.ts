import * as z from "zod/mini";
import { parseLogin, type Login, type PullRef } from "./domain";

export type GithubErrorKind = "noToken" | "unauthorized" | "notFound" | "rejected" | "network";

/** `note` finishes the sentence "<login> could not be asked: …". */
export type GithubError = { kind: GithubErrorKind; note: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: GithubError };

export type PullState = { open: boolean; author: Login | null; requested: Login[] };

const API = "https://api.github.com";
const PAGE_SIZE = 100;
const MAX_CANDIDATE_PAGES = 10;

const account = z.object({ login: z.string() });
const pullSchema = z.object({
  state: z.string(),
  user: account,
  requested_reviewers: z.array(account),
});
const reviewsSchema = z.array(z.object({ user: z.nullable(account) }));
const accountsSchema = z.array(account);

function errorForStatus(status: number): GithubError {
  switch (status) {
    case 401:
      return { kind: "unauthorized", note: "token rejected" };
    case 403:
      return { kind: "rejected", note: "token lacks permission" };
    case 404:
      return { kind: "notFound", note: "token cannot see this repo" };
    case 422:
      return { kind: "rejected", note: "no repo access" };
    default:
      return { kind: "rejected", note: `GitHub answered ${status}` };
  }
}

/** Drops accounts that are not people, such as `renovate[bot]`, and duplicates. */
function peopleOnly(logins: string[]): Login[] {
  const people = logins.flatMap((raw) => parseLogin(raw) ?? []);
  return [...new Set(people)];
}

export function createGithub(deps: { token: string; fetch: typeof fetch }) {
  async function call<T>(
    path: string,
    schema: z.ZodMiniType<T>,
    init: RequestInit = {},
  ): Promise<Result<T>> {
    let response: Response;
    try {
      response = await deps.fetch(`${API}${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${deps.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    } catch {
      return { ok: false, error: { kind: "network", note: "network error" } };
    }
    if (!response.ok) return { ok: false, error: errorForStatus(response.status) };
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      return { ok: false, error: { kind: "rejected", note: "unexpected GitHub response" } };
    }
    return { ok: true, value: parsed.data };
  }

  const pullPath = (pull: PullRef) =>
    `/repos/${pull.org}/${encodeURIComponent(pull.repo)}/pulls/${pull.number}`;

  return {
    async pullState(pull: PullRef): Promise<Result<PullState>> {
      const [details, reviews] = await Promise.all([
        call(pullPath(pull), pullSchema),
        call(`${pullPath(pull)}/reviews?per_page=${PAGE_SIZE}`, reviewsSchema),
      ]);
      if (!details.ok) return details;
      if (!reviews.ok) return reviews;
      const reviewed = reviews.value.flatMap((review) => review.user?.login ?? []);
      const pending = details.value.requested_reviewers.map((reviewer) => reviewer.login);
      return {
        ok: true,
        value: {
          open: details.value.state === "open",
          author: parseLogin(details.value.user.login),
          requested: peopleOnly([...pending, ...reviewed]),
        },
      };
    },

    async askReviewer(input: { pull: PullRef; reviewer: string }): Promise<Result<null>> {
      const result = await call(`${pullPath(input.pull)}/requested_reviewers`, z.unknown(), {
        method: "POST",
        body: JSON.stringify({ reviewers: [input.reviewer] }),
      });
      return result.ok ? { ok: true, value: null } : result;
    },

    /** People who can be assigned on this repo, which is who GitHub lets you ask for review. */
    async candidates(pull: PullRef): Promise<Result<Login[]>> {
      const logins: string[] = [];
      for (let page = 1; page <= MAX_CANDIDATE_PAGES; page += 1) {
        const path = `/repos/${pull.org}/${encodeURIComponent(pull.repo)}/assignees?per_page=${PAGE_SIZE}&page=${page}`;
        const result = await call(path, accountsSchema);
        if (!result.ok) return result;
        logins.push(...result.value.map((person) => person.login));
        if (result.value.length < PAGE_SIZE) break;
      }
      return { ok: true, value: peopleOnly(logins) };
    },

    async whoAmI(): Promise<Result<Login | null>> {
      const result = await call("/user", account);
      return result.ok ? { ok: true, value: parseLogin(result.value.login) } : result;
    },
  };
}

export type Github = ReturnType<typeof createGithub>;
