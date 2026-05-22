import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { file, $, Archive } from "bun";
import { artifactsDir, cwd, downloadFile, isLinux } from "./utils";
import { path7za } from "7zip-bin";
import { extractFull } from "node-7z";

interface ArtifactsApi {
  recommendedArtifact: string;
  windowsDownloadLink: string;
  linuxDownloadLink: string;
  brokenArtifacts: { artifact: string; reason: string }[];
}

interface ArtifactConfig {
  version?: string;
}

interface ChangelogApi {
  latest: string;
  recommended: string;
  latest_download: string;
  recommended_download: string;
}

const configPath = join(cwd, "config", "artifact.json");
const runtimeBase = isLinux
  ? "https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/"
  : "https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/";

let apiCache: { data: ArtifactsApi; fetchedAt: number } | undefined;
let changelogCache: { data: ChangelogApi; fetchedAt: number } | undefined;

export function artifactPath(version: string) {
  return join(artifactsDir, version);
}

export function componentsPath(version: string) {
  return join(
    artifactPath(version),
    isLinux ? "alpine/opt/cfx-server/components.json" : "components.json",
  );
}

async function loadArtifactConfig(): Promise<ArtifactConfig> {
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    return {};
  }

  const text = (await configFile.text()).trim();
  if (!text) {
    return {};
  }

  const config = JSON.parse(text) as ArtifactConfig;

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error(`Invalid artifact config: ${configPath}`);
  }

  return config;
}

async function saveArtifactConfig(config: ArtifactConfig) {
  await mkdir(dirname(configPath), { recursive: true });
  await Bun.write(configPath, JSON.stringify(config, null, 2) + "\n");
}

export async function fetchArtifactsApi(force = false): Promise<ArtifactsApi> {
  const timestamp = Math.floor(Date.now() / 1000);

  if (!force && apiCache && timestamp - apiCache.fetchedAt < 300) {
    return apiCache.data;
  }

  const data = (await fetch("https://artifacts.jgscripts.com/jsonv2").then((v) =>
    v.json().catch(() => ({})),
  )) as ArtifactsApi;

  apiCache = { data, fetchedAt: timestamp };
  return data;
}

async function fetchChangelogApi(force = false): Promise<ChangelogApi> {
  const timestamp = Math.floor(Date.now() / 1000);

  if (!force && changelogCache && timestamp - changelogCache.fetchedAt < 300) {
    return changelogCache.data;
  }

  const platform = isLinux ? "linux" : "windows";
  const data = (await fetch(
    `https://changelogs-live.fivem.net/api/changelog/versions/${platform}/server`,
  ).then((v) => v.json().catch(() => ({})))) as ChangelogApi;

  changelogCache = { data, fetchedAt: timestamp };
  return data;
}

async function resolveArtifactVersion(input: string): Promise<string> {
  const alias = input.toLowerCase();

  if (alias === "recommended") {
    const api = await fetchArtifactsApi(true);
    return api.recommendedArtifact;
  }

  if (alias === "latest") {
    const changelog = await fetchChangelogApi(true);
    return changelog.latest;
  }

  if (!/^\d+$/.test(input)) {
    console.error(
      `Unknown artifact "${input}". Use a build number, "latest", or "recommended".`,
    );
    process.exit(1);
  }

  return input;
}

export async function getPinnedVersion(): Promise<string | undefined> {
  const config = await loadArtifactConfig();
  return config.version;
}

export async function resolveActiveVersion(force = false): Promise<string> {
  const pinned = await getPinnedVersion();

  if (pinned) {
    return pinned;
  }

  const api = await fetchArtifactsApi(force);
  return api.recommendedArtifact;
}

function getBrokenReasons(version: string, api: ArtifactsApi): string[] {
  const issues: string[] = [];

  for (const broken of api.brokenArtifacts) {
    if (version === broken.artifact) {
      issues.push(broken.reason);
      continue;
    }

    const [min, max] = broken.artifact.split("-");

    if (!min || !max) continue;

    if (+version >= +min && +version <= +max) {
      issues.push(broken.reason);
    }
  }

  return issues;
}

async function warnIfBroken(version: string) {
  const api = await fetchArtifactsApi();
  const issues = getBrokenReasons(version, api);

  if (!issues.length) return;

  console.warn(
    `fxserver version ${version} may be unsafe for use in production!\n - ${issues.join("\n - ")}`,
  );
}

