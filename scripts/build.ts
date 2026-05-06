/**
 * Workspaces are currently unsuitable for our needs due to an issue
 * with patched dependencies resolving from the root directory.
 *
 * This assumes all resources include a build script in
 * the root and/or web directories. Adjust as needed.
 */

import { readdir, stat, exists } from "fs/promises";
import { join } from "path";
import { $ } from "bun";

const category = /^\[[^\]]+\]$/;

async function build(path: string) {
  const runBuild = await exists(join(path, "package.json"));

  if (!runBuild) return;

  console.log(`Building '${path}'`);

  try {
    await $`cd ${path} && bun install && bun run build`;
  } catch (err) {
    console.error(`Failed to build '${path}':`, err);
  }
}

async function main(targetDir: string) {
  const entries = await readdir(targetDir);

  for (const entry of entries) {
    const fullPath = join(targetDir, entry);
    const stats = await stat(fullPath);

    if (!stats.isDirectory()) continue;

    if (category.test(entry)) {
      if (entry === "[cfx]") continue;

      await main(fullPath);
      continue;
    }

    build(fullPath);
    build(join(fullPath, "web"));
  }
}

main("./server-data/resources");
