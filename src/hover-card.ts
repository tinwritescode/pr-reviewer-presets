import { h } from "./dom";

const CARD_WIDTH = 296;
const VIEWPORT_MARGIN = 8;

/**
 * Shows a card while the trigger is hovered or focused. It opens in place, so the button under
 * the pointer is never rebuilt, and is fixed-position so the sidebar cannot clip it.
 */
export function withHoverCard(trigger: HTMLElement, renderCard: () => HTMLElement) {
  const wrap = h("div", { "data-line-wrap": true }, trigger);
  let opened: HTMLElement | null = null;

  const close = () => {
    opened?.remove();
    opened = null;
    window.removeEventListener("scroll", close, true);
  };

  const open = () => {
    if (opened !== null) return;
    const rect = wrap.getBoundingClientRect();
    opened = h("div", { class: "card-wrap" }, renderCard());
    opened.style.top = `${rect.bottom}px`;
    opened.style.left = `${Math.max(VIEWPORT_MARGIN, rect.right - CARD_WIDTH)}px`;
    wrap.append(opened);
    window.addEventListener("scroll", close, { capture: true, passive: true });
  };

  wrap.addEventListener("mouseenter", open);
  wrap.addEventListener("mouseleave", close);
  wrap.addEventListener("focusin", open);
  wrap.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node && wrap.contains(event.relatedTarget))) close();
  });
  wrap.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  return wrap;
}
