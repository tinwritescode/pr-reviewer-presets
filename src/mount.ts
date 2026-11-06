import { findInsertionPoint } from "./anchor";
import { parsePullUrl, type PullRef } from "./domain";

type App = { destroy: () => void };
type Mounted = { key: string; host: HTMLElement; app: App };

const keyOf = (pull: PullRef) => `${pull.org}/${pull.repo}#${pull.number}`;

/**
 * Keeps one app attached to the PR sidebar. `sync` is safe to call on every DOM change:
 * GitHub replaces the sidebar and navigates without page loads, and this follows both.
 */
export function createMounter(deps: {
  root: ParentNode;
  currentUrl: () => string;
  createApp: (input: { root: ShadowRoot; pull: PullRef }) => App;
}) {
  let mounted: Mounted | null = null;

  function unmount() {
    mounted?.app.destroy();
    mounted?.host.remove();
    mounted = null;
  }

  function create(pull: PullRef): Mounted {
    const host = document.createElement("div");
    const app = deps.createApp({ root: host.attachShadow({ mode: "open" }), pull });
    return { key: keyOf(pull), host, app };
  }

  function sync() {
    const pull = parsePullUrl(deps.currentUrl());
    if (mounted !== null && (pull === null || mounted.key !== keyOf(pull))) unmount();
    if (pull === null || mounted?.host.isConnected) return;
    const point = findInsertionPoint(deps.root);
    if (point === null) return;
    mounted ??= create(pull);
    point.after(mounted.host);
  }

  return { sync };
}
