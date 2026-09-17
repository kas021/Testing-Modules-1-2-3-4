# FRAnime Codex — Synthetiq Player video module

Authorized source: [https://franime.fr/](https://franime.fr/) (the requester confirmed authorization on 2026-09-17).

The installable artifact is `dist/FRAnimeCodex-1.0.0-beta.5.zip`. It contains only the flat files `module.json` and `index.js`; the SHA-256 is in the adjacent `.sha256` file. This community test package uses identity `SP-VID-9002-FRANIME-CODEX-TEST` / number `9002`; it is not an official catalogue allocation.

`index.js` is self-contained and exports `searchResults`, `extractDetails`, `extractEpisodes`, `extractStreamUrl`, `discoveryHome`, and `discoveryFeed` through `globalThis`. It uses only `fetchv2`, local string/URL parsing, bounded requests, and byte/signature checks; it has no Node, DOM, browser timer, or remote-script dependency.

The module uses FRAnime's own sitemap for the broad title index and its own top/calendar JSON routes for active identities and discovery. Details and episodes use the first-party anime APIs. Episode hrefs carry the exact anime ID, zero-based season index, zero-based episode index, displayed season, and source episode number. The requested `sub`/`vo` or `dub`/`vf` language is never substituted.

For a player URL, the module decodes the site's observed `watch2` wrapper, follows at most two provider hops, resolves media redirects with bounded `GET` range requests and `followRedirects:false`, preserves the required `Referer`/`User-Agent`, accepts the response shapes used by the Flutter bridge, rejects HTML/image/empty payloads, and parses an HLS master ladder when one is actually present. Source seasons explicitly marked `Live Action` are omitted from the anime episode list, while the original FRAnime indices for the remaining seasons stay in each episode href. No signed media URL or credential is stored in this folder or report.

See [test-report.md](test-report.md) for live route observations, test counts, evidence layers, provider limitations, and the checks that still require the target Player build, S2 harness, or a physical device.
