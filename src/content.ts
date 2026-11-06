import type * as z from "zod/mini";
import type { Result } from "./github";
import { answers, type Message } from "./messages";
import { createMounter } from "./mount";
import { loadPresets, onPresetsChanged, savePresets } from "./store";
import { createApp, type Ports } from "./ui";

/** Sends to the background worker. Failures become results, as after an extension update. */
async function send<T>(message: Message, schema: z.ZodMiniType<Result<T>>): Promise<Result<T>> {
  try {
    const answer: unknown = await chrome.runtime.sendMessage(message);
    const parsed = schema.safeParse(answer);
    if (parsed.success) return parsed.data;
  } catch {
    // Falls through to the shared failure below.
  }
  return { ok: false, error: { kind: "network", note: "extension not reachable, reload the page" } };
}

const ports = (url: string): Ports => ({
  loadPresets,
  savePresets,
  onPresetsChanged,
  pullState: () => send({ kind: "pullState", url }, answers.pullState),
  candidates: () => send({ kind: "candidates", url }, answers.candidates),
  askReviewer: ({ reviewer }) => send({ kind: "askReviewer", url, reviewer }, answers.empty),
  openOptions: async () => {
    await send({ kind: "openOptions" }, answers.empty);
  },
});

const { sync } = createMounter({
  root: document,
  currentUrl: () => location.href,
  createApp: ({ root, pull }) => {
    const url = `https://github.com/${pull.org}/${pull.repo}/pull/${pull.number}`;
    return createApp({ root, pull, ports: ports(url) });
  },
});

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    sync();
  });
}

new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
sync();
