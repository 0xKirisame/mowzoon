// Arena fighter puppets, one per archetype — hand-drawn in Figma and
// transplanted here verbatim (the shapes keep their original editor
// coordinates inside a per-animal scale wrapper, so they stay easy to
// round-trip back into Figma):
//   0 Impulse Spender → triangle raccoon   1 Anxious Planner → drop squirrel
//   2 Blind Investor  → oval peacock       3 Survivalist     → rectangle camel
//
// Every character is split into named part groups (tail, face, arm, fan,
// head, bag…) so CSS keyframes in index.css can puppet them: `anim` picks
// idle / idle2 (the bored special) / attack. Colors are driven by the
// user's accent: sp-main is the tint, sp-dark/sp-soft/sp-deep derive from
// it in CSS; props (banknote, coin, briefcase, sweat) keep fixed colors.
//
// NOTE for keyframe authors: translate distances in the per-animal
// keyframes are in the FIGMA coordinate space (they sit inside the scale
// wrapper), so 1 on-screen px ≈ 7.5–14 units depending on the animal.
//
// The camel is drawn in side profile facing LEFT (the enemy pose); the
// front-facing three just mirror for the player's back view.

import { useEffect, useRef, useState } from 'react';

const ANIMAL_SLUG = { 0: 'raccoon', 1: 'squirrel', 2: 'peacock', 3: 'camel' };

// CSS can't blend between two keyframe animations — switching classes snaps
// to the new cycle's first frame. So state changes pass through a short
// neutral beat: drop the old animation (the rig's transform transitions
// glide every part home), then start the new cycle, which always begins at
// neutral. 'strike' skips the beat — it's timed to the damage and its first
// frame IS the wind-up pose it interrupts.
const BLEND_MS = 320;

function useBlendedAnim(anim) {
  const [shown, setShown] = useState(anim);
  const prev = useRef(anim);
  useEffect(() => {
    if (anim === prev.current) return undefined;
    const from = prev.current;
    prev.current = anim;
    if (anim === 'strike' || anim == null || from == null) {
      setShown(anim);
      return undefined;
    }
    setShown(null);
    const t = setTimeout(() => setShown(anim), BLEND_MS);
    return () => clearTimeout(t);
  }, [anim]);
  return shown;
}

// artwork is 1202×1037; feet land on the shadow line at y=104
function Raccoon() {
  return (
    <g className="sp-puppet">
      <g transform="translate(0.2 0.7) scale(0.0996)">
        <g className="rc-tail">
          <circle cx="1110" cy="902" r="92" className="sp-main rc-t3" />
          <circle cx="997" cy="902" r="92" className="sp-deep rc-t2" />
          <circle cx="884" cy="902" r="92" className="sp-dark rc-t1" />
        </g>
        <path
          d="M418.518 131.55C448.226 75.5843 528.423 75.6077 558.098 131.591L914.514 804.002C942.403 856.617 904.263 920 844.714 920H131.374C71.8034 920 33.6653 856.578 61.595 803.961L418.518 131.55Z"
          className="sp-main"
        />
        <rect x="255" y="951" width="176" height="86" rx="43" className="sp-dark" />
        <rect x="255" y="951" width="100" height="86" rx="43" className="sp-main" />
        <rect x="545" y="951" width="176" height="86" rx="43" className="sp-dark" />
        <rect x="545" y="951" width="100" height="86" rx="43" className="sp-main" />
        <g className="rc-face">
          <rect x="150" y="289" width="677" height="235" rx="117.5" className="sp-deep" />
          <circle cx="355.5" cy="406.5" r="100.5" className="sp-white" />
          <circle cx="633.5" cy="406.5" r="100.5" className="sp-white" />
          <circle cx="355.5" cy="406.5" r="25.5" className="sp-ink" />
          <circle cx="633.5" cy="406.5" r="25.5" className="sp-ink" />
        </g>
        <path
          d="M553 559C553 594.899 523.899 624 488 624C452.101 624 423 594.899 423 559H553Z"
          className="sp-dark"
        />
        <g className="rc-arm">
          <rect x="460" y="669" width="276.973" height="157.082" rx="19" transform="rotate(30 460 669)" className="sp-cash2" />
          <rect x="467.01" y="694.911" width="239.126" height="120.585" transform="rotate(30 467.01 694.911)" className="sp-cash" />
          <circle cx="467.5" cy="699.5" r="20.5" className="sp-cash2" />
          <circle cx="412.5" cy="796.5" r="20.5" className="sp-cash2" />
          <circle cx="612.5" cy="913.5" r="20.5" className="sp-cash2" />
          <circle cx="540.5" cy="806.5" r="30.5" className="sp-cash2" />
          <circle cx="671.5" cy="816.5" r="20.5" className="sp-cash2" />
          <g transform="rotate(-30 535.29 735.761)">
            <rect x="535.29" y="735.761" width="176" height="86" rx="43" className="sp-dark" />
            <rect x="535.29" y="735.761" width="100" height="86" rx="43" className="sp-main" />
          </g>
        </g>
      </g>
    </g>
  );
}

