# Re-Template

**Your AI-built site looks like every other AI-built site. Re-Template makes it look like a real company shipped it.**

Every vibe-coded landing page arrives wearing the same uniform: an indigo→purple gradient hero, Inter, three feature cards with rounded icons, a `Get Started` button that links to nothing. Detectors will happily tell you your site scores 87/100 on slop. Great. Now what?

Re-Template is the part nobody built yet: it doesn't just *detect* the AI look and it doesn't just *strip* it back to bland. It **reskins your site to a real, opinionated design language** — so it reads like Material, Primer, or Polaris built it, not a language model averaging its training data.

```bash
# score the slop
npx re-template score ./site

# reskin it
npx re-template apply --pack primer ./site

# see the receipts
npx re-template diff ./site   # before / after, side by side
```

> [!NOTE]
> Re-Template is early and moves fast. Star it, break it, and send brand packs.

---

## Why this exists

AI coding tools don't have taste — they have an **average**. Feed a model "build me a landing page" and it returns the median of every Tailwind starter in its training data: `bg-indigo-500`, `from-indigo-500 to-purple-600`, Inter, hero → 3 cards → testimonials → pricing → footer. It's become as instantly datable as a 2015 WordPress theme.

The market's answer so far has been **subtractive**:

- **Detectors** score your slop and leave. (pols.dev, Go Digital Apps)
- **Strippers** remove the tells and leave you with blander slop. (kill-ai-slop)
- **Preventers** stop the agent making slop in the first place. (Taste Skill)
- **Extractors** pull raw design tokens out of a site and wish you luck. (Dembrandt, Specify)

Nobody does the **additive** move: *pick a real design language and make my site actually look like that.* That's Re-Template.

## How it works

1. **Detect** — parse the rendered DOM + computed styles and fingerprint the slop signature (default fonts, indigo/purple gradients, canned layout rhythm, glow-on-dark, emoji headings). You get an itemized report and a 0–100 score.
2. **Map** — translate your existing elements onto a target **brand pack**: a structured set of design tokens (type scale, color roles, spacing, radii, shadows, motion, layout rules).
3. **Apply** — rewrite the CSS/tokens so the site inherits the target's *system*, not its logo. Output as a diff, a new stylesheet, or a PR.
4. **Prove** — before/after render so you can see (and post) the transformation.

## Brand packs

A brand pack is just tokens + rules. Launch packs are built on **genuinely open-source design systems** — so this is legally clean and you get a real, documented system to map onto:

| Pack | Based on | License |
|------|----------|---------|
| `material` | Google Material | Apache-2.0 |
| `primer` | GitHub Primer | MIT |
| `polaris` | Shopify Polaris | MIT |
| `carbon` | IBM Carbon | Apache-2.0 |
| `fluent` | Microsoft Fluent | MIT |

"Inspired-by" presets (e.g. a clean `linear`-style or `stripe`-style aesthetic) are clearly labeled as **presets inspired by public design conventions** — token choices only. They never ship a company's logo, wordmark, proprietary icon artwork, or anything meant to pass your site off as theirs. See [Legal & scope](#legal--scope).

**Packs are the growth loop.** Every new pack is a reason for someone to share the project, and a one-file PR anyone can contribute. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the pack format.

## Install

Ships two ways, because the whole audience lives in one of them:

```bash
# CLI
npx re-template <command>

# Agent skill (Claude Code, Cursor, etc.) — reskin from inside your editor
# (coming with v0.1 — see docs/)
```

## Legal & scope

Short version, from real case law (details and sources in [docs/RESEARCH.md](./docs/RESEARCH.md)):

- **You generally can't copyright a UI's "look and feel" or its layout/method-of-operation.** *Lotus v. Borland* held a menu hierarchy is an uncopyrightable method of operation; *Google v. Oracle* held reimplementing an interface can be fair use. Reproducing a **design system** — a type scale, spacing rhythm, color roles, generic layout — sits in this open space.
- **What IS protected:** the specific *expressive* content inside the interface — logos, wordmarks, original icon artwork, photography, and the literal source code. Re-Template packs never ship those.
- **The real constraint is trade dress, not copyright.** Under the Lanham Act, a distinctive site "look and feel" can be protected if it has *secondary meaning* and is *nonfunctional* — and imitating it to the point a consumer thinks your site *is* that company is the line. Re-Template is a de-slopping tool, **not an impersonation tool**: it applies design *systems*, and refuses output that reads as a specific company's identity.

If a pack ever crosses from "system" into "identity," that's a bug — open an issue.

## Status

`v0` — scaffolding and research. Roadmap, pack format, and the detection ruleset are being built in the open. Contributions and brand packs welcome now.

## License

[MIT](./LICENSE)
