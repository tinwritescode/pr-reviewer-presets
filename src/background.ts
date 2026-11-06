import { createGithub } from "./github";
import { handleMessage } from "./messages";
import { getToken } from "./store";

// Keeps the token out of reach of content scripts, which run inside github.com pages.
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

chrome.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
  void handleMessage(message, {
    getToken,
    createClient: (token) => createGithub({ token, fetch: (...args) => fetch(...args) }),
    openOptions: () => chrome.runtime.openOptionsPage(),
  }).then(respond);
  return true; // The answer arrives asynchronously.
});