// artwork is 799×780
function Squirrel() {
  return (
    <g className="sp-puppet">
      <g transform="translate(6.7 0) scale(0.1333)">
        <g className="sq-tail">
          <path
            d="M457.516 0C584.946 0 697.124 65.3017 762.411 164.267C755.563 163.432 748.59 163 741.516 163C647.076 163 570.516 239.559 570.516 334C570.516 428.441 647.076 505 741.516 505C761.531 505 780.742 501.559 798.592 495.24C746.145 632.509 613.217 730 457.516 730C255.932 730 92.5162 566.584 92.5162 365C92.5162 163.416 255.932 0 457.516 0Z"
            className="sp-dark"
          />
        </g>
        <rect x="77.5162" y="707" width="194" height="73" rx="32" className="sp-dark" />
        <rect x="251.516" y="707" width="194" height="73" rx="32" className="sp-dark" />
        <path
          d="M240.516 84.5029C246.253 77.4687 253.439 69.4356 262.516 69.4999C271.408 69.5629 276.696 75.2781 284.516 84.5029C312.857 117.933 491.516 314.003 521.016 520.003C530.516 646.503 418.016 779.503 262.516 779.503C88.0163 779.503 -11.2396 615.094 1.01636 520.003C30.0162 295 198.516 136 240.516 84.5029Z"
          className="sp-main"
        />
        <g className="sq-face">
          <circle cx="131.016" cy="282" r="119" className="sp-dark" />
          <circle cx="390.516" cy="282" r="119" className="sp-dark" />
          <circle cx="131.016" cy="281.5" r="101.5" className="sp-white" />
          <circle cx="390.016" cy="281.5" r="101.5" className="sp-white" />
          <circle cx="131.016" cy="279.5" r="31.5" className="sp-ink sq-pupil" />
          <circle cx="390.016" cy="279.5" r="31.5" className="sp-ink sq-pupil" />
        </g>
        <path
          d="M277.516 278C277.516 281.751 278.013 290.053 275.516 292.5C273.016 291.5 264.101 291.5 260.357 291.5C256.316 291.5 248.554 293 245.016 295C242.856 292.612 243.016 281.958 243.016 278.5C243.016 275.506 243.349 270.239 245.016 268C247.5 264.664 255.848 264.5 260.357 264.5C264.392 264.5 274.018 263.745 276.516 266.5C278.683 268.89 277.516 274.537 277.516 278Z"
          className="sp-dark"
        />
        <rect x="211.516" y="425" width="97" height="25" rx="12.5" className="sp-dark" />
        <g className="sq-hold">
          <circle cx="306.516" cy="633" r="126" className="sp-coin" />
          <ellipse cx="306.516" cy="632.5" rx="89" ry="88.5" className="sp-coin2" />
          <g transform="rotate(42.8168 174.3 498)">
            <rect x="174.3" y="498" width="150" height="62.9497" rx="31.4749" className="sp-dark" />
            <rect x="249.3" y="498" width="75" height="62.9497" rx="31.4749" className="sp-main" />
          </g>
          <g transform="rotate(120 445.032 522.848)">
            <rect x="445.032" y="522.848" width="150" height="62.9497" rx="31.4749" className="sp-dark" />
            <rect x="520.032" y="522.848" width="75" height="62.9497" rx="31.4749" className="sp-main" />
          </g>
        </g>
        <path d="M150 85 Q182 125 150 152 Q118 125 150 85 Z" className="sp-sweat sq-sweat" />
      </g>
    </g>
  );
}

