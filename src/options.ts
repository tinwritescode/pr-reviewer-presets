import { createGithub } from "./github";
import { clearToken, getToken, setToken } from "./store";

function element<T extends Element>(selector: string, type: new () => T): T {
  const found = document.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`options page is missing ${selector}`);
  return found;
}

const input = element("#token", HTMLInputElement);
const save = element("#save", HTMLButtonElement);
const remove = element("#remove", HTMLButtonElement);
const status = element("#status", HTMLParagraphElement);

async function accountFor(token: string) {
  return createGithub({ token, fetch: (...args) => fetch(...args) }).whoAmI();
}

async function showCurrent() {
  const token = await getToken();
  remove.hidden = token === null;
  if (token === null) {
    status.textContent = "No token saved.";
    return;
  }
  const account = await accountFor(token);
  status.textContent = account.ok
    ? `Connected as ${account.value ?? "this token's account"}.`
    : `Saved token does not work: ${account.error.note}.`;
}

save.addEventListener("click", () => {
  void (async () => {
    const token = input.value.trim();
    if (token === "") return;
    status.textContent = "Checking token…";
    const account = await accountFor(token);
    if (!account.ok) {
      status.textContent = `Not saved: ${account.error.note}.`;
      return;
    }
    await setToken(token);
    input.value = "";
    await showCurrent();
  })();
});

remove.addEventListener("click", () => {
  void clearToken().then(showCurrent);
});

void showCurrent();
