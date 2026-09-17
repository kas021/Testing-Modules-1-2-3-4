# FRAnime Hermes — Synthetiq Player video module

Authorized source: [https://franime.fr/](https://franime.fr/) (the requester confirmed authorization on 2026-09-17).

This is the Hermes implementation kept for side-by-side testing with the
FRAnime Codex variant. Its distinct module id is `franime-hermes-v1`; its
community test identity is `SP-VID-9003-FRANIME-HERMES-TEST` / number `9003`.
Those are not official catalogue allocations.

The installable artifact is `dist/FRAnimeHermes-1.0.0-beta.3.zip`. It contains
only the flat files `module.json` and `index.js`; the SHA-256 is in the adjacent
`.sha256` file. The source exports the required video handlers and Discovery V1
handlers through `globalThis` and uses the module runtime's `fetchv2` API.

The repair accepts parsed JSON and string-valued Flutter response bodies,
resolves temporary provider redirects before returning the stream, and omits
source seasons explicitly labeled `Live Action`. Thus One Piece starts at the
real anime `S1E1` while preserving FRAnime's original season/episode indices.

See [test-report.md](test-report.md) for the Hermes artifact evidence, source
observations, provider limitations, and checks that still require the target
Player build, S2 harness, or a physical device.
