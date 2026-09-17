# FRAnime video module — factual test report

Module ID/name/version: `franime-v1` / FRAnime Codex / `1.0.0-beta.5`
Contract: v4, video, Discovery V1 enabled  
Source permission: requester confirmed authorization for [https://franime.fr/](https://franime.fr/) on 2026-09-17  
Target Player version: requester-provided playback report was from Player `9.0.0+144` on iOS 27.0; installed local binary `8.5.73+135`; no S2 harness was available
Test environment: Windows workspace, Node.js 24.13.1, kit local runtime, Chrome visual check, 2026-09-17; home broadband

## Research evidence

| Area | First-party route or observation | Result |
| --- | --- | --- |
| Broad title index | `https://franime.fr/sitemap_animes.txt` | 371 KB, 4,637 lines, about 2,505 distinct IDs with slugs; cached for the module session |
| Catalogue | `https://api.franime.fr/api/animes` | 2,508 records, about 10.9 MB; over the kit's 5 MiB response cap, so the module does not use it |
| Details and source episode data | `/api/anime-by-id/<id>` | `{ id, titleO, title, titles, description, note, themes, format, startDate, endDate, status, nsfw, affiche, banner, saisons[] }`; each season contains episodes and `lang.vo/vf.lecteurs` |
| Episode title metadata | `/api/anime-seasons/<id>/<season>` | `{ kitsuId, episodes[] }`; used best-effort for titles, while identity remains the source season/episode array index; source One Piece also attaches an 8-episode `Live Action 0.5` season |
| Player route | `/api/anime/<id>/<sIdx>/<eIdx>/<vo\|vf>/<lecteurIdx>` | Plain provider URL or an obfuscated first-party `watch2` URL; exact zero-based indices are preserved |
| Wrapper decoding | `watch2` query parameters | Observed transform is base64 → hex → one-byte XOR; the module tries the bounded 256-key space and accepts only a URL-shaped result |
| Discovery | `/api/discord/voted/render-top-15-of-bestanimes`, `/api/calendrier_data` | Used for top and calendar sections; calendar pagination is de-duplicated across pages |
| Providers | Sibnet, Vidmoly-style, Filemoon-family, Uqload, Sendvid | Provider adapters allow only observed hosts, reject unsupported downloads, and inspect actual media bytes before returning a route |

The source has no server-side search route that fits the local cap. Query strings on the large catalogue route were not used. Search matches the first-party sitemap and supplements it with first-party top/calendar records, then verifies every returned identity through the first-party detail route. No Kitsu ID is used as a FRAnime identity.

## Historical beta4 coverage

The counts below are named checks, not inflated per-assertion pass rates. A `BLOCKED` check is not silently counted as a pass.

| Check group | Attempted | Passed | Failed | Blocked | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Kit offline suite | 17 | 17 | 0 | 0 | `node --test tests/kit.test.cjs` |
| Syntax, manifest, and source-policy scan | 3 | 3 | 0 | 0 | `node --check`; manifest JSON/version; no executable Node/DOM/browser-only dependency markers |
| Search matrix | 5 | 5 | 0 | 0 | `one piece`, `parasyte`, `naruto`, nonsense query, empty query |
| Exact identity and language guards | 3 | 3 | 0 | 0 | One Piece season/episode indices, missing-Dub response, missing-index response |
| Discovery home and pagination | 5 | 5 | 0 | 0 | home, top pages 1–2, calendar pages 1–2; no page duplicates or cross-page duplicates |
| Package and ZIP reopen | 1 | 1 | 0 | 0 | flat entries, manifest version, source/ZIP byte identity, recorded digest |
| Final live checker scenarios | 3 | 0 | 0 | 3 | One Piece sub E1, One Piece dub E1, Kiseijuu sub E12; all non-stream identity checks passed, stream resolution stopped at provider access |
| Browser player visual/control check | 1 | 0 | 0 | 1 | Existing Chrome page displayed a real One Piece frame and burned-in French text; reliable play/audio/control verification was not completed |
| **Total** | **38** | **34** | **0** | **4** | — |

### Historical final live checker detail

| Scenario | Non-stream result | Stream-stage result |
| --- | --- | --- |
| Search `one piece`, result 1, position 1, `sub` | Selected exact `One Piece`, season `0.5`, episode `1`; search, details, discovery, list, and identity checks passed | Blocked: source listed one player, but its Sibnet route could not be verified |
| Search `one piece`, result 1, position 9, `dub` | Selected exact `One Piece`, season `1`, episode `1`; preceding checks passed | Blocked: source listed five players, but all final attempts were unavailable to the test machine |
| Search `parasyte`, result 1, position 12, `sub` | Selected exact `Kiseijuu: Sei no Kakuritsu`, season `1`, episode `12`; preceding checks passed | Blocked: source listed six players, but all final attempts were unavailable to the test machine |

The three historical `tools/run_checks.cjs` commands exited nonzero at the stream stage because the beta4 module correctly failed closed with `no playable route could be verified`; that is recorded above as provider-blocked, not changed into a pass. Independent final requests to the provider shell returned HTTP 403 with `Request forbidden by administrative rules`. Earlier in the same research session, a known Sibnet tier-1 media path returned a 302 and the sampler observed valid MP4 bytes; this confirms the redirect case that beta5 now handles, but it is not a playback pass because the old run did not establish app decoding.

The earlier Vidmoly research path exposed a signed HLS master and a sampled MPEG-TS child. The module parses real HLS master variants when reachable, but signed URLs are intentionally absent from this report and are resolved only at play time.

## Beta5 repair verification

| Check | Attempted | Passed | Failed | Blocked | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| One Piece episode identity regression | 1 | 1 | 0 | 0 | `extractEpisodes(12)` returns 1,189 anime episodes; first item is real `S1E1`, `sIdx=1`, `eIdx=0`; no duplicate hrefs |
| Flutter response-shape and redirect regression | 1 | 1 | 0 | 0 | Simulated app bridge with parsed JSON values, string-valued text, and a 302 Sibnet route returned the final CDN URL with headers |
| Live One Piece `S1E1` sub | 1 | 1 | 0 | 0 | Kit checker selected season 1/episode 1 and sampled an MP4 container |
| Live One Piece `S1E1` dub | 1 | 1 | 0 | 0 | Kit checker sampled 2/2 returned MP4 routes |
| Live Naruto `S1E1` sub | 1 | 1 | 0 | 0 | Kit checker sampled 2/2 returned MP4 routes |
| Package and syntax checks | 2 | 2 | 0 | 0 | `node --check` plus packager output; final ZIP inspection is recorded below |

The requester’s attached beta4 Player report documented the failure this repair targets: the module probed an MP4 `206` response and an HLS `200` response but still returned `no playable route`. Beta5 now reads both response representations used by the Flutter bridge and resolves provider redirects before returning a stream. These checks prove stream extraction and sampled container bytes only; they do not prove advancing picture/audio in Player.

## Integrity and safety

- The module returns only exact source identity: no numeric slug guessing, episode fallback, or language substitution.
- Missing VF is returned as an explicit empty response with an explanation. One tested One Piece episode at position 703 had no VF and produced: `Franime has no VF (French dub) player for this exact episode; no other language was substituted.`
- The source exposes player names, not subtitle files. The module returns no selectable subtitle tracks. The Chrome visual check showed burned-in French text; burned-in text is not advertised as a selectable subtitle and cue timing was not certified.
- Stream URL and required headers remain together. Media checks use bounded range reads, reject HTML/image/empty payloads, and capture up to two redirects without assuming token expiry.
- No credentials, cookies, personal data, signed media URLs, or remote executable scripts are shipped in the module or report. After this report was prepared, the requester authorized publication of the beta ZIP to the public user-owned testing repository `https://github.com/kas021/Testing-Modules-1-2-3-4`; no official catalogue, app code, or production service was changed.

## Not run / remaining limitations

- No target Player app version was supplied. App import, current-runtime playback, and an older supported runtime were not available.
- S2 native playback, picture advancement, audio-language confirmation, subtitle rendering/cue timing, pause/resume, seek, foreground/background, quality/server switching inside the app, downloads, and completed airplane-mode playback were not run.
- The 20 fixed + 10 seeded release matrix was not rerun after the provider block. The final beta.3 live sample is three scenarios; the structural/search/discovery checks above do not prove full catalogue coverage or playback.
- Provider availability is external and may vary by network/IP. Sibnet was the concrete blocker in the final run. Filemoon-family, Uqload, and Sendvid were observed but not certified when they exposed only HTML/client-side wrappers or returned errors.
- Some FRAnime entries have no VF, and some source entries explicitly mark a player unavailable. The module preserves those gaps.
- The published Codex test manifest uses community identity `SP-VID-9002-FRANIME-CODEX-TEST` / number `9002` because Player `8.5.73+135` rejects V3+ package identity number `0`. This is not an official catalogue allocation.

## Repository import repair

The original repository bundle advertised the development identity number `0`.
The installed Player build exposes the validation rule `V3 module
moduleIdentityNumber must be a positive integer`, which explains the reported
`No repository modules were installed` error after the bundle downloaded.

This replacement package keeps the Codex implementation and module family, but
bumps the package to `1.0.0-beta.5` and uses the distinct positive community
test identity `9002`. The Hermes implementation is published separately as
`franime-hermes-v1` with test identity `9003`. Bundle 3 advertises both repair
packages. The live beta5 checks above passed for One Piece sub/dub and Naruto
sub at the time of testing; native Player playback remains unverified.

## Final handoff

Version: `1.0.0-beta.5`
ZIP: `Testing-Modules-1-2-3-4/modules/FranimeCodex/dist/FRAnimeCodex-1.0.0-beta.5.zip`
SHA-256: `8e9dbcdb653e26a8403c040355bc4a8b473d8319d172245b40c739e053d93913`
Attempted/passed/failed/blocked: **7 / 7 / 0 / 0** for the Codex-specific beta5 repair checks listed above; the historical beta4 baseline remains **38 / 34 / 0 / 4**. Target platforms actually tested: Windows Node.js 24.13.1 kit runtime and installed Player binary inspection; the requester supplied an iOS Player failure report, but beta5 native retry, S2, audio/subtitle, download and offline checks remain pending. Public user-owned testing-repository publication was authorized by the requester on 2026-09-17. Official catalogue publication remains out of scope.
