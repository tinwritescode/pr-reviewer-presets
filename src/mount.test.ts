// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { createMounter } from "./mount";

const SIDEBAR = `<div id="partial-discussion-sidebar"><h3>Reviewers</h3><span>No reviews</span></div>`;

function setup() {
  let url = "https://github.com/northwind/api/pull/1";
  const created: string[] = [];
  const destroyed: string[] = [];
  const mounter = createMounter({
    root: document,
    currentUrl: () => url,
    createApp: ({ pull }) => {
      const label = `${pull.org}/${pull.repo}#${pull.number}`;
      created.push(label);
      return { destroy: () => destroyed.push(label) };
    },
  });
  return {
    sync: mounter.sync,
    created,
    destroyed,
    goTo: (next: string) => {
      url = next;
    },
  };
}

const heading = () => document.querySelector("h3");
const mountedHost = () => heading()?.nextElementSibling?.shadowRoot ?? null;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createMounter", () => {
  it("mounts right after the Reviewers heading", () => {
    document.body.innerHTML = SIDEBAR;
    const { sync, created } = setup();
    sync();
    expect(created).toEqual(["northwind/api#1"]);
    expect(mountedHost()).not.toBeNull();
  });

  it("does nothing more when called again", () => {
    document.body.innerHTML = SIDEBAR;
    const { sync, created } = setup();
    sync();
    sync();
    expect(created).toHaveLength(1);
    expect(document.querySelectorAll("#partial-discussion-sidebar > div")).toHaveLength(1);
  });

  it("waits until the sidebar exists", () => {
    const { sync, created } = setup();
    sync();
    expect(created).toEqual([]);
    document.body.innerHTML = SIDEBAR;
    sync();
    expect(created).toHaveLength(1);
  });

  it("re-attaches the same app when GitHub replaces the sidebar", () => {
    document.body.innerHTML = SIDEBAR;
    const { sync, created, destroyed } = setup();
    sync();
    document.body.innerHTML = SIDEBAR;
    sync();
    expect(mountedHost()).not.toBeNull();
    expect(created).toHaveLength(1);
    expect(destroyed).toEqual([]);
  });

  it("starts fresh on another PR", () => {
    document.body.innerHTML = SIDEBAR;
    const { sync, created, destroyed, goTo } = setup();
    sync();
    goTo("https://github.com/northwind/api/pull/2");
    sync();
    expect(destroyed).toEqual(["northwind/api#1"]);
    expect(created).toEqual(["northwind/api#1", "northwind/api#2"]);
    expect(document.querySelectorAll("#partial-discussion-sidebar > div")).toHaveLength(1);
  });

  it("removes itself after leaving PR pages", () => {
    document.body.innerHTML = SIDEBAR;
    const { sync, destroyed, goTo } = setup();
    sync();
    goTo("https://github.com/northwind/api/pulls");
    sync();
    expect(destroyed).toHaveLength(1);
    expect(mountedHost()).toBeNull();
  });

  it("stays mounted across tabs of one PR", () => {
    document.body.innerHTML = SIDEBAR;
    const { sync, created, goTo } = setup();
    sync();
    goTo("https://github.com/northwind/api/pull/1/files");
    sync();
    expect(created).toHaveLength(1);
  });
});
