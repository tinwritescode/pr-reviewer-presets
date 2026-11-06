import * as z from "zod/mini";
import { parsePresets, storageKey, type OrgName, type Preset } from "./domain";

const TOKEN_KEY = "githubToken";
const tokenSchema = z.string().check(z.minLength(1));

export async function loadPresets(org: OrgName): Promise<Preset[]> {
  const key = storageKey(org);
  const stored = await chrome.storage.sync.get(key);
  return parsePresets(stored[key]);
}

export async function savePresets(org: OrgName, presets: Preset[]): Promise<void> {
  await chrome.storage.sync.set({ [storageKey(org)]: presets });
}

export function onPresetsChanged(org: OrgName, listener: (presets: Preset[]) => void): () => void {
  const key = storageKey(org);
  const handle = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    const change = changes[key];
    if (area === "sync" && change !== undefined) listener(parsePresets(change.newValue));
  };
  chrome.storage.onChanged.addListener(handle);
  return () => chrome.storage.onChanged.removeListener(handle);
}

export async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const parsed = tokenSchema.safeParse(stored[TOKEN_KEY]);
  return parsed.success ? parsed.data : null;
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
}
