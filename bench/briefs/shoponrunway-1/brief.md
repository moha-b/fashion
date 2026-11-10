# Brief — Runway (shoponrunway.com)

## Product
Runway is a curated multi-brand fashion marketplace in Egypt. It sells contemporary clothing,
accessories and bags from **20** Egyptian and regional designers, confirmed by the user:
‘minē, ANA CAI, Beyond Reason, Common Culture, Elsewhere, GALIENTE, GENEA STUDIOS, Geyoub,
HANURA, Heris, Love Coara, Milusa, NOVAR, Rae, Scuffers, SELINA SELIM, Sixteen O Two, ST8MNT.,
STRUKTURE, Zabazar.
(An earlier draft of this brief said "~21" because NOVAR was accidentally listed twice. There is
no 21st designer. The count appears in the home page's central statement, so it must stay true.)
Men, Women and Kids. Prices in EGP, roughly 490–3,600 EGP. There is a companion mobile app.

Tagline: **"The show never ends."**

## Audience
Style-conscious Egyptian shoppers, mostly young adults, who want designer and emerging-brand
pieces they cannot find in mainstream retail. They come to discover brands as much as to buy
a known item.

## Market
Egypt. Arabic/English. Competes with regional multi-brand e-commerce and with each designer's
own Instagram storefront. The curation — being the place where these 20 brands sit together —
is the business's actual product.

## Tone
Aspirational but accessible. Editorial, not discount-driven. The name, the tagline and the
logo lockup all point at runway-show language that the current site does not deliver on.

## Platform and stack
- **Platform:** web (desktop + mobile). The native app is out of scope.
- **Stack:** Next.js + TypeScript + Tailwind (App Router).
- **Site type:** multi — e-commerce. **Home page is built and reviewed first**, then the user
  picks the next screen.
- Current site runs on a custom platform: media and content come from `api.runwayegypt.com`
  and `shoponrunway.com/media/...`, with `rw-`-prefixed CSS. Not Shopify, not a known JS
  framework in the served HTML (product grid renders client-side).

## What exists already
Live site at https://shoponrunway.com. Home page today, top to bottom:
1. Black announcement bar — "THE SHOW NEVER ENDS"
2. Thin header: Men / Women / Kids · logo · Designers & Brands / Sale / Runway App / EGP / bag
3. A thin `FW26 | COMING SOON` strip
4. Three-up category split: Women / Men / Kids, greyscale editorial photography
5. "Discover" — a flat 16-item product grid, 4 across, with a VIEW ALL button
6. A 12px brand-name ticker
7. Black app-promo box: "Runway, wherever you are."
8. Footer as two columns of black pill buttons
9. Oversized `r——w` logo lockup + "THE SHOW NEVER ENDS"
10. A persistent "PLAY / STUDIO 001" audio bar, bottom-left

## Why it needs a redesign — observed problems
1. **No hero, no entrance.** The page opens on a thin text strip and a category split. For a
   brand whose tagline is "the show never ends", there is no show — no statement, no editorial
   moment, nothing that says what Runway is to a first-time visitor.
2. **"Discover" is a search-results page, not curation.** 16 products at identical size, no
   hierarchy, no editorial framing, no reason-to-believe. The curation that justifies the
   business is invisible.
3. **Product imagery treatments clash.** On-model tan-backdrop shots, white-background ghost
   mannequin cutouts, flat-lay and an outdoor lifestyle shot all sit in one grid at one size.
   The grid reads as incoherent rather than curated.
4. **The 20 designers — the actual differentiator — are a 12px ticker** near the bottom, below
   the product grid, with 12px-tall tap targets.
5. **The footer is a stack of black pill buttons.** Reads as a utility menu, visually heavy,
   unbranded.
6. **The strongest brand moment (the big logo lockup) is the last thing on the page.**
7. **Mobile quality issues**, measured at 390x844: 121 instances of sub-12px text (11px vendor
   names on every product card, 11px announcement and season labels), 48 tap targets under
   24px (the brand ticker links are 12px tall). Page does not overflow horizontally.

## Primary user task
A first-time visitor understands within one screen that Runway is where Egypt's designer brands
live, and gets into a brand or category they care about. Secondary: a returning visitor reaches
new arrivals and sale quickly.

## Success criteria
- The home page states what Runway is above the fold, with an editorial brand moment.
- The 20 designers are a visible, navigable part of the page, not a ticker.
- The product grid is curated, with hierarchy, not a flat 16-up.
- Body and label text is >= 12px; interactive targets >= 24px (ideally 44px) on mobile.
- Clear route into Women / Men / Kids and into New In and Sale.
- Works at phone, tablet and desktop.

## Brand and media assets
Collected into `references/own-site/` (the user confirmed Runway owns these and may reuse them):
- `home.html` — served HTML of the home page
- `home-desktop.png`, `home-mobile.png` — full-page renders
- `images/` — **42 files**, listed with source URLs in `references/own-site/sources.md`:
  - Runway logo (PNG, 1440x569 master)
  - FW26 editorial photography for Women / Men / Kids (greyscale, 475x632 and up)
  - ~33 product images across the 11 brands shown on the home page
  - App Store / Google Play badges
  - 3 large editorial backgrounds from `api.runwayegypt.com/media/mobile-home/`
- Copy, nav structure, brand list, product titles and EGP prices captured in
  `references/own-site/_collected.json`.

**Only files under `references/own-site/` may be used as product assets.** Anything collected
later under `references/<other>/` is visual reference only and never ships.

## Constraints
- EGP pricing, and the existing AR/EN requirement means type and layout must tolerate Arabic
  (RTL) later, even if the redesign ships in English first.
- Keep the real brand and product names; this is a redesign, not a fictional store.

## Decisions settled in the interview
1. **Delivery target:** a standalone Next.js front end (App Router, TypeScript, Tailwind), with
   data shapes kept close to the real site. It is a design artifact and hand-off to the platform
   team, not an integration into the existing custom stack.
2. **Business goal: brand perception.** Make Runway look like the serious curated platform it
   claims to be. The home page therefore leads with an editorial brand moment and the designer
   roster, not with a conversion funnel. Conversion is a secondary benefit, not the brief.
3. **The "PLAY / STUDIO 001" audio bar is dropped.** Treated as legacy, not a brand feature.
4. **English-first.** Arabic/RTL is out of scope for this redesign, but type and layout must stay
   RTL-tolerant so it can be added later without a rebuild.
5. **FW26 stays a teaser** ("coming soon"), not presented as a live collection.

## Open questions
- None blocking. Asset and copy gaps, if any appear, are raised per ticket in phase 4.
