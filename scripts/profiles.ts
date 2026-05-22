import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { cwd } from "./utils";

const profilesPath = join(cwd, "config", "profiles.json");

export type Profiles = Record<string, string>;

async function loadProfiles(): Promise<Profiles> {
  const file = Bun.file(profilesPath);

  if (!(await file.exists())) {
    return {};
  }

  const text = (await file.text()).trim();
  if (!text) {
    return {};
  }

  const profiles = JSON.parse(text) as Profiles;

  if (typeof profiles !== "object" || profiles === null || Array.isArray(profiles)) {
    throw new Error(`Invalid profiles file: ${profilesPath}`);
  }

  return profiles;
}

async function saveProfiles(profiles: Profiles) {
  await mkdir(dirname(profilesPath), { recursive: true });
  await Bun.write(profilesPath, JSON.stringify(profiles, null, 2) + "\n");
}

export function resolveProfilePath(path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(cwd, path);
}

export async function getProfile(name: string): Promise<string | undefined> {
  const profiles = await loadProfiles();
  const path = profiles[name];

  if (!path) {
    return undefined;
  }

  return resolveProfilePath(path);
}

export async function listProfiles() {
  const profiles = await loadProfiles();
  const names = Object.keys(profiles).sort();

  if (names.length === 0) {
    console.log("No profiles configured.");
    console.log(`Add one with: bun fx profiles set <name> <path>`);
    return;
  }

  const defaultPath = join(cwd, "server-data");

  console.log("Profiles:");
  for (const name of names) {
    const resolved = resolveProfilePath(profiles[name]!);
    const isDefault = resolved === resolve(defaultPath);
    console.log(`  ${name}: ${profiles[name]!}${isDefault ? " (default server-data)" : ""}`);
  }
}

export async function setProfile(name: string, path: string) {
  const resolved = resolveProfilePath(path);

  if (!existsSync(resolved)) {
    console.error(`Path does not exist: ${resolved}`);
    process.exit(1);
  }

  const profiles = await loadProfiles();
  profiles[name] = path;
  await saveProfiles(profiles);

  console.log(`Profile "${name}" set to ${path}`);
}

export async function deleteProfile(name: string) {
  const profiles = await loadProfiles();

  if (!(name in profiles)) {
    console.error(`Profile "${name}" not found.`);
    process.exit(1);
  }

  delete profiles[name];
  await saveProfiles(profiles);

  console.log(`Profile "${name}" deleted.`);
}
