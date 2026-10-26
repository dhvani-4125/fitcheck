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
