import { memo, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendar } from '../context/CalendarContext';
import FlagImg from './FlagImg';
import { getTimezoneOffset, guessTimezoneForCountry } from '../utils/timezones';
import type { SkyScene, SkyPhase, Season } from '../utils/skyScene';

// ---------------------------------------------------------------------------
// Sky colour map per phase
// ---------------------------------------------------------------------------
const SKY: Record<SkyPhase, { top: string; bottom: string }> = {
  night:     { top: '#1a2540', bottom: '#2d3a5c' },
  dawn:      { top: '#3b3060', bottom: '#d4845a' },
  morning:   { top: '#6ab4e8', bottom: '#f5e5a0' },
  midday:    { top: '#4db8f0', bottom: '#a8dcf8' },
  afternoon: { top: '#5aabdc', bottom: '#f0c96a' },
  dusk:      { top: '#c8603a', bottom: '#2d3a5c' },
};

const STAR_ALPHA: Record<SkyPhase, number> = {
  night: 0.85, dawn: 0.35, dusk: 0.30, morning: 0, midday: 0, afternoon: 0,
};

const GROUND_COLOR: Record<Season, { base: string; hill: string }> = {
  spring: { base: '#6aab6a', hill: '#88c87a' },
  summer: { base: '#3a8a3a', hill: '#5aaa52' },
  autumn: { base: '#b06a28', hill: '#c88840' },
  winter: { base: '#c8d8e8', hill: '#ddeaf8' },
};

const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter',
};

const PHASE_LABEL: Record<SkyPhase, string> = {
  night: 'Night', dawn: 'Dawn', morning: 'Morning',
  midday: 'Midday', afternoon: 'Afternoon', dusk: 'Dusk',
};

// Text colour for clock overlay — light on dark sky, dark on light sky
const CLOCK_TEXT: Record<SkyPhase, { primary: string; muted: string; bg: string }> = {
  night:     { primary: '#f1f5f9', muted: '#94a3b8', bg: 'rgba(15,20,40,0.55)' },
  dawn:      { primary: '#fef3c7', muted: '#fcd34d', bg: 'rgba(40,30,60,0.50)' },
  morning:   { primary: '#1e3a5f', muted: '#3a6090', bg: 'rgba(240,248,255,0.55)' },
  midday:    { primary: '#0f2a4a', muted: '#1e5080', bg: 'rgba(200,238,255,0.55)' },
  afternoon: { primary: '#1e2a40', muted: '#4a6080', bg: 'rgba(220,238,250,0.55)' },
  dusk:      { primary: '#fef3c7', muted: '#fcd34d', bg: 'rgba(30,20,40,0.55)' },
};

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------
const STARS: { x: number; y: number; r: number }[] = Array.from({ length: 28 }, (_, i) => {
  const a = ((i * 1664525 + 1013904223) >>> 0);
  const b = ((a * 1664525 + 1013904223) >>> 0);
  const c = ((b * 1664525 + 1013904223) >>> 0);
  return {
    x: (a % 980) / 10 + 1,
    y: (b % 520) / 10,   // upper 52% of card (above clock overlay)
    r: 0.8 + (c % 3) * 0.6,
  };
});

// ---------------------------------------------------------------------------
// Moon
// ---------------------------------------------------------------------------
/**
 * Renders a crescent / gibbous / full moon using the circle-overlap technique.
 *
 * The moon disc is a circle. The shadow is a second circle (same radius) whose
 * centre is shifted horizontally to produce the correct crescent shape:
 *
 *  - New moon  (phase≈0 or ≈1): shadow circle perfectly covers the disc → dark
 *  - Quarter   (phase≈0.25/0.75): shadow circle centre at disc edge → half-lit
 *  - Full moon (phase≈0.5): shadow circle shifted completely off → fully lit
 *
 * The shadow circle uses mix-blend-mode:"multiply" on a semi-opaque sky-colour
 * div so it darkens whatever is beneath without needing clip-path maths.
 *
 * `southern` flips the disc so the lit side is on the correct side for the
 * Southern Hemisphere.
 */
