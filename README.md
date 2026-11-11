# FitCheck — Personal Wardrobe & Outfit Planner

FitCheck is a React + Vite web app prototype for a fashion wardrobe and outfit planner. It is designed to demonstrate a small, testable product increment for an Agile lab project.

## Run locally

```bash
npm install
npm run test:filters
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). A network connection is needed for the remote sample photographs and Google Fonts. User data is saved in the current browser's `localStorage`; it does not sync between devices.

## Jira stories implemented

### SCRUM-5 — Design FitCheck Dashboard
- Dashboard shows wardrobe items, saved outfits, planned days and favourite outfits.
- Weekly view previews planned outfits and provides links to the planner and styling flows.

### SCRUM-6 — Add Clothing Items to Wardrobe
- Add a clothing item with name, collection, audience, colour, brand/inspiration and optional image URL.
- Browse/search/filter pieces and delete wardrobe items.
- Data persists after a refresh.

### SCRUM-7 — Create Outfit Combinations
- Select multiple items from the wardrobe.
- Name a look and assign an occasion/audience.
- Save the look and view the combined pieces in Saved Looks.

### SCRUM-8 — Filter Outfits by Occasion
- Saved Looks filters the actual saved outfit combinations by occasion (Everyday, Work, Athleisure, Date Night, Party, Wedding, Formal, Festive, Graduation, Travel).
- Both Saved Looks and The Event Edit display visible occasion chips. Clicking a chip immediately filters saved outfit combinations (not wardrobe items).
- The Event Edit's All occasions option shows only event-appropriate outfits; selecting Wedding, Formal, Date Night, Party, Festive, or Graduation shows only outfits tagged with that occasion.
- Matching normalises case, spaces, punctuation and common labels such as 'black tie' → Formal. Occasion filters can be combined with audience and search.
- Includes example event looks for Wedding, Formal, Date Night, Party, Festive, and Graduation so every event filter has sample results.
- Legacy `fitcheck-v2-looks` data is migrated into `fitcheck-v3-looks`, filling missing occasion metadata from known demo records; this avoids reusing a stale saved-look schema.

### SCRUM-9 — Save Favourite Outfits
- Toggle the heart on any saved outfit.
- Favourite state persists after refresh.
- Use the Favourites tab and dashboard count to find favourites.

## Manual smoke test

1. Open **My Wardrobe** and add a named piece.
2. Confirm the piece appears and can be searched/filtered.
3. Click the plus button on a piece to select it for an outfit, or open **Build outfit**.
4. Name the outfit, choose an occasion, select at least one piece, and save it.
5. Open **Saved Looks**, click a specific occasion chip, and confirm only matching outfits appear. Test at least two different occasions.
6. Open **The Event Edit**, click Wedding, Formal, Date Night, Party, Festive or Graduation, and confirm the gallery updates to only outfits tagged with that occasion. Click All occasions to show the event-appropriate looks again.
7. Click the heart and switch to **Favourites**; confirm the look appears there.
8. Refresh the page and confirm the outfit and favourite status remain.
9. Assign the look to a day in **Weekly Planner**, refresh, and confirm the plan remains.

## Automated occasion-filter checks

Run `npm run test:filters`. This executes ten Node.js assertions covering specific-occasion matching, normalisation, event-only mode, audience filtering, and search interaction.

## Notes

- This is a front-end MVP using local browser storage. It has no account system, server database, or cross-device sync.
- Seed items and sample saved looks are provided so the core features can be demonstrated immediately.
- Sample remote images are used for demonstration; replace them with images you have permission to use for any public deployment.

## AI styling features

All AI runs in the browser. No API key is needed, and wardrobe photos never leave the device.

| Area | Where | What it does |
|---|---|---|
| Digital wardrobe | **Upload** | Pick several photos from your gallery or drag them in. Each photo is split into garments (backdrop detection, then connected components, then XY-cuts for pieces that touch), cropped, and given colours (k-means), a pattern guess, a category guess and a perceptual hash for duplicate detection. You review and correct everything before saving. Photos are stored in IndexedDB. |
| Edit / recategorise | **Wardrobe → Edit** | Change category, type, colours, pattern, fit, formality, warmth, occasions, price and wear count, or replace the photo. |
| AI stylist | **✦ AI Stylist** | Type a request in your own words, or pick occasion, aesthetic and mood chips. You get five complete outfits from your own pieces, scored on occasion fit, colour harmony, style coherence, silhouette balance, pattern mixing, weather and learned preferences, each with an explanation. You can swap one piece, make the look more formal or casual, or change the colours. Also: Surprise me, match an inspiration photo, save, plan for a day, and mark as worn. |
| Weather | Stylist sidebar | Uses Open-Meteo (free, no key). Works from your location (with permission) or a city search. Covers 7 days: feels-like temperature, rain chance, humidity and wind. |
| Fragrance & hair | Each outfit, **Profile** | Fragrance families and your own bottles are scored on occasion, weather, mood, intensity and disliked notes. Hairstyles are scored on neckline, formality, humidity, wind, hair length and texture. |
| Learning | **Profile** | Likes, dislikes, ratings and worn outfits shift future suggestions: colours, aesthetics, fits, disliked combinations, fragrance families and hairstyles. |
| Insights | **Insights** | Category and colour breakdowns, most versatile pieces, most and least worn, cost per wear, gap analysis (which missing pieces unlock the most outfits) and outfit history. |

```bash
npm test
```

## Deploying (free)

FitCheck is a static site: no server, database or paid API. On first visit, users are asked their gender and which clothes to style, then they upload their own wardrobe. Nothing is pre-loaded. Each user's profile, wardrobe and photos stay in their own browser (localStorage + IndexedDB).

| Service | Used for | Cost / key |
|---|---|---|
| [Open-Meteo forecast](https://open-meteo.com/) | Weather for outfit suggestions | Free, no key, no sign-up (non-commercial use) |
| [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) | City search | Free, no key |
| Google Fonts | DM Sans + Playfair Display | Free |

Garment detection, colours, outfit matching, fragrance and hair suggestions all run in the browser.

Pick any one host. Each config runs the tests before building:

- **GitHub Pages:** in the repo's Settings → Pages, set Source to *GitHub Actions*. Then every push to `main` runs `.github/workflows/deploy-pages.yml`.
- **Netlify:** import the repo, and `netlify.toml` handles the rest.
- **Vercel:** import the repo, and `vercel.json` handles the rest.
- **Docker:** `docker build -t fitcheck . && docker run -p 8080:80 fitcheck` (nginx). The existing workflow also publishes this image to GHCR.

Location (for weather) only works over HTTPS, which all of the hosts above provide.

## Accounts & sync (free, optional)

Without setup, FitCheck saves everything in the browser. To let people sign in and sync their profile, wardrobe, looks, plans and photos across devices, connect a free [Supabase](https://supabase.com) project:

1. Create a free project at supabase.com.
2. **SQL Editor → New query**: paste [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the `wardrobes` table, a private `garments` photo bucket, and row-level security so each user can only reach their own data.
3. **Authentication → URL Configuration**: set *Site URL* to your deployed address (e.g. `https://dhvani-4125.github.io/fitcheck/`), and add `http://localhost:5173` under *Redirect URLs*.
4. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
5. For GitHub Pages, go to the repo's **Settings → Secrets and variables → Actions → Variables** and add `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then re-run the deploy. For local development, copy `.env.example` to `.env.local` and fill in the values.

The anon key is designed to be public. Data is protected by the row-level-security policies. Sync merges devices (the newest edit wins, and deletions are respected), and photos upload in the background. The free tier includes 50,000 monthly users, 500 MB of database and 1 GB of photo storage.
