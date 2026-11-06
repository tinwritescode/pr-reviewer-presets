import * as z from "zod/mini";
import { loginSchema, parsePullUrl, type PullRef } from "./domain";
import type { Github, GithubError, Result } from "./github";

/** What the content script may ask the background worker to do. The token never leaves it. */
const messageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pullState"), url: z.string() }),
  z.object({ kind: z.literal("candidates"), url: z.string() }),
  z.object({ kind: z.literal("askReviewer"), url: z.string(), reviewer: loginSchema }),
  z.object({ kind: z.literal("openOptions") }),
]);

export type Message = z.input<typeof messageSchema>;

const errorSchema = z.object({
  kind: z.enum(["noToken", "unauthorized", "notFound", "rejected", "network"]),
  note: z.string(),
});

function resultOf<T>(value: z.ZodMiniType<T>) {
  return z.union([
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), error: errorSchema }),
  ]);
}

/** Schemas for the answers, so the content script parses what crosses the boundary. */
export const answers = {
  pullState: resultOf(
    z.object({
      open: z.boolean(),
      author: z.nullable(loginSchema),
      requested: z.array(loginSchema),
    }),
  ),
  candidates: resultOf(z.array(loginSchema)),
  empty: resultOf(z.null()),
};

const rejected = (note: string): { ok: false; error: GithubError } => ({
  ok: false,
  error: { kind: "rejected", note },
});

export async function handleMessage(
  raw: unknown,
  deps: {
    getToken: () => Promise<string | null>;
    createClient: (token: string) => Github;
    openOptions: () => Promise<void>;
  },
): Promise<Result<unknown>> {
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return rejected("invalid request");
  const message = parsed.data;

  if (message.kind === "openOptions") {
    await deps.openOptions();
    return { ok: true, value: null };
  }

  const pull: PullRef | null = parsePullUrl(message.url);
  if (pull === null) return rejected("not a pull request");

  const token = await deps.getToken();
  if (token === null) {
    return { ok: false, error: { kind: "noToken", note: "no token saved" } };
  }
  const client = deps.createClient(token);

  switch (message.kind) {
    case "pullState":
      return client.pullState(pull);
    case "candidates":
      return client.candidates(pull);
    case "askReviewer":
      return client.askReviewer({ pull, reviewer: message.reviewer });
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}