function MoonDisc({ phase, southern, shadowBg }: {
  phase: number; southern: boolean; shadowBg: string;
}) {
  const SIZE = 36;

  // `lit` goes 0 → 1 → 0 over the lunar cycle (0 = new, 0.5 = full, 1 = new)
  const lit    = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
  // waxing = first half of cycle (right side lit in N. hemisphere)
  const waxing = phase <= 0.5;

  // How far to shift the shadow circle:
  //   lit=0  → shift=0   (shadow perfectly overlaps → new moon, fully dark)
  //   lit=0.5 → shift=SIZE/2 (half covered → quarter moon)
  //   lit=1  → shift=SIZE  (shadow fully off → full moon)
  // We shift by up to SIZE so the shadow circle moves from fully-overlapping
  // to completely off the disc.
  const shadowShift = lit * SIZE;

  // For a waxing moon the shadow covers the LEFT side, so shift it RIGHT.
  // For a waning moon the shadow covers the RIGHT side, so shift it LEFT.
  const shadowLeft = waxing ? shadowShift - SIZE / 2 : SIZE / 2 - shadowShift;

  return (
    <div style={{
      position: 'relative',
      width: SIZE, height: SIZE,
      borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      transform: southern ? 'scaleX(-1)' : undefined,
      boxShadow: '0 0 10px 4px rgba(255,255,240,0.28)',
    }}>
      {/* Lit moon surface */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 40% 36%, #f8fafc 0%, #dde8f4 50%, #b0c4d8 100%)',
      }} />

      {/* Shadow circle — same SIZE, shifted horizontally to carve the crescent */}
      {lit < 0.98 && (
        <div style={{
          position: 'absolute',
          top: -SIZE / 2,
          left: shadowLeft,
          width: SIZE * 2,
          height: SIZE * 2,
          borderRadius: '50%',
          background: shadowBg,
          opacity: 0.92,
        }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canopy colours per season
// ---------------------------------------------------------------------------
const CANOPY_COLORS: Record<Season, string[][]> = {
  spring: [
    ['#5ab85a', '#72d472', '#f9b8d4'],
    ['#48a848', '#60c060', '#fca8cc'],
    ['#62c062', '#7ad47a', '#f8c8e0'],
  ],
  summer: [
    ['#2e7a2e', '#409040', '#52a852'],
    ['#287028', '#388838', '#48a048'],
    ['#347034', '#469046', '#58a858'],
  ],
  autumn: [
    ['#e06020', '#c84010', '#f0a020'],
    ['#d05018', '#b83008', '#e89018'],
    ['#e87030', '#d06020', '#f0b030'],
  ],
  winter: [
    ['#8898aa', '#9aaabb', '#c8dcf0'],
    ['#7888a0', '#8a9ab2', '#b8ccec'],
    ['#8090a8', '#92a4bc', '#c0d4ee'],
  ],
};

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------
function Tree({ left, season, variant }: { left: number; season: Season; variant: number }) {
  const isWinter = season === 'winter';
  const colors   = CANOPY_COLORS[season][variant % 3];
  const trunkH   = [28, 38, 32][variant % 3];
  const trunkW   = [5,  7,  6][variant % 3];
  const c1       = [30, 42, 36][variant % 3];
  const c2       = [22, 30, 26][variant % 3];
  const c3       = [18, 24, 20][variant % 3];

  return (
    <div style={{
      position: 'absolute',
      bottom: '28%',   // just above the clock overlay strip (which is ~26% of card)
      left: `${left}%`,
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {isWinter ? (
        <div style={{ position: 'relative', width: c1, height: trunkH * 0.9, marginBottom: -2 }}>
          {[-22, -10, 10, 22].map((angle, bi) => (
            <div key={bi} style={{
              position: 'absolute', bottom: 0, left: '50%',
              width: 2, height: trunkH * (0.5 + (bi % 2) * 0.15),
              background: '#6a6060', transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${angle}deg)`, borderRadius: 2,
            }} />
          ))}
          {[-35, 35].map((angle, bi) => (
            <div key={bi} style={{
              position: 'absolute', bottom: trunkH * 0.35, left: '50%',
              width: 1.5, height: trunkH * 0.38, background: '#7a7070',
              transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${angle}deg)`, borderRadius: 2,
            }} />
          ))}
          {[-28, 0, 28].map((ox, si) => (
            <div key={si} style={{
              position: 'absolute', top: si % 2 === 0 ? 2 : 8,
              left: `calc(50% + ${ox}px)`,
              width: 10 - si * 1, height: 5,
              background: '#ddeef8', borderRadius: '50% 50% 40% 40%',
              opacity: 0.85, transform: 'translateX(-50%)',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ position: 'relative', width: c1 + 12, height: c1, marginBottom: -(c1 * 0.18) }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: c2, height: c2, borderRadius: '50%', background: colors[1] }} />
          <div style={{ position: 'absolute', bottom: c1 * 0.08, right: 0, width: c3, height: c3, borderRadius: '50%', background: colors[2] }} />
          <div style={{
            position: 'absolute', bottom: c1 * 0.1, left: '50%',
            transform: 'translateX(-50%)',
            width: c1, height: c1, borderRadius: '50%', background: colors[0],
            ...(season === 'spring' ? {
              boxShadow: `${c1 * 0.42}px -${c1 * 0.28}px 0 ${c1 * 0.18}px #f9a8c9, -${c1 * 0.38}px -${c1 * 0.18}px 0 ${c1 * 0.14}px #fbc4dc, ${c1 * 0.08}px -${c1 * 0.42}px 0 ${c1 * 0.12}px #fad0e8`,
            } : {}),
          }} />
        </div>
      )}
      <div style={{ width: trunkW, height: trunkH, background: isWinter ? '#6a6060' : '#7c6040', borderRadius: '1px 1px 3px 3px' }} />
    </div>
  );
}

function Trees({ season }: { season: Season }) {
  const layout: [number, number][] = [[6,0],[22,1],[40,2],[60,1],[78,0],[92,2]];
  return (
    <>
      {layout.map(([left, variant], i) => (
        <Tree key={i} left={left} season={season} variant={variant} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Clock helpers
// ---------------------------------------------------------------------------
function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function formatDate(date: Date, tz: string, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

// ---------------------------------------------------------------------------
// Skeleton placeholder
// ---------------------------------------------------------------------------
function SkySceneSkeleton() {
  return (
    <div
      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse"
      style={{ height: 260, position: 'relative', background: 'var(--skeleton-bg, #e5e7eb)' }}
    >
      {/* Sky area */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #d1d5db, #e5e7eb)' }} className="dark:[background:linear-gradient(to_bottom,#374151,#4b5563)]" />

      {/* Fake celestial body */}
      <div style={{
        position: 'absolute', top: '22%', left: '60%',
        width: 36, height: 36, borderRadius: '50%',
        background: '#c9d1db',
        transform: 'translate(-50%, -50%)',
      }} className="dark:bg-gray-600" />

      {/* Fake ground strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '26%',
        background: '#c9d1db', borderRadius: '60% 60% 0 0 / 18px 18px 0 0',
      }} className="dark:bg-gray-600" />

      {/* Fake clock overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '10px 14px 12px',
        background: 'rgba(0,0,0,0.10)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: 100, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.15)' }} />
          <div style={{ width: 160, height: 11, borderRadius: 4, background: 'rgba(0,0,0,0.10)' }} />
          <div style={{ display: 'flex', gap: 5 }}>
            {[60, 44, 38].map((w, i) => (
              <div key={i} style={{ width: w, height: 16, borderRadius: 99, background: 'rgba(0,0,0,0.10)' }} />
            ))}
          </div>
        </div>
        <div style={{ width: 40, height: 30, borderRadius: 4, background: 'rgba(0,0,0,0.12)' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merged component: sky scene + live clock
// ---------------------------------------------------------------------------
interface Props { scene: SkyScene; loading?: boolean }

function DashboardSkyScene({ scene, loading }: Props) {
  if (loading) return <SkySceneSkeleton />;
  const { t } = useTranslation();
  const { skyPhase, isDaytime, sunMoonX, sunMoonY, moonPhase, season, southern } = scene;
  const { top, bottom } = SKY[skyPhase];
  const starAlpha  = STAR_ALPHA[skyPhase];
  const { base: groundBase, hill: groundHill } = GROUND_COLOR[season];
  const clockTheme = CLOCK_TEXT[skyPhase];

  // Clock live tick
  const { timezone, country } = useCalendar();
  const { i18n } = useTranslation();
  const activeTz = timezone ?? (country ? guessTimezoneForCountry(country) : null);
  const [now, setNow] = useState(() => new Date());
  const frameRef = useRef<number | null>(null);
  useEffect(() => {
    function tick() {
      setNow(new Date());
      frameRef.current = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    }
    tick();
    return () => { if (frameRef.current !== null) clearTimeout(frameRef.current); };
  }, []);

  const timeStr   = activeTz ? formatTime(now, activeTz)   : null;
  const dateStr   = activeTz ? formatDate(now, activeTz, i18n.language) : null;
  const offsetStr = activeTz ? getTimezoneOffset(activeTz) : null;

  // Celestial body position — keep within sky region (top 68% of card)
  const celestialLeft = `${sunMoonX}%`;
  const celestialTop  = `${Math.min(sunMoonY * 0.60, 52)}%`;

  return (
    <div
      aria-label={t('dashboard.skySceneLabel')}
      title={`${PHASE_LABEL[skyPhase]} · ${SEASON_LABEL[season]}${southern ? ' (S)' : ''}`}
      className="w-full rounded-xl overflow-hidden border border-white/20 dark:border-gray-700"
      style={{ height: 260, position: 'relative', userSelect: 'none' }}
    >
      {/* Sky gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${top}, ${bottom})` }} />

      {/* Stars */}
      {starAlpha > 0 && STARS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.r * 1.6, height: s.r * 1.6,
          borderRadius: '50%', background: '#e8eef8',
          opacity: starAlpha * (0.5 + (i % 3) * 0.25),
        }} />
      ))}

      {/* Sun */}
      {isDaytime && (
        <div style={{
          position: 'absolute', left: celestialLeft, top: celestialTop,
          transform: 'translate(-50%, -50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'radial-gradient(circle, #fff8d6 0%, #fde68a 40%, transparent 70%)',
          boxShadow: '0 0 22px 11px rgba(253,230,138,0.45), 0 0 55px 22px rgba(253,211,77,0.18)',
        }} />
      )}

      {/* Moon */}
      {!isDaytime && (
        <div style={{ position: 'absolute', left: celestialLeft, top: celestialTop, transform: 'translate(-50%, -50%)' }}>
          <MoonDisc phase={moonPhase} southern={southern} shadowBg={bottom} />
        </div>
      )}

      {/* Ground strip — no overflow:hidden so trees can grow up */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '26%' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: groundBase,
          borderRadius: '60% 60% 0 0 / 18px 18px 0 0',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: '-15%', width: '65%', height: '70%', background: groundHill, borderRadius: '50% 50% 0 0', opacity: 0.9 }} />
          <div style={{ position: 'absolute', top: 0, right: '-10%', width: '55%', height: '60%', background: groundHill, borderRadius: '50% 50% 0 0', opacity: 0.85 }} />
          {season === 'winter' && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '35%', background: 'rgba(220,234,248,0.6)', borderRadius: '50% 50% 0 0 / 10px 10px 0 0' }} />
          )}
          {season === 'autumn' && [15, 32, 52, 70, 85].map((lx, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${lx}%`, top: `${18 + (i % 3) * 20}%`,
              width: 5, height: 3, background: i % 2 === 0 ? '#d4703a' : '#c4943a',
              borderRadius: '50%', opacity: 0.65, transform: `rotate(${i * 40}deg)`,
            }} />
          ))}
        </div>
      </div>

      {/* Trees — card-relative so canopies grow into sky */}
      <Trees season={season} />

      {/* ── Clock overlay strip ── */}
      {activeTz && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '10px 14px 12px',
          background: clockTheme.bg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ minWidth: 0 }}>
            {/* Time */}
            <div
              aria-live="polite" aria-atomic="true"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 30, fontWeight: 700,
                lineHeight: 1, letterSpacing: '-0.02em',
                color: clockTheme.primary,
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              {timeStr}
            </div>
            {/* Date */}
            <div style={{
              marginTop: 3, fontSize: 11,
              color: clockTheme.muted,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}>
              {dateStr}
            </div>
            {/* Timezone + offset + badges */}
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: clockTheme.muted, fontWeight: 600 }}>{activeTz}</span>
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 99,
                background: 'rgba(0,0,0,0.22)', color: clockTheme.primary,
              }}>{offsetStr}</span>
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 99,
                background: 'rgba(0,0,0,0.20)', color: 'rgba(255,255,255,0.8)',
              }}>{PHASE_LABEL[skyPhase]}</span>
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 99,
                background: 'rgba(0,0,0,0.20)', color: 'rgba(255,255,255,0.8)',
              }}>{SEASON_LABEL[season]}</span>
            </div>
          </div>

          {/* Flag */}
          {country && (
            <FlagImg code={country} className="w-10 h-[30px] rounded shrink-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
          )}
        </div>
      )}
    </div>
  );
}

export default memo(DashboardSkyScene);
