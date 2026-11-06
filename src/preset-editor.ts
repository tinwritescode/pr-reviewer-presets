import { avatar, button, h } from "./dom";
import { parseLogin, type Login, type Preset, type PullRef } from "./domain";
import type { Result } from "./github";

export type Draft = { id: string | null; name: string; members: Login[] };

type People =
  | { kind: "loading" }
  | { kind: "failed"; note: string }
  | { kind: "ready"; logins: Login[] };

/** Picked people first, then everyone else GitHub suggests, filtered by the search text. */
function visiblePeople(input: { members: Login[]; people: People; query: string }): Login[] {
  const known = input.people.kind === "ready" ? input.people.logins : [];
  const query = input.query.trim().toLowerCase();
  return [...new Set([...input.members, ...known])].filter((login) => login.includes(query));
}

function peopleNote(people: People) {
  switch (people.kind) {
    case "loading":
      return h("div", { class: "people-note" }, "Loading people…");
    case "failed":
      return h(
        "div",
        { class: "people-note" },
        `Could not load people (${people.note}). Type a login to add someone.`,
      );
    case "ready":
      return null;
    default: {
      const _exhaustive: never = people;
      return _exhaustive;
    }
  }
}

/** Applies a saved or removed preset to the list, keeping the order of the others. */
function withSaved(presets: Preset[], saved: Preset): Preset[] {
  return presets.some((preset) => preset.id === saved.id)
    ? presets.map((preset) => (preset.id === saved.id ? saved : preset))
    : [...presets, saved];
}

export function createPresetEditor(deps: {
  source: Draft;
  pull: PullRef;
  org: string;
  getPresets: () => Preset[];
  candidates: () => Promise<Result<Login[]>>;
  persist: (next: Preset[]) => Promise<void>;
  onCancel: () => void;
}) {
  const draft: Draft = { ...deps.source, members: [...deps.source.members] };
  let people: People = { kind: "loading" };
  let query = "";

  const nameInput = h("input", { id: "preset-name", placeholder: "Backend" });
  nameInput.value = draft.name;
  const searchInput = h("input", {
    id: "preset-search",
    placeholder: `Search ${deps.org} members or type a login`,
  });
  const list = h("div", { class: "people" });
  const count = h("div", { class: "small count" });
  const error = h("div", { class: "error", role: "alert" });

  async function save() {
    const saved: Preset = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      members: draft.members,
    };
    await attempt(withSaved(deps.getPresets(), saved));
  }

  async function remove() {
    await attempt(deps.getPresets().filter((preset) => preset.id !== draft.id));
  }

  async function attempt(next: Preset[]) {
    try {
      await deps.persist(next);
    } catch {
      error.textContent = "Could not save. Browser storage refused the change.";
    }
  }

  const saveButton = button({ class: "btn primary" }, () => void save(), "Save preset");

  function toggle(login: Login) {
    draft.members = draft.members.includes(login)
      ? draft.members.filter((member) => member !== login)
      : [...draft.members, login];
    refresh();
    [...list.querySelectorAll<HTMLElement>("[data-login]")]
      .find((row) => row.dataset.login === login)
      ?.focus();
  }

  function personRow(login: Login) {
    const selected = draft.members.includes(login);
    return button(
      { class: "pick", "aria-pressed": String(selected), "data-login": login },
      () => toggle(login),
      avatar(login),
      h("span", { class: "pick-name" }, login),
      selected ? h("span", { class: "check", "aria-hidden": "true" }, "✓") : null,
    );
  }

  function addRow(visible: Login[]) {
    const typed = parseLogin(query.trim());
    if (typed === null || visible.includes(typed)) return null;
    return button({ class: "pick" }, () => toggle(typed), `Add ${typed}`);
  }

  function refresh() {
    const visible = visiblePeople({ members: draft.members, people, query });
    const rows = [addRow(visible), ...visible.map(personRow), peopleNote(people)];
    list.replaceChildren(...rows.filter((row) => row !== null));
    count.textContent = `${draft.members.length} selected`;
    saveButton.disabled = draft.name.trim() === "" || draft.members.length === 0;
  }

  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value;
    refresh();
  });
  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    refresh();
  });

  refresh();
  void deps.candidates().then((result) => {
    people = result.ok
      ? { kind: "ready", logins: result.value }
      : { kind: "failed", note: result.error.note };
    refresh();
  });

  return [
    h(
      "div",
      { class: "form" },
      h("div", {}, h("label", { for: "preset-name" }, "Preset name"), nameInput),
      h("div", {}, h("label", { for: "preset-search" }, "People"), searchInput, list, count),
      error,
    ),
    h(
      "div",
      { class: "actions" },
      draft.id === null ? null : button({ class: "ghost" }, () => void remove(), "Delete"),
      h("span", { class: "spacer" }),
      button({ class: "btn" }, deps.onCancel, "Cancel"),
      saveButton,
    ),
  ];
}
