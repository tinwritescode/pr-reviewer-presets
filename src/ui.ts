import { button, h, STYLES } from "./dom";
import {
  planAsk,
  type AskPhase,
  type Login,
  type OrgName,
  type Preset,
  type PullRef,
} from "./domain";
import type { GithubError, PullState, Result } from "./github";
import { renderLine } from "./line";
import { createSetupDialog } from "./setup-dialog";

/** Everything the UI needs from the outside world. */
export type Ports = {
  loadPresets(org: OrgName): Promise<Preset[]>;
  savePresets(org: OrgName, presets: Preset[]): Promise<void>;
  pullState(pull: PullRef): Promise<Result<PullState>>;
  askReviewer(input: { pull: PullRef; reviewer: Login }): Promise<Result<null>>;
  candidates(pull: PullRef): Promise<Result<Login[]>>;
  openOptions(): Promise<void>;
  /** Fires when another tab changes this org's presets. Returns an unsubscribe. */
  onPresetsChanged(org: OrgName, listener: (presets: Preset[]) => void): () => void;
};

type PullLoad =
  | { kind: "loading" }
  | { kind: "failed"; error: GithubError }
  | { kind: "ready"; state: PullState };

const IDLE: AskPhase = { kind: "idle" };

const failedLogins = (phase: AskPhase) => (phase.kind === "finished" ? phase.failed : []);

function planFor(preset: Preset, state: PullState, phase: AskPhase) {
  return planAsk({
    preset,
    author: state.author,
    requested: state.requested,
    failed: failedLogins(phase),
  });
}

/** Asks one at a time, so one person GitHub refuses cannot block the others. */
async function askAll(input: {
  pull: PullRef;
  reviewers: Login[];
  ports: Ports;
  failNotes: Map<Login, string>;
}) {
  const asked: Login[] = [];
  const failed: Login[] = [];
  for (const reviewer of input.reviewers) {
    const result = await input.ports.askReviewer({ pull: input.pull, reviewer });
    if (result.ok) {
      asked.push(reviewer);
    } else {
      failed.push(reviewer);
      input.failNotes.set(reviewer, result.error.note);
    }
  }
  return { asked, failed };
}

function failureView(error: GithubError, actions: { connect: () => void; retry: () => void }) {
  const line = (label: string, onClick: () => void) =>
    button({ class: "line empty" }, onClick, label);
  switch (error.kind) {
    case "noToken":
    case "unauthorized":
      return line("Connect a GitHub token to ask reviewers", actions.connect);
    case "notFound":
      return line("Token cannot see this repo. Update token", actions.connect);
    case "rejected":
    case "network":
      return line(`Could not load reviewers (${error.note}). Retry`, actions.retry);
    default: {
      const _exhaustive: never = error.kind;
      return _exhaustive;
    }
  }
}

export function createApp(input: { root: ShadowRoot; pull: PullRef; ports: Ports }) {
  const { root, pull, ports } = input;
  let presets: Preset[] = [];
  let load: PullLoad = { kind: "loading" };
  const phases = new Map<string, AskPhase>();
  const failNotes = new Map<Login, string>();
  const content = h("div");

  const dialog = createSetupDialog({
    pull,
    ports,
    getPresets: () => presets,
    onPresetsSaved: setPresets,
  });
  root.append(h("style", {}, STYLES), content, dialog.element);

  function setPresets(next: Preset[]) {
    presets = next;
    render();
  }

  async function ask(preset: Preset) {
    const phase = phases.get(preset.id) ?? IDLE;
    if (load.kind !== "ready" || phase.kind === "sending") return;
    const reviewers = planFor(preset, load.state, phase).askable;
    phases.set(preset.id, { kind: "sending" });
    render();
    const result = await askAll({ pull, reviewers, ports, failNotes });
    if (load.kind === "ready") {
      const requested = [...load.state.requested, ...result.asked];
      load = { kind: "ready", state: { ...load.state, requested } };
    }
    phases.set(preset.id, { kind: "finished", ...result });
    render();
  }

  function lineFor(preset: Preset, state: PullState) {
    const phase = phases.get(preset.id) ?? IDLE;
    return renderLine({
      preset,
      phase,
      failNotes,
      plan: planFor(preset, state, phase),
      onAsk: () => void ask(preset),
      onEdit: () => dialog.openEditor(preset),
    });
  }

  function readyView(state: PullState) {
    if (!state.open) return null;
    if (presets.length === 0) {
      const label = `Set up reviewer presets for ${pull.org}`;
      return button({ class: "line empty" }, dialog.openList, label);
    }
    return h(
      "div",
      {},
      h("div", { class: "lines" }, ...presets.map((preset) => lineFor(preset, state))),
      button({ class: "manage" }, dialog.openList, "Reviewer presets"),
    );
  }

  function currentView() {
    if (load.kind === "failed") {
      return failureView(load.error, {
        connect: () => void ports.openOptions(),
        retry: () => void refresh(),
      });
    }
    return load.kind === "ready" ? readyView(load.state) : null;
  }

  function render() {
    const view = currentView();
    content.replaceChildren(...(view === null ? [] : [view]));
  }

  async function refresh() {
    const [loadedPresets, loadedPull] = await Promise.all([
      ports.loadPresets(pull.org),
      ports.pullState(pull),
    ]);
    load = loadedPull.ok
      ? { kind: "ready", state: loadedPull.value }
      : { kind: "failed", error: loadedPull.error };
    setPresets(loadedPresets);
  }

  const destroy = ports.onPresetsChanged(pull.org, setPresets);
  void refresh();
  return { destroy };
}
