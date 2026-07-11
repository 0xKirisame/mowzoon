import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ARCHETYPE_META } from './data';
import { screen, item, springBounce } from './ui';
import { getPopulation } from './api';
import { useI18n } from './i18n';

// Population plot: efficiency across, resilience up. Tap a legend key
// to isolate a cohort. The plot stays LTR even in RTL.
function PopulationPlot({ points, you, tint, filter }) {
  const i = useI18n();
  const W = 520;
  const H = 320;
  const PAD = 18;
  const x = (v) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v) => H - PAD - (v / 100) * (H - PAD * 2);
  const yx = you ? x(you.e) : 0;
  const yy = you ? y(you.r) : 0;
  const labelX = yx > W - 60 ? yx - 44 : yx + 12;
  const labelY = yy < 30 ? yy + 26 : yy - 14;

  return (
    <div className="pop-plot pop-plot-lg" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="You plotted among real bank accounts">
        {points.map((p, idx) => {
          const on = filter === 'all' || String(p.a) === filter;
          return (
            <circle
              key={idx}
              cx={x(p.e)}
              cy={y(p.r)}
              r={on ? 2.4 : 2}
              fill={ARCHETYPE_META[p.a].tint}
              fillOpacity={on ? 0.5 : 0.07}
            />
          );
        })}
        {you && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springBounce, delay: 0.35 }}
            style={{ transformOrigin: `${yx}px ${yy}px` }}
          >
            <circle cx={yx} cy={yy} r="11" fill={tint} fillOpacity="0.22" />
            <circle cx={yx} cy={yy} r="6" fill={tint} stroke="var(--surface)" strokeWidth="2.5" />
            <text className="pop-you" x={labelX} y={labelY}>{i.t('results.pop.you')}</text>
          </motion.g>
        )}
      </svg>
      <span className="pop-axis pop-axis-x">{i.t('results.axis.x')}</span>
      <span className="pop-axis pop-axis-y">{i.t('results.axis.y')}</span>
    </div>
  );
}

export default function Population({ profile, embedded }) {
  const i = useI18n();
  const [pop, setPop] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    getPopulation().then((d) => alive && setPop(d));
    return () => { alive = false; };
  }, []);

  const id = profile ? (profile.model?.id ?? profile.archetype.id) : null;
  const meta = id != null ? ARCHETYPE_META[id] : null;
  const you = profile?.model?.point ?? null;

  return (
    <motion.section className={embedded ? 'room room-embed' : 'room'} variants={screen} initial="initial" animate="animate" exit="exit">
      {!embedded && (
        <motion.header className="room-head" variants={item}>
          <h1>{i.t('room.pop.title')}</h1>
          <p>{i.t('room.pop.sub')}</p>
        </motion.header>
      )}

      <motion.div className={embedded ? 'panel-bare' : 'glass panel'} variants={item}>
        {pop ? (
          <PopulationPlot points={pop.points} you={you} tint={meta?.tint ?? 'var(--tint)'} filter={filter} />
        ) : (
          <div className="pop-skeleton" />
        )}
        {!you && <p className="panel-note">{i.t('room.pop.missing')}</p>}
        <div className="pop-legend">
          <button className={`pop-key ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            <i style={{ background: 'var(--ink-3)' }} />{i.t('room.pop.all')}
          </button>
          {Object.keys(ARCHETYPE_META).map((aid) => (
            <button
              key={aid}
              className={`pop-key ${filter === aid ? 'on' : ''}`}
              onClick={() => setFilter(filter === aid ? 'all' : aid)}
            >
              <i style={{ background: ARCHETYPE_META[aid].tint }} />
              {i.arch(aid).name.replace('The ', '')}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.section>
  );
}
