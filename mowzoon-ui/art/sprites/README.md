# Arena character masters

The hand-drawn Figma originals, one per archetype. These are the design
source of truth; the in-app puppets in `src/arena/sprites.jsx` embed the
same shapes verbatim inside a scale wrapper and swap the fills for the
recolorable `sp-*` classes.

| file | character | archetype |
|---|---|---|
| `raccoon.svg` | triangle raccoon | 0 · The Impulse Spender |
| `squirrel.svg` | drop squirrel | 1 · The Anxious Planner |
| `peacock.svg` | oval peacock | 2 · The Blind Investor |
| `camel.svg` | rectangle camel | 3 · The Survivalist |

## Round-tripping edits

- Keep each file's own canvas size — the wrapper in `sprites.jsx` scales it
  into the 120×120 stage (feet land on y≈104; the app draws the ground
  shadow).
- The camel faces LEFT (the enemy pose); the other three face front and
  mirror automatically for the player's back view.
- After editing, re-transplant the changed shapes into `sprites.jsx`,
  keeping the class mapping (`sp-main`/`sp-dark`/`sp-deep`/`sp-soft` for the
  body tones, `sp-cash*`/`sp-coin*`/`sp-bag*` for props, `sp-white`/`sp-ink`
  for eyes) and the animation rig groups (`rc-tail`, `rc-face`, `rc-arm`,
  `sq-tail`, `sq-face`, `sq-hold`, `sq-pupil`, `sq-sweat`, `pc-fan`,
  `pc-f1/f2/f4/f5`, `pc-head`, `cm-head`, `cm-bag`) — the idle/idle2/attack
  keyframes in `index.css` target those groups.
- Gradients don't recolor and their ids collide between the two fighters on
  the field, so two-tone details are drawn as a dark base + overlay half in
  the transplant.
