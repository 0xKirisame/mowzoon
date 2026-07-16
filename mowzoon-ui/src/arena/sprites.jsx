// Arena fighter puppets, one per archetype (from the hand-designed set):
//   0 Impulse Spender → triangle raccoon   1 Anxious Planner → drop squirrel
//   2 Blind Investor  → oval peacock       3 Survivalist     → rectangle camel
//
// Every character is split into named part groups (tail, face, arm, fan,
// head, bag…) so CSS keyframes in index.css can puppet them: `anim` picks
// idle / idle2 (the bored special) / attack. Colors are driven by the
// user's accent: sp-main is the tint, sp-dark/sp-soft derive from it in
// CSS; props (banknote, coin, briefcase, sweat) keep fixed colors.
//
// The camel is drawn in side profile facing LEFT (the enemy pose); the
// front-facing three just mirror for the player's back view.

const ANIMAL_SLUG = { 0: 'raccoon', 1: 'squirrel', 2: 'peacock', 3: 'camel' };

function Raccoon() {
  return (
    <g className="sp-puppet">
      <g className="rc-tail">
        <circle cx="86" cy="93" r="9" className="sp-dark" />
        <circle cx="98" cy="90" r="7" className="sp-main" />
        <circle cx="107" cy="87" r="5.5" className="sp-dark" />
      </g>
      <rect x="40" y="98" width="15" height="9" rx="4.5" className="sp-dark" />
      <rect x="64" y="98" width="15" height="9" rx="4.5" className="sp-dark" />
      <path
        d="M53 19 Q60 9 67 19 L95 78 Q99 86 91 89.5 Q76 95 60 95 Q44 95 29 89.5 Q21 86 25 78 Z"
        className="sp-main"
      />
      <g className="rc-face">
        <rect x="25" y="41" width="70" height="25" rx="12.5" className="sp-dark" />
        <circle cx="45" cy="53.5" r="10.5" className="sp-white" />
        <circle cx="69" cy="53.5" r="10.5" className="sp-white" />
        <circle cx="48" cy="54.5" r="2.6" className="sp-ink" />
        <circle cx="66" cy="54.5" r="2.6" className="sp-ink" />
      </g>
      <path d="M54.5 71 Q60 76.5 65.5 71" className="sp-darkline" strokeWidth="2.6" />
      <g className="rc-arm">
        <g transform="rotate(-18 58 83.5)">
          <rect x="45" y="75.5" width="26" height="15" rx="3" className="sp-cash" />
          <rect x="48.5" y="79" width="19" height="8" rx="2" className="sp-cashline" strokeWidth="1.8" />
          <circle cx="58" cy="83" r="3.2" className="sp-cash2" />
        </g>
        <rect x="60" y="73.5" width="15" height="9.5" rx="4.75" className="sp-dark" transform="rotate(-35 67.5 78.25)" />
      </g>
    </g>
  );
}

function Squirrel() {
  return (
    <g className="sp-puppet">
      <g className="sq-tail">
        <path d="M72 92 Q106 88 108 54 Q109 24 80 15 Q99 34 93 60 Q88 80 66 88 Z" className="sp-dark" />
      </g>
      <rect x="47" y="98" width="11" height="8" rx="4" className="sp-dark" />
      <rect x="62" y="98" width="11" height="8" rx="4" className="sp-dark" />
      <path
        d="M60 15 Q77 33 84 56 Q90 80 75 91 Q60 99 45 91 Q30 80 36 56 Q43 33 60 15 Z"
        className="sp-main"
      />
      <g className="sq-face">
        <circle cx="46" cy="52" r="12.5" className="sp-white sq-rim" strokeWidth="4" />
        <circle cx="74" cy="52" r="12.5" className="sp-white sq-rim" strokeWidth="4" />
        <rect x="57" y="50" width="6" height="3.5" rx="1.75" className="sp-dark" />
        <circle cx="50" cy="55" r="2.6" className="sp-ink sq-pupil" />
        <circle cx="78" cy="55" r="2.6" className="sp-ink sq-pupil" />
      </g>
      <rect x="56" y="70.5" width="8" height="2.6" rx="1.3" className="sp-dark" />
      <g className="sq-hold">
        <circle cx="60" cy="84" r="14.5" className="sp-coin" />
        <circle cx="60" cy="84" r="9.5" className="sp-coinline" strokeWidth="3" />
        <rect x="38" y="73" width="15" height="8.5" rx="4.25" className="sp-soft" transform="rotate(33 45.5 77.25)" />
        <rect x="67" y="73" width="15" height="8.5" rx="4.25" className="sp-soft" transform="rotate(-33 74.5 77.25)" />
      </g>
      <path d="M33 22 Q37.5 29 33 32.5 Q28.5 29 33 22 Z" className="sp-sweat sq-sweat" />
    </g>
  );
}

