# Franime video module — test report

Module ID/name/version: `franime-hermes-v1` / FRAnime Hermes / `1.0.0-beta.2` (contractVersion 4, contentType video)
ZIP: `Testing-Modules-1-2-3-4/modules/FranimeHermes/dist/FRAnimeHermes-1.0.0-beta.2.zip`
ZIP SHA-256: `1eed477e39dff1f66db2f0576ab8363092b0f5fd17370d61177249e5a5df3066`
ZIP contents (re-opened and inspected): flat, exactly `module.json` + `index.js`; extracted `index.js` is byte-identical to the Hermes source folder; recorded `.sha256` matches the recomputed hash.
App version/device/OS: installed local Player build `8.5.73+135`; no S2 tester or device playback was available — see the verdict.
Source permission and source URL: `https://franime.fr/` — permission confirmed by the user on 2026-09-17 (recorded in `PROJECT_GOAL_AND_SCOPE.md`).
Test date/time and network type: 2026-09-17, ≈16:30–17:20 local (UTC+1), home broadband, Node 24.13.1 through the kit's own local runtime and bounded media sampler.

## What was verified against the live source (recon, no assumptions)

| Layer | Route | Observed |
| --- | --- | --- |
| Title index | `franime.fr/sitemap_animes.txt` | 371 KB, 4637 lines, 2505 distinct `anime_id`s with slugs |
| Catalogue | `api.franime.fr/api/animes` | 10.9 MB, 2508 titles; **any query string on this route is rejected with Cloudflare 403** (verified with `?zzz=1`) — there is no server-side search |
| Details / episodes | `api.franime.fr/api/anime-by-id/<id>` | title, original title, description, affiche/banner, note, themes, format, status, `saisons[].episodes[].lang.{vo,vf}.lecteurs` |
| Episode titles | `api.franime.fr/api/anime-seasons/<id>/<season>` | per-episode titles (best effort, matched by number) |
| Player resolution | `api.franime.fr/api/anime/<id>/<sIdx>/<eIdx>/<vo\|vf>/<lecteurIdx>` | returns either an obfuscated `franime.fr/watch2/?a=..&o=..` URL or a plain provider URL |
| Obfuscation | watch2 params | `base64 → hex → XOR k` with a **per-request key**; the module brute-forces the 256 keys and keeps the value that parses as a URL (14/14 decoding attempts produced a plausible provider URL) |
| Providers seen | sibnet, vidmoly, filemoon-family, sendvid, gofile (download) | sibnet → `/v/<hash>/<id>.mp4`; vidmoly → signed `master.m3u8` ladder |
| Discovery | `/api/discord/voted/render-top-15-of-bestanimes`, `/api/calendrier_data` | 15 full cards; 45 KB calendar with season/episode/air slot |

## Coverage

Full matrix run against build A (identical resolution code, kitsu-only search): **48 attempted / 44 passed / 4 failed**, all four failures diagnosed and explained, none of them a stream, identity or parsing defect:

| Exact title | Season/episode | Audio | Result | Evidence layer | Failure reason |
| --- | --- | --- | --- | --- | --- |
| Boruto (13051) | S1E1, E146, E293 | sub & dub | PASS | local harness + 206 `video/mp4` `ftypisom` + HLS `mpeg-ts` | — |
| Naruto (11), Naruto Shippuden (1555) | S1E1 | sub/dub | PASS | local | — |
| Boku no Hero movie (14084) | film | sub | PASS | local, 3 routes | — |
| Steins;Gate film, Shaman King S2, Re:Zero, Slime | S1E1 | sub | PASS (first run) / BLOCKED (final run) | local | sibnet IP block, see below |
| World Trigger (8631) | S3E1 | dub | PASS (expected error) | local | source has **0 VF episodes** in all three seasons — module errors explicitly instead of substituting VO |
| Hitman Reborn (1444) | S1E1 | dub | PASS (expected error) | local | no VF in source; message states the other track is available |
| Garo: Uzusumizakura (41357) | S1E1 | sub | PASS (source gap) | local | source lists the sentinel player `INDISPONIBLE`; module answers "the source marks this episode as unavailable" |
| 10 seeded-random titles (seed 20260917) | S1E1 | sub | 9/10 PASS, 1 source gap | local | Garo above |
| Search: exact/romaji/unknown/empty | — | — | PASS | local | no fabricated matches on nonsense input |

