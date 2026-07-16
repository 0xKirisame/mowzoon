# Arena sprite drafts

One SVG per archetype character, exported from `src/arena/sprites.jsx`:

| file | character | archetype | tint shown |
|---|---|---|---|
| `raccoon.svg` | triangle raccoon | 0 · The Impulse Spender | `#ff375f` |
| `squirrel.svg` | drop squirrel | 1 · The Anxious Planner | `#5e5ce6` |
| `peacock.svg` | oval peacock | 2 · The Blind Investor | `#e8890b` |
| `camel.svg` | rectangle camel | 3 · The Survivalist | `#0fa38f` |

There's also a live preview at `/__puppets-preview.html` while the dev
server runs (file lives in `public/` — delete it before a final deploy).

## Rules for edits (so they drop back into the app cleanly)

- **Keep `viewBox="0 0 120 120"`.** The width/height (480) is just editor zoom.
- The camel is the enemy pose **facing LEFT**; the front-facing three mirror
  automatically for the player's back view.
- **Keep the class names** — they drive recoloring AND the puppet animation:
  - `sp-main` → the character's color (user accent / archetype tint)
  - `sp-dark` / `sp-soft` → auto-derived darker & lighter tones of it
  - `sp-white`, `sp-ink` → eye whites and pupils
  - props keep fixed colors: `sp-cash*` (banknote), `sp-coin*` (coin),
    `sp-bag*` (briefcase), `sp-sweat` (sweat drop — hidden until the
    squirrel's bored idle plays)
  - **part groups are animation rigs** — `rc-tail`, `rc-arm`, `rc-face`,
    `sq-tail`, `sq-hold`, `sq-pupil`, `sq-sweat`, `pc-fan`, `pc-f1…pc-f5`,
    `pc-head`, `cm-head`, `cm-bag`, and the root `sp-puppet`. Keep moving
    parts inside their group or the idle/idle2/attack animations lose them.
- Feet sit near `y=104`; the ground shadow is drawn by the app, don't add one.

When you're happy, hand the files back (or paste the SVG) and the shapes get
transplanted into `src/arena/sprites.jsx` (same markup, JSX attribute casing).
