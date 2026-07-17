// Arena battle engine. Pure functions, no React - the ghost, pass-and-play
// and simulation paths all drive this same state machine. Outcomes are pure
// luck (Pokémon-style): the wheel lands on a uniformly random angle and the
// arc sizes are the probabilities. Copy for abilities/effects lives in i18n.

// affinity cycle: each archetype beats exactly one and loses to exactly one.
// Survivalist(3) > Impulse(0) > Anxious Planner(1) > Blind Investor(2) > Survivalist
export const BEATS = { 3: 0, 0: 1, 1: 2, 2: 3 };

// two affinity abilities per archetype; loadout picks one (first is the default)
export const ABILITIES = {
  0: ['splurge', 'retail'],
  1: ['contingency', 'overplan'],
  2: ['allin', 'diversify'],
  3: ['reserve', 'rationing'],
};

// general effects, any archetype; loadout equips up to two
export const EFFECTS = ['compound', 'cashback', 'highyield'];

// 'retail' arms itself at battle start; there is no button to press for it
export const PASSIVE_ABILITIES = new Set(['retail']);

// loadout slots unlock along the existing 5-level curve
export const slotsFor = (level) => ({
  effectSlots: level >= 3 ? 2 : 1,
  abilityChoice: level >= 2,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const other = (side) => (side === 'A' ? 'B' : 'A');

// character: { handle, name, archetype, metrics:{efficiency,resilience,eq},
//              level, loadout:{effects:[], ability}, accent?, bot? }
export function makeFighter(character) {
  const m = character.metrics || {};
  const e = clamp(m.efficiency ?? 50, 0, 100);
  const r = clamp(m.resilience ?? 50, 0, 100);
  const q = clamp(m.eq ?? 50, 0, 100);
  const level = clamp(Math.round(character.level || 1), 1, 5);
  const arch = character.archetype ?? 0;

  // sanitize the loadout against what this level has actually unlocked
  const slots = slotsFor(level);
  const raw = character.loadout || {};
  const effects = (raw.effects || [])
    .filter((id, i, a) => EFFECTS.includes(id) && a.indexOf(id) === i)
    .slice(0, slots.effectSlots);
  const ability =
    slots.abilityChoice && (ABILITIES[arch] || []).includes(raw.ability)
      ? raw.ability
      : (ABILITIES[arch] || ABILITIES[0])[0];

  const maxHp = 72 + Math.round(r * 0.55) + level * 3;
  return {
    handle: character.handle || '',
    name: character.name || character.handle || '?',
    archetype: arch,
    level,
    hp: maxHp,
    maxHp,
    atk: 10 + Math.round(e * 0.22) + level,
    critDeg: 28 + Math.round(q * 0.24),
    effects,
    ability,
    abilityUsed: false,
    pendingHeal: 0, // cashback payout, applied at this fighter's next turn start
    fx: {
      guard: 0,           // incoming attacks halved, counts down per hit taken
      shaken: 0,          // miss arc +20°, counts down per own attack (Overplan)
      diversify: 0,       // all-hit wheel, counts down per own attack
      splurge: 0,         // remaining Splurge hits, each at 75% power
      allin: false,       // next attack 2x damage, miss arc doubled
      reserve: false,     // survive one fatal hit at 1 HP
      retailArmed: false, // first crit landed heals 20% max HP
    },
  };
}

export function initBattle(charA, charB, mode = 'ghost', first = 'A') {
  const A = makeFighter(charA);
  const B = makeFighter(charB);
  if (A.ability === 'retail') A.fx.retailArmed = true;
  if (B.ability === 'retail') B.fx.retailArmed = true;
  return {
    mode,          // 'ghost' | 'pass'
    round: 1,
    turn: first,   // challenger first in ghost mode; coin-flip in pass-and-play
    mustAttack: false, // true after an ability that leads straight into an attack
    pendingHits: 1,    // 2 while Splurge is active
    winner: null,
    fighters: { A, B },
    log: [],
  };
}

// wheel geometry for one side's attack, folding in affinity and modifiers.
// Arc order around the circle: miss -> crit -> hit (crit borders miss).
export function arcsFor(state, side) {
  const me = state.fighters[side];
  const them = state.fighters[other(side)];

  if (me.fx.diversify > 0) return { missDeg: 0, critDeg: 0, hitDeg: 360 };

  let miss = 105;
  if (BEATS[me.archetype] === them.archetype) miss -= 25; // advantage
  if (BEATS[them.archetype] === me.archetype) miss += 25; // disadvantage
  if (me.effects.includes('highyield')) miss += 10;
  if (me.fx.shaken > 0) miss += 20;
  if (me.fx.allin) miss *= 2;

  const crit = me.critDeg;
  miss = clamp(miss, 20, 360 - crit - 30); // hit arc never drops below 30°
  return { missDeg: miss, critDeg: crit, hitDeg: 360 - miss - crit };
}

// pure-luck roll: a uniform angle on the wheel decides the outcome. Returns
// the angle too so the UI can land the pointer exactly where the roll says.
// Angle 0 is the start of the miss arc; the Wheel adds its own visual offset.
export function rollOutcome(arcs, rng = Math.random) {
  const angle = rng() * 360;
  let outcome = 'hit';
  if (arcs.missDeg > 0 && angle < arcs.missDeg) outcome = 'miss';
  else if (arcs.critDeg > 0 && angle < arcs.missDeg + arcs.critDeg) outcome = 'crit';
  return { outcome, angle };
}

const cloneFighter = (f) => ({ ...f, effects: [...f.effects], fx: { ...f.fx } });
const cloneState = (s) => ({
  ...s,
  fighters: { A: cloneFighter(s.fighters.A), B: cloneFighter(s.fighters.B) },
  log: [...s.log],
});

const pushLog = (s, entry) => {
  s.log.push({
    round: s.round,
    hpA: s.fighters.A.hp,
    hpB: s.fighters.B.hp,
    ...entry,
  });
};

// hand the turn to the other side; cashback pays out at turn start
function advanceTurn(s) {
  s.mustAttack = false;
  s.pendingHits = 1;
  const next = other(s.turn);
  s.turn = next;
  if (next === 'A') s.round += 1;
  const f = s.fighters[next];
  if (f.pendingHeal > 0 && f.hp > 0) {
    const heal = Math.min(f.pendingHeal, f.maxHp - f.hp);
    f.hp += heal;
    f.pendingHeal = 0;
    if (heal > 0) pushLog(s, { actor: next, kind: 'heal', source: 'cashback', heal });
  }
}

// cast the equipped affinity ability. Defensive abilities end the turn;
// offensive arms (splurge / allin / diversify) lead straight into an attack.
export function castAbility(state, side) {
  const s = cloneState(state);
  const me = s.fighters[side];
  const them = s.fighters[other(side)];
  if (s.winner || s.turn !== side || me.abilityUsed || s.mustAttack) return state;
  if (PASSIVE_ABILITIES.has(me.ability)) return state;

  me.abilityUsed = true;
  let turnEnds = true;
  switch (me.ability) {
    case 'splurge':
      s.pendingHits = 2;
      me.fx.splurge = 2;
      turnEnds = false;
      break;
    case 'allin':
      me.fx.allin = true;
      turnEnds = false;
      break;
    case 'diversify':
      me.fx.diversify = 2;
      turnEnds = false;
      break;
    case 'contingency':
      me.fx.guard = 2;
      break;
    case 'overplan':
      them.fx.shaken = 2;
      break;
    case 'reserve':
      me.fx.reserve = true;
      break;
    case 'rationing': {
      const heal = Math.min(Math.round(me.maxHp * 0.25), me.maxHp - me.hp);
      me.hp += heal;
      pushLog(s, { actor: side, kind: 'ability', ability: 'rationing', heal });
      break;
    }
    default:
      break;
  }
  if (me.ability !== 'rationing') pushLog(s, { actor: side, kind: 'ability', ability: me.ability });
  if (turnEnds) advanceTurn(s);
  else s.mustAttack = true;
  return s;
}

// resolve one attack roll (the outcome comes from rollOutcome, shared by
// player taps and ghost turns alike)
export function resolveAttack(state, side, outcome, rng = Math.random) {
  const s = cloneState(state);
  const me = s.fighters[side];
  const them = s.fighters[other(side)];
  if (s.winner || s.turn !== side) return state;

  let dmg = 0;
  let saved = false;
  if (outcome !== 'miss') {
    let atk = me.atk;
    if (me.effects.includes('compound')) atk += 2 * (s.round - 1);
    dmg = Math.round(atk * (0.9 + rng() * 0.2));
    if (me.fx.splurge > 0) dmg = Math.round(dmg * 0.75);
    if (outcome === 'crit') dmg = Math.round(dmg * (me.effects.includes('highyield') ? 2.5 : 2));
    if (me.fx.allin) dmg *= 2;
    if (them.fx.guard > 0) {
      dmg = Math.ceil(dmg / 2);
      them.fx.guard -= 1;
    }
    them.hp -= dmg;
    if (them.hp <= 0 && them.fx.reserve) {
      them.hp = 1;
      them.fx.reserve = false;
      saved = true;
    }
    if (them.hp < 0) them.hp = 0;
    if (outcome === 'crit' && me.fx.retailArmed) {
      const heal = Math.min(Math.round(me.maxHp * 0.2), me.maxHp - me.hp);
      me.hp += heal;
      me.fx.retailArmed = false;
      if (heal > 0) pushLog(s, { actor: side, kind: 'heal', source: 'retail', heal });
    }
    if (them.effects.includes('cashback')) them.pendingHeal += Math.round(dmg * 0.1);
  }

  // one-attack arms burn out on the attack that used them
  me.fx.allin = false;
  if (me.fx.splurge > 0) me.fx.splurge -= 1;
  if (me.fx.diversify > 0) me.fx.diversify -= 1;
  if (me.fx.shaken > 0) me.fx.shaken -= 1;

  pushLog(s, { actor: side, kind: 'attack', outcome, dmg, saved });

  if (them.hp <= 0) {
    s.winner = side;
    s.mustAttack = false;
    return s;
  }
  if (s.pendingHits > 1) {
    s.pendingHits -= 1; // Splurge: same side attacks again
    s.mustAttack = true;
  } else {
    advanceTurn(s);
  }
  return s;
}

// ghost decision: which action the auto-played opponent takes this turn.
// Attack rolls themselves go through the same rollOutcome as the player.
export function ghostDecide(state, side, rng = Math.random) {
  const me = state.fighters[side];
  const lastEnemy = [...state.log].reverse().find((l) => l.actor === other(side) && l.kind === 'attack');
  if (!me.abilityUsed && !PASSIVE_ABILITIES.has(me.ability) && !state.mustAttack) {
    const hpPct = me.hp / me.maxHp;
    const wants =
      (me.ability === 'reserve' && hpPct < 0.35) ||
      (me.ability === 'rationing' && hpPct < 0.4) ||
      ((me.ability === 'contingency' || me.ability === 'overplan') &&
        hpPct < 0.55 && lastEnemy?.outcome === 'crit') ||
      (['splurge', 'allin', 'diversify'].includes(me.ability) &&
        state.round >= 2 && state.round <= 3 && rng() < 0.6);
    if (wants) return { kind: 'ability' };
  }
  return { kind: 'attack' };
}

// full auto-battle, used for balance checks from the console - not by the UI
export function simulate(charA, charB, rng = Math.random) {
  let s = initBattle(charA, charB, 'ghost');
  let guardRail = 0;
  while (!s.winner && guardRail++ < 200) {
    const side = s.turn;
    const move = ghostDecide(s, side, rng);
    if (move.kind === 'ability') {
      s = castAbility(s, side);
      if (!s.mustAttack) continue;
    }
    const { outcome } = rollOutcome(arcsFor(s, side), rng);
    s = resolveAttack(s, side, outcome, rng);
  }
  return { winner: s.winner, rounds: s.round, log: s.log };
}