async function resolveDownloadUrl(version: string): Promise<string> {
  const api = await fetchArtifactsApi();

  if (version === api.recommendedArtifact) {
    return api[isLinux ? "linuxDownloadLink" : "windowsDownloadLink"];
  }

  const changelog = await fetchChangelogApi();

  if (version === changelog.latest) {
    return changelog.latest_download;
  }

  if (version === changelog.recommended) {
    return changelog.recommended_download;
  }

  const html = await fetch(runtimeBase).then((response) => response.text());
  const pattern = isLinux
    ? new RegExp(`\\./(${version}-[a-f0-9]+)/fx\\.tar\\.xz`)
    : new RegExp(`\\./(${version}-[a-f0-9]+)/server\\.7z`);
  const match = html.match(pattern);

  if (!match) {
    console.error(`Artifact ${version} was not found.`);
    process.exit(1);
  }

  const archive = isLinux ? "fx.tar.xz" : "server.7z";
  return `${runtimeBase}${match[1]}/${archive}`;
}

export async function downloadArtifact(version: string, force = false) {
  if (!force && existsSync(componentsPath(version))) {
    return;
  }

  await warnIfBroken(version);

  const url = await resolveDownloadUrl(version);
  const dest = artifactPath(version);
  const tempDir = join(artifactsDir, ".tmp");
  const archiveName = isLinux ? "fx.tar.xz" : "server.7z";
  const archivePath = join(tempDir, archiveName);

  await mkdir(tempDir, { recursive: true });
  await downloadFile(url, archivePath);

  console.log(`Extracting files...`);

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  try {
    if (isLinux) {
      await $`xz -df ${archivePath}`;

      const tarPath = archivePath.slice(0, -3);
      const input = await file(tarPath).bytes();
      const archive = new Archive(input);

      await archive.extract(dest);
    } else {
      extractFull(archivePath, dest, {
        $bin: path7za,
      });
    }

    await Bun.write(
      join(dest, ".info"),
      JSON.stringify({
        version,
        downloaded_at: Math.floor(Date.now() / 1000),
      }) + "\n",
    );

    console.log(`Successfully downloaded fxserver version ${version}!`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function ensureFxServer(force = false) {
  const version = await resolveActiveVersion(force);

  if (force || !existsSync(componentsPath(version))) {
    await downloadArtifact(version, force);
  }

  if (!existsSync(componentsPath(version))) {
    console.error(
      "FXServer artifacts are missing. Run `bun fx update` or `bun fx artifact set <version>`.",
    );
    process.exit(1);
  }

  return { version, path: artifactPath(version) };
}

export async function checkUpdate(force = false) {
  const pinned = await getPinnedVersion();

  if (pinned && !force) {
    console.log(
      `Artifact ${pinned} is pinned. Run \`bun fx artifact set ${pinned}\` to re-download, or clear the pin in config/artifact.json to track stable.`,
    );
    return;
  }

  if (!force) {
    process.stdout.write(`Checking for updates...`);
  }

  const version = await resolveActiveVersion(true);
  const currentPath = artifactPath(version);
  const missing = !existsSync(componentsPath(version));

  if (!force && !missing) {
    process.stdout.write(
      `\rYou are running the recommended artifact (${version}).\n`,
    );
    return;
  }

  await downloadArtifact(version, force);
}

export async function setArtifact(input: string) {
  const version = await resolveArtifactVersion(input);

  await downloadArtifact(version);
  await saveArtifactConfig({ version });

  const alias = input.toLowerCase();
  const label =
    alias === "latest" || alias === "recommended"
      ? `${version} (${alias})`
      : version;

  console.log(`Active artifact set to ${label}.`);
}

export async function listArtifacts() {
  const pinned = await getPinnedVersion();
  const api = await fetchArtifactsApi();
  const active = pinned ?? api.recommendedArtifact;

  if (pinned) {
    console.log(`Active: ${pinned} (pinned)`);
  } else {
    console.log(`Active: ${api.recommendedArtifact} (stable, recommended)`);
  }

  if (!existsSync(artifactsDir)) {
    console.log("\nNo artifacts downloaded yet.");
    return;
  }

  const installed = readdirSync(artifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== ".tmp")
    .map((entry) => entry.name)
    .filter((name) => existsSync(componentsPath(name)))
    .sort((a, b) => +b - +a);

  if (installed.length === 0) {
    console.log("\nNo artifacts downloaded yet.");
    return;
  }

  console.log("\nDownloaded:");
  for (const version of installed) {
    const marker =
      version === active ? " *" : version === api.recommendedArtifact ? " (recommended)" : "";
    console.log(`  ${version}${marker}`);
  }
}
