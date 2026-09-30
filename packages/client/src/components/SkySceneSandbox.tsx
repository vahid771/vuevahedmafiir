import { useState } from 'react';
import DashboardSkyScene from './DashboardSkyScene';
import {
  getCelestialPosition,
  getMoonPhase,
  type Season,
  type SkyPhase,
  type SkyScene,
} from '../utils/skyScene';

// ---------------------------------------------------------------------------
// Representative hour for each sky phase (used to position sun/moon)
// ---------------------------------------------------------------------------
const PHASE_HOUR: Record<SkyPhase, number> = {
  night:     2,
  dawn:      6,
  morning:   8,
  midday:    13,
  afternoon: 17,
  dusk:      20,
};

const SEASONS: Season[]   = ['spring', 'summer', 'autumn', 'winter'];
const PHASES: SkyPhase[]  = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'dusk'];

const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter',
};
const PHASE_LABEL: Record<SkyPhase, string> = {
  night: 'Night', dawn: 'Dawn', morning: 'Morning',
  midday: 'Midday', afternoon: 'Afternoon', dusk: 'Dusk',
};

// ---------------------------------------------------------------------------
// Build a synthetic SkyScene from chosen parameters
// ---------------------------------------------------------------------------
function buildScene(season: Season, phase: SkyPhase, southern: boolean): SkyScene {
  const hour = PHASE_HOUR[phase];
  const { x: sunMoonX, y: sunMoonY } = getCelestialPosition(hour);
  return {
    hourAngle: hour,
    isDaytime: phase !== 'night',
    sunMoonX,
    sunMoonY,
    moonPhase: getMoonPhase(new Date()),
    season,
    skyPhase: phase,
    southern,
  };
}

// ---------------------------------------------------------------------------
// Pill-group button helper
// ---------------------------------------------------------------------------
function PillGroup<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: T[];
  value: T;
  label: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sandbox component
// ---------------------------------------------------------------------------
export default function SkySceneSandbox() {
  const [season, setSeason]     = useState<Season>('summer');
  const [phase, setPhase]       = useState<SkyPhase>('midday');
  const [southern, setSouthern] = useState(false);

  const scene = buildScene(season, phase, southern);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Preview any season and time-of-day combination without affecting your own dashboard.
      </p>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Season */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">Season</span>
          <PillGroup
            options={SEASONS}
            value={season}
            label={s => SEASON_LABEL[s]}
            onChange={setSeason}
          />
        </div>

        {/* Sky phase */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">Time of day</span>
          <PillGroup
            options={PHASES}
            value={phase}
            label={p => PHASE_LABEL[p]}
            onChange={setPhase}
          />
        </div>

        {/* Southern hemisphere toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">Hemisphere</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={southern}
              onClick={() => setSouthern(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                southern ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                  southern ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Southern Hemisphere
            </span>
          </label>
        </div>
      </div>

      {/* Live preview */}
      <DashboardSkyScene scene={scene} />
    </div>
  );
}
