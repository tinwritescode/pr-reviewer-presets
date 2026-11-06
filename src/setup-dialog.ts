import { button, h } from "./dom";
import type { Preset, PullRef } from "./domain";
import { createPresetEditor, type Draft } from "./preset-editor";
import type { Ports } from "./ui";

export function createSetupDialog(deps: {
  pull: PullRef;
  ports: Ports;
  getPresets: () => Preset[];
  onPresetsSaved: (presets: Preset[]) => void;
}) {
  const { pull, ports } = deps;
  const element = h("dialog", { "aria-label": `Reviewer presets for ${pull.org}` });

  function header(title: string) {
    return h(
      "div",
      { class: "dialog-head" },
      h(
        "div",
        {},
        h("div", { class: "dialog-title" }, title),
        h("div", { class: "small" }, `Applies to every ${pull.org} repo. Only you see these.`),
      ),
      button({ class: "close", "aria-label": "Close" }, () => element.close(), "×"),
    );
  }

  function show(...children: Node[]) {
    element.replaceChildren(...children);
    if (!element.open) element.showModal();
  }

  function presetRow(preset: Preset) {
    return h(
      "div",
      { class: "preset" },
      h(
        "div",
        { class: "preset-text" },
        h("div", { class: "preset-name" }, preset.name),
        h("div", { class: "preset-members" }, preset.members.join(", ")),
      ),
      button({ class: "btn" }, () => openEditor(preset), "Edit"),
    );
  }

  function emptyState() {
    return h(
      "div",
      { class: "empty-state" },
      `No presets for ${pull.org} yet. Create one for the group you ask most often.`,
    );
  }

  function openList() {
    const presets = deps.getPresets();
    show(
      header(`Reviewer presets for ${pull.org}`),
      ...(presets.length === 0 ? [emptyState()] : presets.map(presetRow)),
      h(
        "div",
        { class: "actions" },
        button(
          { class: "btn primary" },
          () => openEditor({ id: null, name: "", members: [] }),
          "New preset",
        ),
      ),
    );
  }

  function openEditor(source: Draft) {
    const parts = createPresetEditor({
      source,
      pull,
      org: pull.org,
      getPresets: deps.getPresets,
      candidates: () => ports.candidates(pull),
      onCancel: openList,
      persist: async (next) => {
        await ports.savePresets(pull.org, next);
        deps.onPresetsSaved(next);
        openList();
      },
    });
    show(header(source.id === null ? "New preset" : "Edit preset"), ...parts);
  }

  return { element, openList, openEditor };
}
