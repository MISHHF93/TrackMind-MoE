# TrackMind Nexus — Horse Racing Design Language

A unified **race-day light mode**: white is primary across the entire control surface. Navy, maroon, and blue are racing semantics — steward ink, jockey silks, and afternoon sky — not a dark-chrome vs bright-workspace split.

## Palette

| Token | Hex | Racing meaning |
|-------|-----|----------------|
| `--brand-white` | `#FFFFFF` | Parade ring, paddock panels, primary surface |
| `--brand-parchment` | `#FBF8F4` | Race program paper — workspace base |
| `--brand-cream` | `#F3EDE4` | Raised rails, subtle elevation |
| `--brand-navy` | `#142A45` | Steward ink — headlines, rail lines, structure |
| `--brand-navy-muted` | `#5A6B7D` | Form guide metadata |
| `--brand-maroon` | `#7A1828` | Jockey silks, bloodline, governance weight |
| `--brand-maroon-deep` | `#5A0F1C` | Silks hover, deep accent |
| `--brand-blue` | `#2D5F9E` | Afternoon sky — primary actions, active nav wash |
| `--brand-blue-light` | `#4A82C4` | Hover on blue controls |
| `--brand-turf` | `#1F6B4A` | Turf going good — nominal status |
| `--brand-brass` | `#B8922A` | Trophy brass — brand mark highlight |

## Visual hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ SIDEBAR (white)    │ COMMAND BAR (white + rail shadow)  │
│  silks stripe ─    │  posture · scope chips · search    │
│  TM blue→maroon     │                                    │
│  active = maroon    ├────────────────────────────────────┤
│  border + blue wash │ WORKSPACE (parchment)              │
│                    │  white cards · blue buttons        │
│                    │  maroon governance accents         │
├────────────────────┴─────────────────────────────────────┤
│ ACTION DOCK (white + maroon top rule)                    │
│ LIVE STATUS (cream strip, turf pulse)                    │
└─────────────────────────────────────────────────────────┘
```

## Principles

1. **White holds the meet** — sidebar, command bar, dock, and cards share a bright race-day canvas.
2. **Parchment grounds the card** — workspace base is warm program paper, not cold gray.
3. **Navy draws the rails** — typography and borders, not filled dark chrome.
4. **Maroon marks silks & stewards** — governance, regulated actions, active nav accent.
5. **Blue moves the card** — navigation wash, buttons, focus rings.
6. **Turf stays green** — nominal/safe states never use maroon.

## Do / Don't

- Do use maroon for governance rails, approval flows, and the sidebar silks stripe.
- Do use navy for text and structural borders on white.
- Do use blue for operational actions and links.
- Don't fill large regions with dark navy — that was the old split-chrome look.
- Don't use maroon for success or turf-going-good states.

## Implementation

- Tokens: [`apps/frontend/src/design/tokens.css`](../../apps/frontend/src/design/tokens.css)
- Tailwind theme: [`apps/frontend/src/design/globals.css`](../../apps/frontend/src/design/globals.css)
- Components: [`apps/frontend/src/design/components/`](../../apps/frontend/src/design/components/)

## Theme mode

Single light mode only — optimized for bright race-day environments. Dark mode toggle removed.
