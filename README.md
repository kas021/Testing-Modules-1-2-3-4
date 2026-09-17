# Testing Modules 1 2 3 4

Public Synthetiq Player testing repository for user-installed modules.

## Current module

The repository currently contains the unique, canonical `FRAnime` video
module:

- Version: `1.0.0-beta.3`
- Module id: `franime-v1`
- Contract: v4 video module with Discovery V1 enabled
- Source folder: [`modules/Franime/`](modules/Franime/)
- Installable ZIP: [`FRAnime-1.0.0-beta.3.zip`](modules/Franime/dist/FRAnime-1.0.0-beta.3.zip)
- SHA-256: `738489e47def3ef89b932935071ec36d1c3eac1bb193a88e6db8cc54c3092ab0`

Direct raw download for Player import:

<https://raw.githubusercontent.com/kas021/Testing-Modules-1-2-3-4/main/modules/Franime/dist/FRAnime-1.0.0-beta.3.zip>

Download the ZIP and import that file in Synthetiq Player under Settings →
Media & Sources → the module/package import action. Import the ZIP itself,
not this repository archive and not the extracted module folder.

## Verification status

The local kit report records 38 attempted checks: 34 passed, 0 failed, and 4
blocked/unverified. The blocked checks are provider availability and real app
playback controls/audio verification; no Flutter/S2/device test was available.
Read [`modules/Franime/test-report.md`](modules/Franime/test-report.md) for the
full evidence and limitations.

The package is a beta testing artifact. Its identity remains
`PENDING-OWNER-ALLOCATION` / `0`; this repository is not the official catalogue
and does not claim maintainer approval.

`FranimeHermes` was not copied because it is a duplicate implementation with
the same module id. The kit's `examples/` folders are incomplete templates and
are intentionally not published as importable modules.

## Updating the repository

This checkout is the source of truth for the published testing copy. Future
module changes should be made under `modules/`, with `moduleVersion` bumped for
each shipped change. Rebuild the flat ZIP, update its `.sha256` file and factual
report, then commit and push the change to `origin`.

Do not add credentials, cookies, signed media URLs, personal data, or remote
executable scripts.
