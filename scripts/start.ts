import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $, file } from "bun";
import { componentsPath, ensureFxServer } from "./update";
import { getProfile } from "./profiles";
import { cwd, isLinux } from "./utils";
import { setup } from "./setup";

export async function start(this: Command) {
  const options = this.opts();

  let serverDataPath = join(cwd, "server-data");

  if (options.profile) {
    const profilePath = await getProfile(options.profile);

    if (!profilePath) {
      console.error(
        `Profile "${options.profile}" not found. Run \`bun fx profiles\` to list profiles.`,
      );
      process.exit(1);
    }

    if (!existsSync(profilePath)) {
      console.error(`Profile path does not exist: ${profilePath}`);
      process.exit(1);
    }

    serverDataPath = profilePath;
  } else {
    await setup();
  }

  const { version, path: artifactDir } = await ensureFxServer(options.update);
  const exe = join(artifactDir, isLinux ? "run.sh" : "fxserver.exe");

  const components = file(componentsPath(version));

  await components.json().then((obj: string[]) => {
    const idx = obj.findIndex((val) => val === "svadhesive");

    if (options.adhesive) {
      if (idx !== -1) return;

      obj.push("svadhesive");
    } else if (idx !== -1) obj.splice(idx, 1);

    return components.write(JSON.stringify(obj, null, 2));
  });

  process.chdir(serverDataPath);
  try {
    await $`${exe} +exec server.cfg`;
  } catch (e) {}
}
