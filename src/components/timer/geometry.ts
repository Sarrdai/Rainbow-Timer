export type TimeUnit = 'hr' | 'min' | 'sec';

export const SIZE = 320;
export const CENTER = SIZE / 2;
export const DIAL_RADIUS = SIZE / 2 - 40;
export const RAINBOW_OUTER_RADIUS = DIAL_RADIUS + 0.5;
export const INNER_WHITE_RADIUS = RAINBOW_OUTER_RADIUS * 0.47;
export const LABEL_RADIUS = DIAL_RADIUS + 20;
export const TICK_START_RADIUS = DIAL_RADIUS - 8;
export const TICK_END_RADIUS = DIAL_RADIUS;
export const HUB_RADIUS = 40;
export const KNOB_RADIUS = 8.5;
export const KNOB_ACTIVE_RADIUS = 11;

// Rainbow bands, rendered from inside out (violet → red); colors come from CSS variables
export const RING_COUNT = 7;
export const BAND_WIDTH = (RAINBOW_OUTER_RADIUS - INNER_WHITE_RADIUS) / RING_COUNT;
export const RING_RADII = Array.from({ length: RING_COUNT }, (_, i) => INNER_WHITE_RADIUS + i * BAND_WIDTH + BAND_WIDTH / 2);
export const ringColor = (i: number) => `var(--ring-${i})`;
// Dial numbers cycle red, orange, yellow, green, blue, indigo, violet
export const labelColor = (i: number) => `var(--label-${i % RING_COUNT})`;

export const MAX_TIME_MS: Record<TimeUnit, number> = {
    hr: 12 * 60 * 60 * 1000,
    min: 60 * 60 * 1000,
    sec: 60 * 1000,
};

/** Step used for snapping and keyboard input per unit */
export const SNAP_UNIT_MS: Record<TimeUnit, number> = {
    hr: 5 * 60 * 1000,
    min: 60 * 1000,
    sec: 1000,
};

export const polarToCartesian = (radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
        x: CENTER + radius * Math.cos(angleInRadians),
        y: CENTER + radius * Math.sin(angleInRadians),
    };
};

export const angleToMs = (angle: number, unit: TimeUnit) => (angle / 360) * MAX_TIME_MS[unit];
export const msToAngle = (ms: number, unit: TimeUnit) => (ms / MAX_TIME_MS[unit]) * 360;

/** Snap an angle to the unit's step (5 min / 1 min / 1 s) */
export const snapAngle = (angle: number, unit: TimeUnit) => {
    const step = SNAP_UNIT_MS[unit];
    const rounded = Math.round(angleToMs(angle, unit) / step) * step;
    return rounded > 0 ? msToAngle(rounded, unit) : 0;
};

const pad = (n: number) => n.toString().padStart(2, '0');

/** Remaining time as m:ss, or h:mm:ss from one hour */
export const formatClock = (ms: number) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** Value shown in the hub while setting the time */
export const formatSetValue = (ms: number, unit: TimeUnit): { value: string; unit: string } => {
    if (unit === 'hr') {
        const totalMin = Math.round(ms / 60000);
        return { value: `${Math.floor(totalMin / 60)}:${pad(totalMin % 60)}`, unit: 'h' };
    }
    if (unit === 'min') return { value: `${Math.round(ms / 60000)}`, unit: 'min' };
    return { value: `${Math.round(ms / 1000)}`, unit: 'sec' };
};

/** Screen-reader text, e.g. "16 minutes 42 seconds" */
export const formatSpoken = (ms: number) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts: string[] = [];
    if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
    if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
    if (s || parts.length === 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
    return parts.join(' ');
};
