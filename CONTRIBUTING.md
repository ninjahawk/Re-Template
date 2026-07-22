# Contributing to Re-Template

The fastest, highest-leverage way to contribute is a **brand pack**. One good pack = one
new reason for people to share the project.

## The brand pack format

A pack is a single file of design tokens plus a few rules. It describes a *design system*,
never a company's identity. See [`packs/primer/pack.json`](./packs/primer/pack.json) for a
worked example.

```jsonc
{
  "id": "primer",
  "name": "Primer-style",
  "basedOn": "GitHub Primer",
  "license": "MIT",           // license of the source design system
  "kind": "open-source",       // "open-source" | "inspired-by"
  "attribution": "https://primer.style",

  "tokens": {
    "font": {
      "sans": "-apple-system, BlinkMacSystemFont, 'Segoe UI', ...",
      "mono": "ui-monospace, SFMono-Regular, ...",
      "scale": [12, 14, 16, 20, 24, 32, 40],
      "weight": { "normal": 400, "medium": 500, "semibold": 600 }
    },
    "color": {
      "roles": {
        "canvas": "#ffffff",
        "fg": "#1f2328",
        "muted": "#59636e",
        "accent": "#0969da",
        "border": "#d1d9e0"
      }
    },
    "space": [4, 8, 12, 16, 24, 32, 48],
    "radius": { "sm": 6, "md": 8, "lg": 12 },
    "shadow": { "sm": "0 1px 0 rgba(31,35,40,0.04)", "md": "0 3px 6px rgba(...)" }
  },

  "rules": {
    "killGradientText": true,     // strip indigo→purple headline gradients
    "maxAccentHues": 1,           // no bento-of-random-accents
    "preferSystemFont": true
  }
}
```

## Rules a pack must follow

1. **Systems, not identities.** No logos, wordmarks, proprietary icon artwork, or literal
   proprietary code. Tokens and layout conventions only. See [docs/RESEARCH.md](./docs/RESEARCH.md).
2. **Declare the license.** For `kind: "open-source"`, link the source system and respect its
   license/attribution. For `kind: "inspired-by"`, the pack must be your own token choices that
   evoke a *convention*, not a copy of a proprietary token set.
3. **No impersonation.** A pack whose purpose is to make a site pass as a specific company will be
   rejected.

## Also welcome

- New **detection rules** for the slop fingerprint (with a failing example page).
- Adapters (plain CSS, Tailwind config, CSS variables, styled-components).
- Before/after example sites for the demo gallery.

## Dev

Project is `v0` scaffolding — the CLI and detector are being built in the open. Open an issue
before large changes so we can align on the pack schema, which is still stabilizing.
