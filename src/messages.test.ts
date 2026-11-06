import { describe, expect, it } from "vitest";
import { createGithub } from "./github";
import { handleMessage } from "./messages";

const URL_OF_PR = "https://github.com/northwind/billing-api/pull/482";

function deps(token: string | null, handler: (path: string) => Response = () => new Response("{}")) {
  const paths: string[] = [];
  let optionsOpened = 0;
  return {
    paths,
    optionsOpened: () => optionsOpened,
    getToken: async () => token,
    createClient: (value: string) =>
      createGithub({
        token: value,
        fetch: async (input) => {
          const path = String(input).replace("https://api.github.com", "");
          paths.push(path);
          return handler(path);
        },
      }),
    openOptions: async () => {
      optionsOpened += 1;
    },
  };
}

describe("handleMessage", () => {
  it("answers noToken without calling GitHub when no token is saved", async () => {
    const context = deps(null);
    const answer = await handleMessage({ kind: "pullState", url: URL_OF_PR }, context);
    expect(answer).toMatchObject({ ok: false, error: { kind: "noToken" } });
    expect(context.paths).toEqual([]);
  });

  it("asks one reviewer on the PR named by the url", async () => {
    const context = deps("t");
    const answer = await handleMessage(
      { kind: "askReviewer", url: URL_OF_PR, reviewer: "Mira-Chen" },
      context,
    );
    expect(answer).toEqual({ ok: true, value: null });
    expect(context.paths).toEqual(["/repos/northwind/billing-api/pulls/482/requested_reviewers"]);
  });

  it("refuses a reviewer that is not a login", async () => {
    const context = deps("t");
    const answer = await handleMessage(
      { kind: "askReviewer", url: URL_OF_PR, reviewer: "../../evil" },
      context,
    );
    expect(answer).toMatchObject({ ok: false, error: { kind: "rejected" } });
    expect(context.paths).toEqual([]);
  });

  it("refuses a url that is not a GitHub PR", async () => {
    const context = deps("t");
    const answer = await handleMessage(
      { kind: "pullState", url: "https://evil.example/a/b/pull/1" },
      context,
    );
    expect(answer).toMatchObject({ ok: false, error: { kind: "rejected" } });
    expect(context.paths).toEqual([]);
  });

  it("refuses a message of unknown shape", async () => {
    const answer = await handleMessage({ kind: "steal" }, deps("t"));
    expect(answer).toMatchObject({ ok: false, error: { kind: "rejected" } });
  });

  it("opens the options page without needing a token", async () => {
    const context = deps(null);
    expect(await handleMessage({ kind: "openOptions" }, context)).toEqual({ ok: true, value: null });
    expect(context.optionsOpened()).toBe(1);
  });
});
