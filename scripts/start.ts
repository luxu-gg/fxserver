import { Command } from "commander";
import { join } from "node:path";
import { $, file } from "bun";
import { checkUpdate } from "./update";
import { bin, isLinux } from "./utils";
import { setup } from "./setup";

export async function start(this: Command) {
  const options = this.opts();
  const exe = join(bin, isLinux ? "run.sh" : "fxserver.exe");

  await setup();

  if (options.update) {
    await checkUpdate();
  }

  const components = file(
    isLinux
      ? "./bin/alpine/opt/cfx-server/components.json"
      : "./bin/components.json",
  );

  await components.json().then((obj: string[]) => {
    const idx = obj.findIndex((val) => val === "svadhesive");

    if (options.adhesive) {
      if (idx !== -1) return;

      obj.push("svadhesive");
    } else if (idx !== -1) obj.splice(idx, 1);

    return components.write(JSON.stringify(obj, null, 2));
  });

  process.chdir("./server-data");
  try {
    await $`${exe} +exec server.cfg`;
  } catch (e) {}
}
