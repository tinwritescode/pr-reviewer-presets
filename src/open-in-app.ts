import { h } from "./dom";
import type { PullRef } from "./domain";

const INSTALL_URL = "https://github.com/tinwritescode/git-tree-compare#install";
const APP_NAME = "git-tree-compare";
const ANSWER_WAIT_MS = 1500;

/**
 * Chrome cannot tell a page whether a URL scheme has an app. A window that keeps focus means
 * nothing answered, which is only a guess, so it offers the install page instead of opening it.
 */
export function renderOpenInApp(pull: PullRef): HTMLElement {
  const link = h(
    "a",
    {
      class: "app-link",
      "data-open-app": true,
      href: `git-tree-compare://open?repo=${pull.org}/${pull.repo}&pr=${pull.number}`,
    },
    `Open in ${APP_NAME}`,
  );
  const offer = h("div", { class: "app-offer" });
  let stopWaiting = () => {};

  function offerInstall() {
    offer.replaceChildren(
      "Did not open? ",
      h(
        "a",
        { "data-install-app": true, href: INSTALL_URL, target: "_blank", rel: "noopener" },
        `Install ${APP_NAME}`,
      ),
    );
  }

  function waitForAnswer() {
    stopWaiting();
    offer.replaceChildren();
    const onAnswer = () => {
      stopWaiting();
      offer.replaceChildren();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onAnswer();
    };
    // The listeners outlive the timer: Chrome's prompt can keep the page focused until it is answered.
    const timer = setTimeout(offerInstall, ANSWER_WAIT_MS);
    stopWaiting = () => {
      clearTimeout(timer);
      window.removeEventListener("blur", onAnswer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    window.addEventListener("blur", onAnswer);
    document.addEventListener("visibilitychange", onVisibility);
  }

  link.addEventListener("click", waitForAnswer);
  return h("div", {}, link, offer);
}
