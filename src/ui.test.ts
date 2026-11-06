// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { parseLogin, parsePullUrl, type Login, type Preset } from "./domain";
import type { GithubError, PullState, Result } from "./github";
import { createApp, type Ports } from "./ui";

const parsedPull = parsePullUrl("https://github.com/northwind/billing-api/pull/482");
if (parsedPull === null) throw new Error("bad test url");
const pull = parsedPull;

function login(raw: string): Login {
  const parsed = parseLogin(raw);
  if (parsed === null) throw new Error(`bad test login ${raw}`);
  return parsed;
}

const logins = (...raw: string[]) => raw.map(login);
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

const backend: Preset = {
  id: "backend",
  name: "Backend",
  members: logins("mira-chen", "jonas-l", "priya-k", "dana-w", "lee-park"),
};

const openPull: PullState = {
  open: true,
  author: login("lee-park"),
  requested: logins("priya-k"),
};

function setup(
  overrides: Partial<Ports> & { presets?: Preset[]; state?: PullState } = {},
) {
  const asked: string[] = [];
  const saved: Preset[][] = [];
  let openedOptions = 0;
  const ports: Ports = {
    loadPresets: async () => overrides.presets ?? [backend],
    savePresets: async (_org, presets) => {
      saved.push(presets);
    },
    pullState: async () => ok(overrides.state ?? openPull),
    askReviewer: async (input) => {
      asked.push(input.reviewer);
      return ok(null);
    },
    candidates: async () => ok(logins("mira-chen", "sam-ortiz", "ines-v")),
    openOptions: async () => {
      openedOptions += 1;
    },
    onPresetsChanged: () => () => undefined,
    ...overrides,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const app = createApp({ root, pull, ports });
  return { root, app, asked, saved, openedOptions: () => openedOptions };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = (node: ParentNode | null | undefined) =>
  (node?.textContent ?? "").replace(/\s+/g, " ").trim();
const buttonNamed = (root: ParentNode, name: string) => {
  const match = [...root.querySelectorAll("button")].find((b) => text(b).includes(name));
  if (match === undefined) throw new Error(`no button named ${name}`);
  return match;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("the line", () => {
  it("names two people and counts the rest, leaving out author and already asked", async () => {
    const { root } = setup();
    await settle();
    expect(text(root.querySelector("[data-line]"))).toBe("Ask for mira-chen, jonas-l +1 review");
  });

  it("offers setup when the org has no presets", async () => {
    const { root } = setup({ presets: [] });
    await settle();
    expect(text(root)).toContain("Set up reviewer presets for northwind");
  });

  it("offers to connect a token when none is saved", async () => {
    const error: GithubError = { kind: "noToken", note: "no token" };
    const { root, openedOptions } = setup({
      pullState: async () => ({ ok: false, error }),
    });
    await settle();
    buttonNamed(root, "Connect a GitHub token").click();
    await settle();
    expect(openedOptions()).toBe(1);
  });

  it("shows nothing to ask on a closed PR", async () => {
    const { root } = setup({ state: { ...openPull, open: false } });
    await settle();
    expect(root.querySelector("[data-line]")).toBeNull();
  });
});

describe("hovering", () => {
  it("lists everyone in the preset with what will happen to them", async () => {
    const { root } = setup();
    await settle();
    root.querySelector("[data-line-wrap]")?.dispatchEvent(new MouseEvent("mouseenter"));
    const card = text(root.querySelector("[data-card]"));
    expect(card).toContain("Backend");
    expect(card).toContain("mira-chen Will be asked");
    expect(card).toContain("priya-k Already asked");
    expect(card).toContain("lee-park You are the author, skipped");
  });

  it("closes when the pointer leaves", async () => {
    const { root } = setup();
    await settle();
    const wrap = root.querySelector("[data-line-wrap]");
    wrap?.dispatchEvent(new MouseEvent("mouseenter"));
    root.querySelector("[data-line-wrap]")?.dispatchEvent(new MouseEvent("mouseleave"));
    expect(root.querySelector("[data-card]")).toBeNull();
  });
});

describe("asking", () => {
  it("asks only the people the line promised", async () => {
    const { root, asked } = setup();
    await settle();
    buttonNamed(root, "Ask for").click();
    await settle();
    expect(asked).toEqual(["mira-chen", "jonas-l", "dana-w"]);
    expect(text(root)).toContain("Asked mira-chen, jonas-l +1");
  });

  it("cannot ask twice from a double click", async () => {
    const { root, asked } = setup();
    await settle();
    const button = buttonNamed(root, "Ask for");
    button.click();
    button.click();
    await settle();
    expect(asked).toEqual(["mira-chen", "jonas-l", "dana-w"]);
  });

  it("still asks the others when one person fails, and says why", async () => {
    const asked: string[] = [];
    const { root } = setup({
      askReviewer: async (input) => {
        asked.push(input.reviewer);
        return input.reviewer === "jonas-l"
          ? { ok: false, error: { kind: "rejected", note: "no repo access" } }
          : ok(null);
      },
    });
    await settle();
    buttonNamed(root, "Ask for").click();
    await settle();
    expect(asked).toEqual(["mira-chen", "jonas-l", "dana-w"]);
    expect(text(root)).toContain("Asked mira-chen, dana-w");
    expect(text(root)).toContain("jonas-l could not be asked: no repo access");
  });

  it("says everyone was already asked when nobody is left", async () => {
    const { root } = setup({
      state: { ...openPull, requested: logins("mira-chen", "jonas-l", "priya-k", "dana-w") },
    });
    await settle();
    expect(text(root)).toContain("Everyone already asked");
  });
});

describe("setup", () => {
  async function openEditor() {
    const context = setup();
    await settle();
    buttonNamed(context.root, "Reviewer presets").click();
    buttonNamed(context.root, "New preset").click();
    await settle();
    return context;
  }

  function fillName(root: ShadowRoot, value: string) {
    const input = root.querySelector<HTMLInputElement>("#preset-name");
    if (input === null) throw new Error("no name input");
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  it("creates a preset from picked people, keyed to this org", async () => {
    const saves: { org: string; presets: Preset[] }[] = [];
    const context = setup({
      savePresets: async (org, presets) => {
        saves.push({ org, presets });
      },
    });
    await settle();
    buttonNamed(context.root, "Reviewer presets").click();
    buttonNamed(context.root, "New preset").click();
    await settle();
    fillName(context.root, "Frontend");
    buttonNamed(context.root, "sam-ortiz").click();
    buttonNamed(context.root, "ines-v").click();
    buttonNamed(context.root, "Save preset").click();
    await settle();
    expect(saves[0]?.org).toBe("northwind");
    expect(saves[0]?.presets.at(-1)).toMatchObject({
      name: "Frontend",
      members: ["sam-ortiz", "ines-v"],
    });
    expect(text(context.root)).toContain("Ask for sam-ortiz, ines-v review");
  });

  it("does not allow saving without a name and at least one person", async () => {
    const { root } = await openEditor();
    expect(buttonNamed(root, "Save preset").disabled).toBe(true);
    fillName(root, "Frontend");
    expect(buttonNamed(root, "Save preset").disabled).toBe(true);
    buttonNamed(root, "sam-ortiz").click();
    expect(buttonNamed(root, "Save preset").disabled).toBe(false);
  });

  it("keeps what was typed in the name when people are picked", async () => {
    const { root } = await openEditor();
    fillName(root, "Fron");
    const input = root.querySelector("#preset-name");
    buttonNamed(root, "sam-ortiz").click();
    expect(root.querySelector("#preset-name")).toBe(input);
  });

  it("can add someone by typing a login the list does not have", async () => {
    const { root } = await openEditor();
    const search = root.querySelector<HTMLInputElement>("#preset-search");
    if (search === null) throw new Error("no search input");
    search.value = "New-Person";
    search.dispatchEvent(new Event("input"));
    buttonNamed(root, "Add new-person").click();
    expect(text(root)).toContain("1 selected");
  });

  it("deletes a preset", async () => {
    const { root, saved } = setup();
    await settle();
    buttonNamed(root, "Reviewer presets").click();
    buttonNamed(root, "Edit").click();
    await settle();
    buttonNamed(root, "Delete").click();
    await settle();
    expect(saved.at(-1)).toEqual([]);
  });
});

describe("when GitHub refuses", () => {
  const refused = (kind: GithubError["kind"], note: string) => async () => ({
    ok: false as const,
    error: { kind, note },
  });

  it("explains that the token cannot see the repo", async () => {
    const { root, openedOptions } = setup({ pullState: refused("notFound", "cannot see") });
    await settle();
    buttonNamed(root, "Token cannot see this repo").click();
    await settle();
    expect(openedOptions()).toBe(1);
  });

  it("offers a retry after a passing failure, and recovers", async () => {
    let attempts = 0;
    const { root } = setup({
      pullState: async () => {
        attempts += 1;
        return attempts === 1
          ? { ok: false, error: { kind: "network", note: "network error" } }
          : ok(openPull);
      },
    });
    await settle();
    buttonNamed(root, "Retry").click();
    await settle();
    expect(text(root.querySelector("[data-line]"))).toContain("Ask for");
  });

  it("shows why someone failed in the hover list too", async () => {
    const { root } = setup({
      askReviewer: async (input) =>
        input.reviewer === "jonas-l"
          ? { ok: false, error: { kind: "rejected", note: "no repo access" } }
          : ok(null),
      presets: [{ ...backend, members: logins("mira-chen", "jonas-l", "dana-w", "sam-ortiz") }],
      candidates: async () => ok([]),
    });
    await settle();
    buttonNamed(root, "Ask for").click();
    await settle();
    root.querySelector("[data-line-wrap]")?.dispatchEvent(new MouseEvent("mouseenter"));
    expect(text(root.querySelector("[data-card]"))).toContain(
      "jonas-l Could not be asked: no repo access",
    );
  });

  it("keeps the editor open with a message when storage refuses", async () => {
    const { root } = setup({
      savePresets: async () => {
        throw new Error("quota");
      },
    });
    await settle();
    buttonNamed(root, "Reviewer presets").click();
    buttonNamed(root, "Edit").click();
    buttonNamed(root, "Save preset").click();
    await settle();
    expect(text(root.querySelector("[role=alert]"))).toContain("Could not save");
  });

  it("still lets you type a login when the people list fails to load", async () => {
    const { root } = setup({ candidates: refused("network", "network error") });
    await settle();
    buttonNamed(root, "Reviewer presets").click();
    buttonNamed(root, "New preset").click();
    await settle();
    expect(text(root.querySelector(".people"))).toContain("Type a login");
  });
});
