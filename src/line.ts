import { avatar, button, h } from "./dom";
import {
  lineView,
  type AskPhase,
  type AskPlan,
  type Login,
  type MemberStatus,
  type Preset,
} from "./domain";
import { withHoverCard } from "./hover-card";

export type LineInput = {
  preset: Preset;
  plan: AskPlan;
  phase: AskPhase;
  failNotes: ReadonlyMap<Login, string>;
  onAsk: () => void;
  onEdit: () => void;
};

const UNKNOWN_FAILURE = "unknown error";

function statusNote(status: MemberStatus, failNote: string | undefined) {
  switch (status) {
    case "askable":
      return { text: "Will be asked", tone: "" };
    case "author":
      return { text: "You are the author, skipped", tone: "" };
    case "requested":
      return { text: "Already asked", tone: "requested" };
    case "failed":
      return { text: `Could not be asked: ${failNote ?? UNKNOWN_FAILURE}`, tone: "failed-note" };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function memberRow(row: AskPlan["rows"][number], failNotes: LineInput["failNotes"]) {
  const note = statusNote(row.status, failNotes.get(row.login));
  return h(
    "div",
    { class: "row" },
    avatar(row.login),
    h(
      "span",
      { class: "row-text" },
      h("span", { class: "row-login" }, row.login),
      " ",
      h("span", { class: `note ${note.tone}` }, note.text),
    ),
  );
}

function card(input: LineInput) {
  return h(
    "div",
    { class: "card", "data-card": true },
    h(
      "div",
      { class: "card-head" },
      input.preset.name,
      button({ class: "link" }, input.onEdit, "Edit"),
    ),
    ...input.plan.rows.map((row) => memberRow(row, input.failNotes)),
  );
}

function failedLine(failed: Login[], failNotes: LineInput["failNotes"]) {
  if (failed.length === 0) return null;
  const parts = failed.map(
    (login) => `${login} could not be asked: ${failNotes.get(login) ?? UNKNOWN_FAILURE}`,
  );
  return h("div", { class: "failed", role: "status" }, parts.join("; "));
}

function successLine(message: string) {
  return h("div", { class: "line status success", role: "status", tabindex: "0" }, `✓ ${message}`);
}

function askButton(shown: Login[], more: number, onAsk: () => void) {
  return button(
    { class: "line", "data-line": true },
    onAsk,
    h("span", { class: "fixed" }, "Ask for"),
    " ",
    h("strong", { class: "names" }, shown.join(", ")),
    " ",
    more > 0 ? h("span", { class: "more", "aria-label": `and ${more} more` }, `+${more}`) : null,
    " ",
    h("span", { class: "fixed" }, "review"),
  );
}

function askedSummary(shown: Login[], more: number) {
  return `Asked ${shown.join(", ")}${more > 0 ? ` +${more}` : ""}`;
}

export function renderLine(input: LineInput): HTMLElement {
  const { plan, phase, failNotes } = input;
  const hoverable = (trigger: HTMLElement) => withHoverCard(trigger, () => card(input));
  const view = lineView({ plan, phase });
  switch (view.kind) {
    case "ready":
      return h(
        "div",
        {},
        hoverable(askButton(view.shown, view.more, input.onAsk)),
        failedLine(view.failed, failNotes),
      );
    case "sending":
      return h(
        "div",
        { class: "line muted", role: "status" },
        `Asking ${view.total} ${view.total === 1 ? "person" : "people"}…`,
      );
    case "asked":
      return h(
        "div",
        {},
        view.shown.length > 0 ? hoverable(successLine(askedSummary(view.shown, view.more))) : null,
        failedLine(view.failed, failNotes),
      );
    case "allAsked":
      return hoverable(successLine("Everyone already asked"));
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}
