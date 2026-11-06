// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { findInsertionPoint } from "./anchor";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("findInsertionPoint", () => {
  it("finds a plain heading, as GitHub renders it for visitors", () => {
    document.body.innerHTML = `
      <div id="partial-discussion-sidebar">
        <form><h3 id="target" class="discussion-sidebar-heading">Reviewers</h3><span>No reviews</span></form>
      </div>`;
    expect(findInsertionPoint(document)?.id).toBe("target");
  });

  it("goes after the whole menu when the heading opens one, as for repo members", () => {
    document.body.innerHTML = `
      <div id="partial-discussion-sidebar">
        <form>
          <details id="target"><summary>Reviewers <svg></svg></summary><div>menu</div></details>
          <span>No reviews</span>
        </form>
      </div>`;
    expect(findInsertionPoint(document)?.id).toBe("target");
  });

  it("ignores the same word outside the sidebar", () => {
    document.body.innerHTML = `<h3>Reviewers</h3><div id="partial-discussion-sidebar"><h3>Assignees</h3></div>`;
    expect(findInsertionPoint(document)).toBeNull();
  });

  it("finds nothing on a page without a sidebar", () => {
    document.body.innerHTML = `<main>Files changed</main>`;
    expect(findInsertionPoint(document)).toBeNull();
  });
});
