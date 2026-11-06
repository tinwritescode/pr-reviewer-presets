// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { withHoverCard } from "./hover-card";

function setup() {
  const trigger = document.createElement("button");
  const outside = document.createElement("button");
  const wrap = withHoverCard(trigger, () => {
    const card = document.createElement("div");
    card.id = "card";
    return card;
  });
  document.body.append(wrap, outside);
  return { wrap, outside };
}

const card = () => document.querySelector("#card");

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("withHoverCard", () => {
  it("opens once however many times the pointer re-enters", () => {
    const { wrap } = setup();
    wrap.dispatchEvent(new MouseEvent("mouseenter"));
    wrap.dispatchEvent(new MouseEvent("mouseenter"));
    expect(document.querySelectorAll("#card")).toHaveLength(1);
  });

  it("opens for keyboard users on focus and closes on Escape", () => {
    const { wrap } = setup();
    wrap.dispatchEvent(new FocusEvent("focusin"));
    expect(card()).not.toBeNull();
    wrap.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(card()).toBeNull();
  });

  it("stays open while focus moves inside it", () => {
    const { wrap } = setup();
    wrap.dispatchEvent(new FocusEvent("focusin"));
    const inner = card();
    if (inner === null) throw new Error("card did not open");
    wrap.dispatchEvent(new FocusEvent("focusout", { relatedTarget: inner }));
    expect(card()).not.toBeNull();
  });

  it("closes when focus leaves", () => {
    const { wrap, outside } = setup();
    wrap.dispatchEvent(new FocusEvent("focusin"));
    wrap.dispatchEvent(new FocusEvent("focusout", { relatedTarget: outside }));
    expect(card()).toBeNull();
  });

  it("closes on scroll, since a fixed card would drift from its line", () => {
    const { wrap } = setup();
    wrap.dispatchEvent(new MouseEvent("mouseenter"));
    window.dispatchEvent(new Event("scroll"));
    expect(card()).toBeNull();
  });
});
