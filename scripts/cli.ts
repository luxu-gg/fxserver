import { Command } from "commander";
import { checkUpdate } from "./update";
import { listArtifacts, setArtifact } from "./artifacts";
import { deleteProfile, listProfiles, setProfile } from "./profiles";
import { start } from "./start";

const program = new Command("fx");

program
  .command("start")
  .description(
    "Starts the FXServer process directly (without launching txAdmin).",
  )
  .option("-p, --profile <name>", "Server-data profile to use")
  .option("--no-adhesive", "Run fxserver without svadhesive")
  .option("-u, --update", "Update fxserver before starting")
  .action(start);

const profiles = program
  .command("profiles")
  .description("Manage server-data profiles");

profiles
  .command("set")
  .description("Add or update a profile")
  .argument("<name>", "Profile name")
  .argument("<path>", "Path to server-data directory")
  .action(setProfile);

profiles
  .command("delete")
  .description("Remove a profile")
  .argument("<name>", "Profile name")
  .action(deleteProfile);

profiles.action(listProfiles);

const artifact = program
  .command("artifact")
  .description("Manage FXServer artifact versions");

artifact
  .command("set")
  .description("Download and pin a specific artifact version")
  .argument(
    "<version>",
    'Artifact build number, or "latest" / "recommended"',
  )
  .action(setArtifact);

artifact.action(listArtifacts);

program
  .command("update")
  .description(
    "Installs the the latest recommended artifact from https://artifacts.jgscripts.com/",
  )
  .action(checkUpdate);

program.parse();
