# GridIron Fantasy Football

A single-page fantasy football app. No build step. Host it on GitHub Pages.

## Files to upload (keep them in the same folder)
| File | Purpose |
|---|---|
| `index.html` | The app: UI, styles, screens |
| `engine.js` | Player data, scoring, draft rules, season sim, trades, QR codes. **Required.** |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |
| `tests/engine.test.js` | Unit tests (optional). Run `node tests/engine.test.js` |
| `README.md` | This file |

## Publish
1. Create a GitHub repo and upload the files above to the root.
2. Settings > Pages > Deploy from branch > `main` / root.
3. Open `https://YOURNAME.github.io/REPO/`.

## What is real vs sample
- **Sample data:** the 427-player pool, ADP, bye weeks, injuries, news blurbs and weekly scores are generated seed data in `engine.js`. Rosters may be out of date. Replace `RAW` in `engine.js` or feed `GI.PL`/`GI.P` from an NFL API.
- **Single browser:** leagues are saved in `localStorage` (`Svc` in `index.html`). Invite links and QR codes open the join screen, but another device cannot see your league until `Svc` is wired to a backend (Firebase, Supabase, etc.).
- **Notifications** are simulated in-browser (optional device notifications use the Notification API).
- Fonts load from Google Fonts. Offline, system fonts are used.
