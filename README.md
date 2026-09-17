# Testing Modules 1 2 3 4

Public Synthetiq Player testing repository for two FRAnime implementations.

## Install in the app

**Option A — add this repository** (installs the bundle now, then offers later versions on Check):

```text
https://raw.githubusercontent.com/kas021/Testing-Modules-1-2-3-4/main/repository.json
```

Settings → Media & Sources → add/import a **repository URL** and paste that line.
The app downloads `bundle-3`, installs both modules inside it, and links the
repository so **Check** can offer later versions.

**Option B — import the module ZIP directly** (single module, no repository link):

- [FRAnime Codex 1.0.0-beta.5](https://github.com/kas021/Testing-Modules-1-2-3-4/releases/download/module-franime-v1-v1.0.0-beta.5/FRAnimeCodex-1.0.0-beta.5.zip)
- [FRAnime Hermes 1.0.0-beta.3](https://github.com/kas021/Testing-Modules-1-2-3-4/releases/download/module-franime-hermes-v1-v1.0.0-beta.3/FRAnimeHermes-1.0.0-beta.3.zip)

Download that file and import it under Settings → Media & Sources → the
module/package import action. Import the **ZIP itself** — not this repository
archive, not the extracted module folder, and not the bundle.

## Current modules

| Variant | Module ID | Version | Identity number |
| --- | --- | --- | ---: |
| FRAnime Codex | `franime-v1` | `1.0.0-beta.5` | 9002 |
| FRAnime Hermes | `franime-hermes-v1` | `1.0.0-beta.3` | 9003 |

Bundle `4`: [`Testing-Modules-1-2-3-4-Bundle-4.zip`](bundles/Testing-Modules-1-2-3-4-Bundle-4.zip)
— contains both module ZIPs.

`repository.json` is the index the app reads: bundle and module entries with
their release URLs, SHA-256 digests and signature fields. `SHA256SUMS` records
the same digests for manual checking. Source folders:
[`modules/FranimeCodexBeta5/`](modules/FranimeCodexBeta5/) and
[`modules/FranimeHermesBeta3/`](modules/FranimeHermesBeta3/).

## Trust / signature status

The index is currently **unsigned** (empty signature fields), so the app installs
this as a *community repository*: fully usable, but not marked trusted. To publish
a trusted, signed index, add the repository secret `MODULE_REPOSITORY_SIGNING_JWK`
(the same private signing JWK used by `modules-testing-environment`) under Settings →
Secrets and variables → Actions, then re-run the **Validate and publish catalogue**
workflow. It signs `repository.json` with the testing key the app already trusts.

## Updating a module (this repository is the source of truth)

1. Put the new flat ZIP under `modules/<Name>/dist/<Name>-<version>.zip`.
   Never overwrite a published ZIP — add a new version instead; CI rejects
   changes to existing files under `modules/` and `bundles/`.
2. Bump `bundleVersion` in `catalogue.json`, point its `modules[].file` at the new
   ZIP and add a short `changelog`.
3. Rebuild the derived artifacts:

```bash
node scripts/build_bundle.mjs        # rewrites bundles/<...>-Bundle-<n>.zip
node scripts/build_repository.mjs    # rewrites repository.json + SHA256SUMS
```

4. Commit and push. The workflow validates the packages, publishes the immutable
   release assets (`bundle-<n>` and `module-<moduleId>-v<version>`) and refreshes
   `repository.json` on `main`. Press **Check** in the app to pick up the change.

Packages must stay flat (`module.json` + `index.js` at the ZIP root), under 15 MB
per module and 40 MB per bundle; the index must stay under 512 KB, and every
`packageUrl` path must match its signed `packagePath` exactly.

## Verification status

The Codex local kit report records 38 attempted checks: 34 passed, 0 failed, 4
blocked/unverified. The Hermes report records the separate Hermes artifact
checks. Provider availability and real app playback controls/audio verification
remain separate checks. Read [`modules/FranimeCodexBeta5/test-report.md`](modules/FranimeCodexBeta5/test-report.md)
and [`modules/FranimeHermesBeta3/test-report.md`](modules/FranimeHermesBeta3/test-report.md)
for the evidence and limitations. The published release assets are validated
against the SHA-256 digests in `repository.json`.

The latest beta fixes Flutter response-shape handling, resolves temporary media
redirects before returning a stream, and filters source seasons explicitly
marked **Live Action**. This makes One Piece begin at the real anime `S1E1`
(`sIdx=1`, `eIdx=0`) instead of listing the attached eight-episode live-action
season first. A provider can still be unavailable for a particular temporary
link; the module fails closed and does not substitute another episode or
language.

These are beta community-testing artifacts. Identity numbers 9002 and 9003 are
test-only compatibility identities, not official catalogue allocations. This
repository is not the official catalogue and does not claim maintainer approval.

The historical `modules/Franime/` beta.3 package remains retained but is no
longer advertised because it used development identity number `0`. The kit's
`examples/` folders are incomplete templates and are not published as modules.

Do not add credentials, cookies, signed media URLs, personal data, or remote
executable scripts.
