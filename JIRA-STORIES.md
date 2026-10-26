# FitCheck Jira acceptance criteria

| Issue | Acceptance criteria | Verification |
|---|---|---|
| SCRUM-5 — Design FitCheck Dashboard | Dashboard displays wardrobe, saved-look, planned-day and favourite counts; weekly preview links to planner. | Check counts before and after adding an item, saving a look and planning a day. |
| SCRUM-6 — Add Clothing Items to Wardrobe | User can add a named clothing item with collection and optional image URL, search/filter it, delete it, and retain changes after refresh. | Add one item; search its name; filter its collection; delete it; refresh after another add. |
| SCRUM-7 — Create Outfit Combinations | User selects at least one wardrobe item, names the look, sets occasion/audience, saves it, and sees its constituent pieces. | Save a look with two or more pieces; verify its name, occasion and items in Saved Looks. Test empty name/selection validation. |
| SCRUM-8 — Filter Outfits by Occasion | Saved Looks filters saved combinations by occasion; The Event Edit also displays saved outfit combinations and filters them by event occasion using visible, clickable occasion chips. Matching handles case, spaces and common naming variants. Search and audience filters can be combined. | Select Wedding and verify only Wedding looks remain; select Formal and verify the results change; test Date Night/Festive/Graduation on The Event Edit; select All occasions and verify the event gallery resets. |
| SCRUM-9 — Save Favourite Outfits | User can toggle a look as favourite, browse favourites, and retain the state after refresh. | Heart an outfit, open Favourites, refresh, and verify it remains favourited. Toggle it off and verify it is removed from Favourites. |
