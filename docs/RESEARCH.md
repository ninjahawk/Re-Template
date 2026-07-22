# Re-Template — Market & Legal Research

This is the research the project is built on. It's kept in-repo because the positioning
depends on it, and because "is this even legal?" is the first question every contributor asks.

## 1. The problem is real and it has a name

AI-generated / "vibe-coded" web design has converged on one recognizable look. The tells:

- Indigo→purple gradient hero, centered oversized sans headline, a `Get Started` button
  that links nowhere.
- **Inter** — the default font in nearly every AI tool, component library, and site builder.
- Tailwind defaults: `bg-indigo-500`, `text-indigo-600`, `from-indigo-500 to-purple-600`.
- Fixed layout rhythm: hero → 3 feature cards with icons → testimonials → pricing → footer.
- Glow-on-dark backgrounds, "eyebrow" labels with a leading dot, bento grids of random accents,
  emoji headings, heavy rounded corners.
- Suspiciously polished landing page for an alpha-stage product; stock-y AI imagery.

Why it happens: the model isn't designing, it's **averaging** its training data, which is
saturated with Tailwind starter templates. Without a design system to constrain it, it returns
the median landing page.

Sources:
- [Why Every AI-Built Website Looks the Same (Blame Tailwind's Indigo-500) — dev.to](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p)
- [Design Systems for AI Coding: Stop Getting Purple Gradients — braingrid.ai](https://www.braingrid.ai/blog/design-system-optimized-for-ai-coding)
- [AI Slop Web Design: Complete Guide (2026) — 925studios](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [AI design slop: the tells — solodesign.cc](https://solodesign.cc/blog/ai-design-slop-the-tells/)

## 2. Competitive landscape

The space is real but **subtractive** — everyone removes the AI look; nobody replaces it with a
real one.

| Bucket | What it does | Examples |
|--------|--------------|----------|
| Detectors | URL → 0–100 slop score + tells | [pols.dev/slop](https://pols.dev/slop), [Go Digital Apps](https://godigitalapps.com/tools/slop-detector) |
| Preventers | Stop the agent making slop up front | [Taste Skill](https://www.tasteskill.dev/) |
| Strippers | Scan a project and remove the tells | [kill-ai-slop](https://github.com/yetone/kill-ai-slop) |
| Text de-sloppers | Rewrite prose to sound less AI | [deslop CLI](https://github.com/ai-that-works/deslop), [EQ-Bench Slop Score](https://eqbench.com/slop-score.html) |
| Token extractors | Pull tokens *out of* a real site | [Dembrandt](https://dev.to/thevangelist/i-built-dembrandt-extract-any-websites-design-system-in-seconds-open-source-2n6d), [Specify](https://specifyapp.com/) |

**The gap:** additive, opinionated transformation toward a *named real design language*. Detectors
score and leave; strippers make you blander; extractors hand you raw tokens. Re-Template is the
only one that says "make it look like a real team's system built it," with before/after proof.

## 3. Viral mechanics (why an OSS project can win here)

- The premise is an existing meme ("every AI site looks the same") — Re-Template is the punchline's answer.
- Before/after renders are inherently screenshotable → free distribution.
- Brand packs are a growth loop: each pack is a share-reason and a one-file community PR.
- One-command install (CLI + agent skill) matches how the winners in this niche get adopted.
- An optional public slop-score leaderboard gives a return-visit hook.

## 4. Legal: can you "copyright a UI"? Mostly no — with nuance

The user's instinct is broadly correct: **you can't copyright the look-and-feel / functional
structure of a UI; you can only protect the specific expressive IP inside it.** The nuance is
that a *second* body of law — trade dress — is the real constraint, not copyright.

### 4a. Copyright does NOT protect UI structure / "methods of operation"

- **Lotus Development Corp. v. Borland Int'l, Inc.** (1st Cir. 1995): a menu command hierarchy is a
  **"method of operation"** and is excluded from copyright under **17 U.S.C. § 102(b)**. The mechanics
  of *how* an interface is operated aren't copyrightable.
  [Wikipedia](https://en.wikipedia.org/wiki/Lotus_Dev._Corp._v._Borland_Int%27l,_Inc.)
- **Google LLC v. Oracle America, Inc.** (U.S. Supreme Court, 2021): Google's copying of Java API
  declaring code — characterized as **"reimplementation of a user interface"** — was **fair use**. Gives
  strong legal cover to re-using and re-implementing interfaces.
  [Congress.gov CRS](https://www.congress.gov/crs-product/LSB10597) ·
  [EFF](https://www.eff.org/deeplinks/2021/04/victory-fair-use-supreme-court-reverses-federal-circuit-oracle-v-google)
- **Apple Computer, Inc. v. Microsoft Corp.** (9th Cir. 1994): courts dissect a GUI into elements,
  discard the unprotectable/licensed ones, and give whatever expressive remainder survives only
  **"thin"** protection.
  [Justia](https://law.justia.com/cases/federal/appellate-courts/F3/35/1435/605245/)

### 4b. Copyright DOES protect the expressive *content* inside the interface

The individual creative works embedded in a UI remain protected: **logos, wordmarks, original icon
artwork, photography/illustration, and the literal source code**. This is the "IP within the interface."
A design *system* — type scale, spacing units, color roles, radii, generic layout — is not that.

### 4c. The real constraint: trade dress (Lanham Act)

Copyright doesn't protect a site's overall "look and feel," but **trade dress** (trademark law) can.
To win a website trade-dress claim, a plaintiff must show the look is:

1. **Distinctive** — and because website trade dress can't be *inherently* distinctive, it requires
   proven **secondary meaning** (consumers associate that exact look with one source);
2. **Nonfunctional**; and
3. Likely to cause **consumer confusion** as to source.

Imitating a site closely enough that a consumer thinks yours *is* that company is where liability lives.

Sources:
- [Trade Dress Protection of a Website — Revision Legal](https://revisionlegal.com/trademark/trademark-law/trade-dress-protection-of-a-website/)
- [Trade Dress Protection for Websites & Digital Products — Turley Law](https://turleylaw.com/blog/trade-dress-protection-websites-digital-products)
- [Trade Dress Under the Law — Justia](https://www.justia.com/intellectual-property/trademarks/trade-dress/)

### 4d. What this means for Re-Template

**Safe:**
- Reproducing design *systems* — type scales, spacing, color roles, radii, shadows, generic layout.
- Building packs on the **open-source** design systems that ship under Apache-2.0 / MIT (Material,
  Primer, Polaris, Carbon, Fluent). Follow each system's license and attribution terms.
- "Inspired-by" presets that capture a *convention* (clean, high-contrast, restrained motion) as tokens.

**Not safe / out of scope:**
- Shipping a company's **logo, wordmark, or proprietary icon artwork**.
- Copying **literal proprietary source code**.
- Producing output whose purpose or effect is to make a site **pass as** a specific brand
  (that's the trade-dress / passing-off line, and it's explicitly not what this tool is for).

Bottom line: apply *systems*, never *identities*. Prefer packs with an actual open-source license.
None of this is legal advice — it's the design constraint the project is engineered around.
