# FXServer Starter Kit with Bun

A minimal template for setting up a FiveM server using `bun create`.

## Getting started

> [!NOTE]
> Install [Bun](https://bun.com) (v1.3.11 or higher) and [Git](https://git-scm.com/) if you don't already have them.

```bash
bun create luxu-gg/fxserver
cd fxserver
bun i
```

## Configure

Most base settings can be configured in `server-data/server.cfg` (see https://aka.cfx.re/server-commands). For more configuration files, see `server-data/config`.

Your cfx license, mysql connection string, and other private variables (e.g. API keys) should be stored in `server-data/config/secrets.cfg`.

## Start FXServer

```bash
bun fx start
```

FXServer artifacts are downloaded automatically on first start if they are not already present.

### Options

```bash
bun fx start -p qbox          # Use a server-data profile
bun fx start -u               # Download the latest recommended artifact before starting
bun fx start --no-adhesive    # Run without svadhesive
```

## Artifacts

FXServer builds are stored under `artifacts/{version}/`. The active version is tracked in `config/artifact.json`. If no version is pinned, `start` and `update` use the stable recommended build from https://artifacts.jgscripts.com/.

```bash
bun fx artifact                              # Show active version and downloaded builds
bun fx artifact set 28009                    # Download and pin a specific build
bun fx artifact set recommended            # Download and pin the stable recommended build
bun fx artifact set latest                 # Download and pin the newest build
bun fx update                              # Download the recommended build (when nothing is pinned)
```

To track the recommended build automatically again, remove `config/artifact.json` or delete the `version` field.

## Profiles

Profiles let you start FXServer against a custom server-data directory instead of the default `./server-data` in this repo. Profiles are stored in `config/profiles.json`.

```bash
bun fx profiles                                          # List profiles
bun fx profiles set qbox ~/txData/Qbox_Main/       # Add or update a profile
bun fx profiles delete qbox                              # Remove a profile
bun fx start -p qbox                                     # Start with a profile
```

Paths can be absolute or relative to the repo root. When using a profile, the default server-data setup step is skipped.

## Troubleshooting

- **FXServer artifacts won't download.**
  - We've confirmed that any version of Bun prior to v1.3.11 will silently fail, due to an error with BunFile.