// artwork is 1480×1069
function Peacock() {
  return (
    <g className="sp-puppet">
      <g transform="translate(0.1 17.4) scale(0.081)">
        <g className="pc-fan">
          <g className="pc-f pc-f1">
            <path
              d="M155.239 617.469C71.3031 577.038 39.2115 473.944 85.37 393.016C130.965 313.077 234.239 287.665 311.723 337.319L697.213 584.356C756.738 622.501 776.017 700.549 741.102 762.024C706.548 822.862 630.766 846.527 567.731 816.164L155.239 617.469Z"
              className="sp-soft"
            />
            <circle cx="231" cy="487" r="73.5" className="pc-ring" strokeWidth="19" />
          </g>
          <g className="pc-f pc-f2">
            <path
              d="M319.303 338.666C267.233 261.409 291.541 156.207 372.225 109.624C451.923 63.6103 553.911 93.776 595.756 175.74L803.944 583.525C836.09 646.492 813.358 723.605 752.196 759.065C691.666 794.158 614.298 776.355 575.194 718.336L319.303 338.666Z"
              className="sp-soft"
            />
            <circle cx="453" cy="242" r="73.5" className="pc-ring" strokeWidth="19" />
          </g>
          <g className="pc-f pc-f4">
            <path
              d="M1159.82 338.666C1211.89 261.409 1187.58 156.207 1106.9 109.624C1027.2 63.6103 925.209 93.776 883.364 175.74L675.176 583.525C643.03 646.492 665.762 723.605 726.924 759.065C787.453 794.158 864.822 776.355 903.926 718.336L1159.82 338.666Z"
              className="sp-soft"
            />
            <circle cx="1021" cy="242" r="73.5" className="pc-ring" strokeWidth="19" />
          </g>
          <g className="pc-f pc-f5">
            <path
              d="M1323.88 617.469C1407.82 577.038 1439.91 473.944 1393.75 393.016C1348.15 313.077 1244.88 287.665 1167.4 337.319L781.907 584.356C722.382 622.501 703.102 700.549 738.018 762.024C772.572 822.862 848.354 846.527 911.389 816.164L1323.88 617.469Z"
              className="sp-soft"
            />
            <circle cx="1256" cy="465" r="73.5" className="pc-ring" strokeWidth="19" />
          </g>
        </g>
        <path d="M625.5 972C678.796 972 722 1015.2 722 1068.5C722 1068.67 721.998 1068.83 721.997 1069H529.003C529.002 1068.83 529 1068.67 529 1068.5C529 1015.2 572.205 972 625.5 972Z" className="sp-main" />
        <path d="M868.5 972C921.795 972 965 1015.2 965 1068.5C965 1068.67 964.998 1068.83 964.997 1069H772.003C772.002 1068.83 772 1068.67 772 1068.5C772 1015.2 815.205 972 868.5 972Z" className="sp-main" />
        <ellipse cx="748.5" cy="659" rx="229.5" ry="255" className="sp-main" />
        <g className="pc-head">
          <rect x="677" y="270" width="143" height="332" rx="71.5" className="sp-dark" />
          <circle cx="748.5" cy="179.5" r="179.5" className="sp-main" />
          <path
            d="M749 187C707.5 187 675.455 210 675 234C674.545 258 720 333 749 333C778 333 820.999 258 820.999 231C820.999 210 790.501 187 749 187Z"
            className="sp-deep"
          />
          <path d="M619.5 141.5C619.5 141.5 629.5 175.5 662.5 175.5C695.5 175.5 706 141.5 706 141.5" className="sp-darkline" strokeWidth="20" />
          <path d="M788 141.5C788 141.5 798 175.5 831 175.5C864 175.5 874.5 141.5 874.5 141.5" className="sp-darkline" strokeWidth="20" />
        </g>
      </g>
    </g>
  );
}

