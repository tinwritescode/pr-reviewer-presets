const SIDEBAR = "#partial-discussion-sidebar";
const HEADING_TEXT = "Reviewers";

/** True when the element's own text, ignoring its children, is the heading. */
function isHeading(element: Element): boolean {
  const ownText = [...element.childNodes]
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();
  return ownText === HEADING_TEXT;
}

/** The element the line goes right after: under the Reviewers heading in the PR sidebar. */
export function findInsertionPoint(root: ParentNode): Element | null {
  const sidebar = root.querySelector(SIDEBAR);
  if (sidebar === null) return null;
  const heading = [...sidebar.querySelectorAll("*")].find(isHeading);
  if (heading === undefined) return null;
  return heading.closest("details") ?? heading;
}
