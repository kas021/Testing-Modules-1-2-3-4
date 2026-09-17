# Testing Modules 1 2 3 4

Public Synthetiq Player testing repository for user-installed modules.

## Install in the app

**Option A — add this repository** (installs the bundle now, then offers later versions on Check):

```text
https://raw.githubusercontent.com/kas021/Testing-Modules-1-2-3-4/main/repository.json
```

Settings → Media & Sources → add/import a **repository URL** and paste that line.
The app downloads `bundle-1`, installs every module inside it, and links the
repository so **Check** can offer later versions.

**Option B — import the module ZIP directly** (single module, no repository link):

<https://github.com/kas021/Testing-Modules-1-2-3-4/releases/download/module-franime-v1-v1.0.0-beta.3/FRAnime-1.0.0-beta.3.zip>

Download that file and import it under Settings → Media & Sources → the
module/package import action. Import the **ZIP itself** — not this repository
archive, not the extracted module folder, and not the bundle.

## Current module

| Module | Version | ZIP | SHA-256 |
| --- | --- | --- | --- |
| `franime-v1` — FRAnime, video, contract v4, Discovery V1 | `1.0.0-beta.3` | [`FRAnime-1.0.0-beta.3.zip`](modules/Franime/dist/FRAnime-1.0.0-beta.3.zip) | `738489e47def3ef89b932935071ec36d1c3eac1bb193a88e6db8cc54c3092ab0` |

Bundle `1`: [`Testing-Modules-1-2-3-4-Bundle-1.zip`](bundles/Testing-Modules-1-2-3-4-Bundle-1.zip)
— contains `modules/FRAnime-1.0.0-beta.3.zip`.

`repository.json` is the index the app reads: bundle and module entries with
their release URLs, SHA-256 digests and signature fields. `SHA256SUMS` records
the same digests for manual checking. Source folder:
[`modules/Franime/`](modules/Franime/).

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

The local kit report records 38 attempted checks: 34 passed, 0 failed, 4
blocked/unverified. The blocked checks are provider availability and real app
playback controls/audio verification; no Flutter/S2/device test was available.
Read [`modules/Franime/test-report.md`](modules/Franime/test-report.md) for the
full evidence and limitations. The published release assets were re-downloaded
anonymously and their SHA-256 digests match `repository.json`.

The package is a beta testing artifact. Its identity remains
`PENDING-OWNER-ALLOCATION` / `0`; this repository is not the official catalogue
and does not claim maintainer approval.

`FranimeHermes` was not copied because it is a duplicate implementation with the
same module id. The kit's `examples/` folders are incomplete templates and are
intentionally not published as importable modules.

Do not add credentials, cookies, signed media URLs, personal data, or remote
executable scripts.