// artwork is 1689×1204, facing left
function Camel() {
  return (
    <g className="sp-puppet">
      <g transform="translate(0.5 19.2) scale(0.0704)">
        <rect x="696" y="776" width="144" height="428" rx="72" className="sp-dark" />
        <rect x="811" y="776" width="144" height="428" rx="72" className="sp-main" />
        <rect x="1212" y="776" width="144" height="428" rx="72" className="sp-dark" />
        <rect x="1327" y="776" width="144" height="428" rx="72" className="sp-main" />
        <rect x="997" y="792" width="215" height="131" rx="65.5" className="sp-bag3" />
        <ellipse cx="892" cy="254" rx="178" ry="179" className="sp-dark" />
        <ellipse cx="178" cy="179" rx="178" ry="179" transform="matrix(-1 0 0 1 1425 75)" className="sp-dark" />
        <rect x="931" y="234" width="175" height="107" rx="53.5" className="sp-bag3" />
        <rect x="583" y="249" width="973" height="627" rx="65" className="sp-main" />
        <path d="M627.5 714H479.5C443.049 714 413.5 684.451 413.5 648V270" className="sp-mainline" strokeWidth="233" strokeLinecap="round" />
        <path
          d="M507.5 492C507.5 492 507.714 549.542 520.5 564.5C533.286 579.458 547.288 586.975 560.5 585C573.712 583.025 576.55 582.569 585.5 571.5C594.45 560.431 596.5 551 600 535C603.5 519 605.5 458 605.5 458"
          className="sp-mainline"
          strokeWidth="42"
        />
        <mask id="cmShade" maskUnits="userSpaceOnUse" x="297" y="153" width="447" height="678" style={{ maskType: 'alpha' }}>
          <g opacity="0.62">
            <path d="M627.5 714H479.5C443.049 714 413.5 684.451 413.5 648V270" stroke="#fff" strokeWidth="233" strokeLinecap="round" fill="none" />
            <path
              d="M507.5 492C507.5 492 507.714 549.542 520.5 564.5C533.286 579.458 547.288 586.975 560.5 585C573.712 583.025 576.55 582.569 585.5 571.5C594.45 560.431 596.5 551 600 535C603.5 519 605.5 458 605.5 458"
              stroke="#fff"
              strokeWidth="42"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        </mask>
        <g mask="url(#cmShade)">
          <rect x="291" y="199" width="248" height="146" className="sp-dark" />
        </g>
        <g className="cm-head">
          <rect width="567" height="288" rx="78" className="sp-main" />
          <clipPath id="cmHeadClip">
            <rect width="567" height="288" rx="78" />
          </clipPath>
          <g clipPath="url(#cmHeadClip)">
            <rect x="-12" y="196" width="162" height="26" rx="13" className="sp-deep" />
            <g className="cm-eyes">
              <rect x="218" y="86" width="108" height="24" rx="12" className="sp-deep" />
              <rect x="375" y="86" width="108" height="24" rx="12" className="sp-deep" />
            </g>
          </g>
        </g>
        <g className="cm-bag">
          <path d="M1265 361V304C1265 295.163 1272.16 288 1281 288H1473C1481.84 288 1489 295.163 1489 304V361" className="sp-bagline" strokeWidth="42" />
          <path
            d="M993.5 249.5C1075.98 253.926 1105.01 471.142 1113.21 555.827C1115.12 575.541 1129.37 592.001 1148.92 595.143C1179.27 600.018 1222.38 605.109 1241.46 598.641C1272.46 588.128 1161.5 240.499 1109.5 225C1057.5 209.501 891 243.999 993.5 249.5Z"
            className="sp-bag3"
          />
          <rect x="1080" y="350" width="568" height="391" rx="44" className="sp-bag2" />
          <rect x="1154" y="350" width="494" height="391" rx="44" className="sp-bag" />
          <rect x="1247" y="407" width="45" height="272" rx="22.5" className="sp-bag4" />
          <rect x="1511" y="407" width="45" height="272" rx="22.5" className="sp-bag4" />
          <rect x="1057" y="477" width="632" height="131" rx="44" className="sp-bag3" />
          <path
            d="M1063.5 875.501C1145.81 871.084 1177.5 661.607 1186.79 579.254C1188.98 559.807 1203.16 543.685 1222.48 540.569C1252.85 535.67 1296.32 530.489 1315.5 536.992C1346.5 547.505 1235.5 897.506 1183.5 913.005C1131.5 928.504 961 881.002 1063.5 875.501Z"
            className="sp-bag3"
          />
        </g>
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
  const shown = useBlendedAnim(anim);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={`arch-sprite spx-${slug}${shown ? ` anim-${shown}` : ''}`}
      style={tint ? { '--sp-tint': tint } : undefined}
    >
      <ellipse cx="60" cy="110" rx="34" ry="5.5" className="sp-shadow" />
      <g transform={view === 'back' ? 'scale(-1,1) translate(-120,0)' : undefined}>
        <Animal />
      </g>
    </svg>
  );
}
