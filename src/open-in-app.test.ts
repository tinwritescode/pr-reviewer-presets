// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePullUrl, type PullRef } from "./domain";
import { renderOpenInApp } from "./open-in-app";

const pull = parsePullUrl("https://github.com/cli/cli/pull/14960") as PullRef;
const INSTALL = "https://github.com/tinwritescode/git-tree-compare#install";

function setup() {
  const element = renderOpenInApp(pull);
  document.body.replaceChildren(element);
  const link = element.querySelector<HTMLAnchorElement>("a[data-open-app]");
  if (!link) throw new Error("no link rendered");
  const installLink = () => element.querySelector<HTMLAnchorElement>("a[data-install-app]");
  return { link, installLink };
}

const stopNavigation = (event: Event) => event.preventDefault();

describe("open in git-tree-compare", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.addEventListener("click", stopNavigation);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.removeEventListener("click", stopNavigation);
    vi.restoreAllMocks();
  });

  it("links to this pull request in the app", () => {
    const { link } = setup();
    expect(link.getAttribute("href")).toBe("git-tree-compare://open?repo=cli/cli&pr=14960");
  });

  it("offers nothing to install before the link is used", () => {
    const { installLink } = setup();
    vi.advanceTimersByTime(60_000);
    expect(installLink()).toBeNull();
  });

  it("offers the install page when nothing answers the link", () => {
    const { link, installLink } = setup();
    link.click();
    vi.advanceTimersByTime(1499);
    expect(installLink()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(installLink()?.getAttribute("href")).toBe(INSTALL);
    expect(installLink()?.getAttribute("target")).toBe("_blank");
  });

  it("offers nothing when the window loses focus to the app or its prompt", () => {
    const { link, installLink } = setup();
    link.click();
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(5000);
    expect(installLink()).toBeNull();
  });

  it("withdraws the offer when focus leaves after it appeared, as a prompt answered late does", () => {
    const { link, installLink } = setup();
    link.click();
    vi.advanceTimersByTime(1500);
    expect(installLink()).not.toBeNull();
    window.dispatchEvent(new Event("blur"));
    expect(installLink()).toBeNull();
  });

  it("offers nothing when the tab is hidden", () => {
    const { link, installLink } = setup();
    link.click();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(5000);
    expect(installLink()).toBeNull();
  });

  it("clears the offer when the link is tried again, and offers it once more", () => {
    const { link, installLink } = setup();
    link.click();
    vi.advanceTimersByTime(1500);
    link.click();
    expect(installLink()).toBeNull();
    link.click();
    vi.advanceTimersByTime(1500);
    expect(installLink()).not.toBeNull();
  });

  it("waits afresh on a new try after an earlier one lost focus", () => {
    const { link, installLink } = setup();
    link.click();
    window.dispatchEvent(new Event("blur"));
    link.click();
    vi.advanceTimersByTime(1500);
    expect(installLink()).not.toBeNull();
  });
});
