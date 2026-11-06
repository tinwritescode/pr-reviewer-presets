import type { Login } from "./domain";

type Child = Node | string | null;
type Attributes = Record<string, string | boolean>;

/** Builds an element. Text always goes in as text nodes, so names can never become markup. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) element.setAttribute(name, "");
    else if (value !== false) element.setAttribute(name, value);
  }
  element.append(...children.filter((child) => child !== null));
  return element;
}

export function button(attributes: Attributes, onClick: () => void, ...children: Child[]) {
  const element = h("button", { type: "button", ...attributes }, ...children);
  element.addEventListener("click", onClick);
  return element;
}

export function avatar(login: Login) {
  return h("img", {
    class: "avatar",
    src: `https://avatars.githubusercontent.com/${login}?size=48`,
    alt: "",
    width: "24",
    height: "24",
  });
}

export const STYLES = `
:host {
  display: block;
  margin: 4px 0 8px;
  font: 12px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  color: var(--fgColor-default, #1f2328);
  --muted: var(--fgColor-muted, #59636e);
  --accent: var(--fgColor-accent, #0969da);
  --border: var(--borderColor-default, #d1d9e0);
  --surface: var(--bgColor-default, #ffffff);
  --subtle: var(--bgColor-muted, #f6f8fa);
  --hover: var(--bgColor-neutral-muted, #eaeef2);
  --success: var(--fgColor-success, #1a7f37);
  --danger: var(--fgColor-danger, #b3261e);
  --attention: var(--fgColor-severe, #9a3f00);
}
* { box-sizing: border-box; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.lines { display: flex; flex-direction: column; gap: 4px; }
.line {
  display: flex; align-items: center; gap: 4px; width: 100%; min-height: 32px; padding: 6px 8px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--subtle); text-align: left;
}
button.line:hover { background: var(--hover); }
.line.status { background: transparent; }
.line.success { color: var(--success); }
.line.muted { color: var(--muted); }
.line.empty { border-style: dashed; background: transparent; color: var(--accent); }
.names { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--accent); }
.fixed { flex: none; }
.more { flex: none; color: var(--accent); border-bottom: 1px dotted var(--accent); }
.failed { padding: 4px 8px 0; color: var(--attention); }
.manage { display: block; margin-top: 4px; padding: 2px 8px; border: 0; background: none; color: var(--muted); }
.manage:hover { color: var(--accent); }
.app-link { display: inline-block; padding: 2px 8px; color: var(--muted); text-decoration: none; }
.app-link:hover { color: var(--accent); }
.app-offer { padding: 0 8px; color: var(--muted); }
.app-offer a { color: var(--accent); }
.card-wrap { position: fixed; width: 296px; padding-top: 4px; z-index: 100; }
.card { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); box-shadow: 0 8px 24px rgba(31, 35, 40, 0.16); overflow: hidden; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: 600; }
.link { padding: 2px 6px; border: 0; border-radius: 6px; background: none; color: var(--accent); font-weight: 400; }
.row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; }
.row-text { flex: 1 1 auto; min-width: 0; }
.row-login { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.note { display: block; color: var(--muted); }
.note.requested { color: var(--success); }
.note.failed-note { color: var(--attention); }
.avatar { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--hover); }
dialog { width: min(480px, calc(100vw - 32px)); padding: 0; border: 0; border-radius: 12px; background: var(--surface); color: inherit; box-shadow: 0 16px 48px rgba(31, 35, 40, 0.3); font-size: 14px; line-height: 20px; }
dialog::backdrop { background: rgba(31, 35, 40, 0.5); }
.dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); }
.dialog-title { font-size: 16px; line-height: 24px; font-weight: 600; }
.small { color: var(--muted); font-size: 12px; }
.close { flex: none; width: 32px; height: 32px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 18px; }
.close:hover, .ghost:hover { background: var(--subtle); }
.preset { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.preset-text { flex: 1 1 auto; min-width: 0; }
.preset-name { font-weight: 600; }
.preset-members { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; }
.empty-state { padding: 32px 16px; text-align: center; color: var(--muted); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 16px; }
.btn { flex: none; height: 32px; padding: 0 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--subtle); }
.btn:hover { background: var(--hover); }
.primary { border-color: #1a7f37; background: #1f883d; color: #ffffff; font-weight: 500; }
.primary:hover { background: #1a7f37; }
.primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ghost { height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--danger); }
.spacer { flex: 1 1 auto; }
.form { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
label { display: block; margin-bottom: 4px; font-weight: 600; }
input { width: 100%; height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.people { max-height: 220px; margin-top: 8px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; }
.pick { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 4px 12px; border: 0; background: none; text-align: left; }
.pick:hover { background: var(--subtle); }
.pick-name { flex: 1 1 auto; font-weight: 500; }
.check { color: var(--accent); font-weight: 600; }
.people-note { padding: 12px; color: var(--muted); font-size: 12px; }
.count { margin-top: 6px; }
.error { color: var(--danger); font-size: 12px; }
`;