function Peacock() {
  return (
    <g className="sp-puppet">
      <g className="pc-fan">
        <g className="pc-f pc-f1">
          <ellipse cx="25" cy="52" rx="11" ry="20" className="sp-soft" transform="rotate(-62 25 52)" />
          <circle cx="25" cy="52" r="5.5" className="pc-ring" strokeWidth="3" />
        </g>
        <g className="pc-f pc-f2">
          <ellipse cx="38" cy="30" rx="11" ry="20" className="sp-soft" transform="rotate(-32 38 30)" />
          <circle cx="38" cy="30" r="5.5" className="pc-ring" strokeWidth="3" />
        </g>
        <g className="pc-f pc-f3">
          <ellipse cx="60" cy="22" rx="11" ry="20" className="sp-soft" />
          <circle cx="60" cy="22" r="5.5" className="pc-ring" strokeWidth="3" />
        </g>
        <g className="pc-f pc-f4">
          <ellipse cx="82" cy="30" rx="11" ry="20" className="sp-soft" transform="rotate(32 82 30)" />
          <circle cx="82" cy="30" r="5.5" className="pc-ring" strokeWidth="3" />
        </g>
        <g className="pc-f pc-f5">
          <ellipse cx="95" cy="52" rx="11" ry="20" className="sp-soft" transform="rotate(62 95 52)" />
          <circle cx="95" cy="52" r="5.5" className="pc-ring" strokeWidth="3" />
        </g>
      </g>
      <path d="M39 106 a8.5 8.5 0 0 1 17 0 Z" className="sp-main" />
      <path d="M64 106 a8.5 8.5 0 0 1 17 0 Z" className="sp-main" />
      <ellipse cx="60" cy="82" rx="23" ry="20" className="sp-main" />
      <g className="pc-head">
        <rect x="53" y="44" width="14" height="34" rx="7" className="sp-main" />
        <circle cx="60" cy="38" r="13.5" className="sp-main" />
        <path d="M50.5 36.5 Q54 40 57.5 36.5" className="sp-darkline" strokeWidth="2.4" />
        <path d="M62.5 36.5 Q66 40 69.5 36.5" className="sp-darkline" strokeWidth="2.4" />
        <path d="M54.5 45.5 L65.5 45.5 L60 54.5 Z" className="sp-dark" />
      </g>
    </g>
  );
}

function Camel() {
  return (
    <g className="sp-puppet">
      <rect x="42" y="80" width="11" height="26" rx="5.5" className="sp-main" />
      <rect x="55" y="82" width="11" height="24" rx="5.5" className="sp-dark" />
      <rect x="76" y="80" width="11" height="26" rx="5.5" className="sp-main" />
      <rect x="89" y="82" width="11" height="24" rx="5.5" className="sp-dark" />
      <circle cx="60" cy="50" r="12" className="sp-dark" />
      <circle cx="82" cy="50" r="12" className="sp-dark" />
      <rect x="36" y="52" width="58" height="34" rx="9" className="sp-main" />
      <g className="cm-head">
        <rect x="24" y="28" width="15" height="38" rx="7.5" className="sp-main" />
        <rect x="4" y="20" width="32" height="19" rx="8" className="sp-main" />
        <rect x="13" y="26" width="7" height="2.6" rx="1.3" className="sp-dark" />
        <rect x="23" y="26" width="7" height="2.6" rx="1.3" className="sp-dark" />
        <rect x="6" y="33" width="6.5" height="2.4" rx="1.2" className="sp-dark" />
      </g>
      <g className="cm-bag">
        <ellipse cx="76" cy="66" rx="14" ry="20" className="sp-bagline" strokeWidth="5" />
        <rect x="70" y="44" width="16" height="10" rx="5" className="sp-bagline" strokeWidth="4.5" />
        <rect x="58" y="52" width="36" height="26" rx="5" className="sp-bag" />
        <rect x="58" y="61" width="36" height="7" className="sp-bag2" />
        <rect x="65" y="55" width="5" height="20" rx="2" className="sp-bag2" />
        <rect x="85" y="55" width="5" height="20" rx="2" className="sp-bag2" />
      </g>
    </g>
  );
}

const ANIMALS = { 0: Raccoon, 1: Squirrel, 2: Peacock, 3: Camel };

// view 'front' = the enemy pose; view 'back' = mirrored, facing the foe.
// anim: null | 'idle' | 'idle2' | 'attack' — CSS keyframes in index.css.
export function ArchSprite({ archetype, view = 'front', tint, size = 120, anim = null }) {
  const Animal = ANIMALS[archetype] || Raccoon;
  const slug = ANIMAL_SLUG[archetype] || 'raccoon';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={`arch-sprite spx-${slug}${anim ? ` anim-${anim}` : ''}`}
      style={tint ? { '--sp-tint': tint } : undefined}
    >
      <ellipse cx="60" cy="110" rx="34" ry="5.5" className="sp-shadow" />
      <g transform={view === 'back' ? 'scale(-1,1) translate(-120,0)' : undefined}>
        <Animal />
      </g>
    </svg>
  );
}