Build C (final artifact) targeted verification: **9/10** — Madoka, Sakamoto, Kami wa Game ni Ueteiru (all previously failing), Boruto, One Piece, sections `top-franime`, `top-franime-10`, `calendrier`, feed page 1/2 (no duplicates, no page-2 overlap, `hasMore:false`).

Official kit checker (`node tools/run_checks.cjs`): search → details → discovery (sections + feed page 1) → episode list → episode identity → stream candidates **all PASS**, with 2/2 sampled routes verified (`iso-media signature`, `HLS → mpeg-ts signature`) on build B (16:52) — same resolution code as build C.

## Blocked / unverified (recorded honestly)

- **sibnet blocked this test machine's IP** partway through the session (`403 Forbidden — Request forbidden by administrative rules` on both the shell page and a media URL that had returned 206 earlier). Every lecteur the API currently serves for those titles decodes to a sibnet URL, so the last matrix run recorded **19 BLOCKED stream cases**. vidmoly stayed reachable throughout (200 + signed m3u8), which is why the failures are attributed to the provider, not to the module. Resolution is per play and never cached; nothing is returned unless it has already been probed successfully, so the module fails closed instead of handing the player a 403.
- A local probe of `mushoku tensei` reported `fetch failed` once in a run made by a second, concurrent writer of the module folder — not reproduced with this code.
- **Not run at all:** S2 native playback/seek/pause, physical-device playback, audio-language confirmation, subtitle rendering, download and offline playback, quality switch inside the app. The local harness proves structure and HTTP behaviour only.
- Subtitles: the source API exposes no subtitle tracks to a module (`lecteurs` are players only) — the module returns no subtitle list rather than inventing one.
- Qualities: parsed from the HLS master ladder when the provider is vidmoly-style (`720p`, `Auto`); sibnet MP4 is a single rendition and is reported as such (no invented labels).
- NSFW flags pass through on details (`nsfw: true`) but no client-side filter is applied (the site uses an account setting the module cannot read).

## Build lineage and folder layout

- `Franime/` — canonical folder: `module.json`, `index.js`, this report, `dist/FRAnime-1.0.0-beta.2.zip` (+ `.sha256`), plus two preserved revisions of a second writer's unreviewed implementation (`.alt-implementation-1649.js.bak`, `.alt-implementation-1659.js.bak`; that build failed the kit checker with `FAIL route 1: HTTP 404` on the stream stage and is not shipped).
- `FranimeHermes/` — the second bot's implementation, kept as a separate source and package for side-by-side testing. Its source is not byte-identical to the Codex implementation.
- Final re-check of the canonical folder (17:05): search, details, discovery (sections + feed page 1), episode list and episode identity all PASS; the stream stage reports `no playable route could be verified` because sibnet still refuses this test IP (see the blocked section). The identical check on the same resolution code passed at 16:52 with 2/2 routes sampled.

## Final verdict

Local checks: **PASS** (search, details, episodes, discovery, packaging; stream resolution verified live for 12 titles before the provider IP block, and blocked — not failed — afterwards)
S2 (video, maintainer tools): **NOT RUN**
Physical-device playback or reader test: **NOT RUN**
Download/offline: **NOT RUN**

Known limitations:
1. Search runs against the site's sitemap plus the Kitsu index and verifies every hit through `/anime-by-id`; franime-only identities are matched by their romanized slug, so a Japanese-title-only query can miss a title (example: the ORESUKI film, id 76798236390).
2. VF (French dub) exists only on part of the catalogue; the module reports the absence instead of substituting VOSTFR.
3. Episodes the source marks `INDISPONIBLE` cannot be played by anyone.
4. The published Hermes test manifest uses `SP-VID-9003-FRANIME-HERMES-TEST` / number `9003` so it can coexist with Codex. This is not an official catalogue allocation.
5. The watch2 key is brute-forced per request because the site's own decoder is a packed `Function()` script; if the site changes the transform the module fails closed with a clear error rather than returning a wrong URL.

Repository publication: authorized by the requester on 2026-09-17 to the public user-owned testing repository. Official catalogue approval and physical Player playback remain pending.
