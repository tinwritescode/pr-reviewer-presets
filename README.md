# PR Reviewer Presets

A Chrome extension that asks your usual GitHub reviewers in one click.

Under **Reviewers** on a pull request it adds a line per preset:

> Ask for mira-chen, jonas-l +1 review

Hover to see everyone in the preset and what will happen to each of them. Click to ask them. The PR author and anyone already asked are skipped.

Presets are set up from the PR page and saved per organization in `chrome.storage.sync`. Only you see them.

## Install

```bash
pnpm install
pnpm build
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `dist` folder.
3. Open a pull request and click **Connect a GitHub token**.
4. Paste a token. To use your GitHub CLI login:

```bash
gh auth token | pbcopy
```

That token carries every scope your CLI login has. For less access, create a classic token with the `repo` scope, or a fine-grained token with read and write access to pull requests.

## Open in git-tree-compare

Each pull request also gets an **Open in git-tree-compare** link, which needs version 0.7 or later of [the app](https://github.com/tinwritescode/git-tree-compare#install). Chrome cannot tell a page whether the app is installed, so when the page keeps focus for 1.5 seconds after the click, the extension offers the install link. It removes the offer if focus leaves later.

## Security

The token is stored in `chrome.storage.local`, restricted to extension pages and the background worker, and is only sent to `api.github.com`. Content scripts running on github.com cannot read it.

## Development

```bash
pnpm test
pnpm typecheck
```
