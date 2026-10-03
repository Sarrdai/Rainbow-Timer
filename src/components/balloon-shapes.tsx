import { useId, type ReactNode } from 'react';
import { RAINBOW_COLORS } from './confetti';

/*
 * Balloon shapes for the party decoration. Every shape is drawn in the same 100×300 box as the classic
 * balloon: the body sits at the top and the string hangs from below it to the bottom edge, so popping,
 * the falling string and the float-in work the same for all of them.
 */

export const BALLOON_COLORS = ['#e81416', '#ffa500', '#79c314', '#487de7', '#70369d', '#faeb36'];

const INK = '#2d1b3d';
const PINK = '#ff9ec8';
const BLUSH = '#ff6fa5';
const GOLD = '#ffc94d';
const GOLD_DARK = '#e6a417';
const STRING = 'hsl(var(--muted-foreground))';
const ROUND = 'M50 4 C82 4 96 30 96 58 C96 90 70 110 53 113 L47 113 C30 110 4 90 4 58 C4 30 18 4 50 4 Z';
const HEART = 'M50 108 C22 88 4 68 4 42 C4 21 18 8 34 8 C43 8 48 13 50 21 C52 13 57 8 66 8 C82 8 96 21 96 42 C96 68 78 88 50 108 Z';

interface BodyProps { color: string }

export interface BalloonShape {
    Body: (props: BodyProps) => ReactNode;
    /** String path, from where it is tied on down to the bottom of the box */
    string: string;
    /** Main color of shapes that ignore the balloon color (used for the pop shards) */
    fixedColor?: string;
}

/** The classic wavy string from `top` down to the bottom edge, stretched to the free length. */
function stringPath(top: number) {
    const y = (dy: number) => Math.round((top + ((300 - top) * dy) / 182) * 10) / 10;
    return `M50 ${top} C 40 ${y(32)}, 62 ${y(62)}, 48 ${y(97)} S 56 ${y(152)}, 50 300`;
}

/** Flat two-tone shading like the classic balloon: a darker crescent at the lower right, the lit part offset up-left. */
export function Shade({ fill, dark = 0.14, outline, offset = [-5, -4], children }: { fill: string; dark?: number; outline?: string; offset?: readonly [number, number]; children: ReactNode }) {
    const id = `balloon-${useId().replace(/[^\w-]/g, '')}`;
    return (
        <>
            <clipPath id={id}>{children}</clipPath>
            {outline && <g fill={outline} stroke={outline} strokeWidth={4} strokeLinejoin="round">{children}</g>}
            <g fill={fill}>{children}</g>
            <g fill="#000" opacity={dark}>{children}</g>
            <g clipPath={`url(#${id})`}>
                <g fill={fill} transform={`translate(${offset[0]} ${offset[1]})`}>{children}</g>
            </g>
        </>
    );
}

const line = (d: string, width = 2.2, color = INK, opacity = 1) => (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
);
export const shine = (x: number, y: number, rx: number, ry: number, rot = -30, opacity = 0.45) => (
    <ellipse cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${rot} ${x} ${y})`} fill="#fff" opacity={opacity} />
);
const eye = (x: number, y: number, rx = 4.5, ry = rx * 1.3) => (
    <>
        <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} />
        <circle cx={x + rx * 0.35} cy={y - ry * 0.4} r={rx * 0.38} fill="#fff" />
    </>
);
const eyes = (x1: number, x2: number, y: number, rx?: number, ry?: number) => <>{eye(x1, y, rx, ry)}{eye(x2, y, rx, ry)}</>;
/** Closed, smiling eyes with a lash at the outer corners */
const happyEyes = (x1: number, x2: number, y: number, w = 6) =>
    line(`M${x1 - w} ${y} Q${x1} ${y + w} ${x1 + w} ${y} M${x2 - w} ${y} Q${x2} ${y + w} ${x2 + w} ${y} M${x1 - w} ${y} l-3.5 -3 M${x2 + w} ${y} l3.5 -3`, 2.6);
const blush = (x1: number, x2: number, y: number, rx = 6, ry = 3.5, opacity = 0.5) => (
    <g fill={BLUSH} opacity={opacity}>
        <ellipse cx={x1} cy={y} rx={rx} ry={ry} />
        <ellipse cx={x2} cy={y} rx={rx} ry={ry} />
    </g>
);
const horn = (d: string, round: number, stripes: string, stripeWidth: number) => (
    <>
        <path d={d} fill={GOLD} stroke={GOLD} strokeWidth={round} strokeLinejoin="round" />
        {line(stripes, stripeWidth, GOLD_DARK)}
    </>
);
/** Tied-off neck of a latex balloon */
const knot = (color: string, y: number) => <path d={`M44 ${y + 7} L50 ${y - 2} L56 ${y + 7} Z`} fill={color} />;
/** Valve of a foil balloon */
const valve = (color: string, y: number) => (
    <>
        <rect x={47} y={y - 3} width={6} height={9} rx={2} fill={color} />
        <rect x={47} y={y - 3} width={6} height={9} rx={2} fill="#000" opacity={0.2} />
    </>
);

function Classic({ color }: BodyProps) {
    return (
        <>
            <path d={ROUND} fill={color} />
            <path d="M50 4 C82 4 96 30 96 58 C96 90 70 110 53 113 C78 96 88 70 84 44 C80 22 68 8 50 4 Z" fill="#000" opacity={0.14} />
            <ellipse cx="31" cy="34" rx="8" ry="16" transform="rotate(-24 31 34)" fill="#fff" opacity={0.45} />
            {knot(color, 113)}
        </>
    );
}

function Heart({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}><path d={HEART} /></Shade>
            {shine(25, 30, 7, 13, -35)}
            {shine(40, 19, 2.6, 2.6, 0, 0.6)}
            {valve(color, 108)}
        </>
    );
}

function HeartFace({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}><path d={HEART} /></Shade>
            {shine(25, 30, 7, 13, -35)}
            {eyes(38, 62, 50)}
            {blush(28, 72, 61, 6, 3.5, 0.55)}
            {line('M44 61 Q50 67 56 61', 2.4)}
            {valve(color, 108)}
        </>
    );
}

/** Three small hearts tied to one string, in the balloon color and two others */
function HeartTrio({ color }: BodyProps) {
    const i = Math.max(0, BALLOON_COLORS.indexOf(color));
    const small = (x: number, y: number, s: number, fill: string) => (
        <>
            <Shade fill={fill}><path d={HEART} transform={`translate(${x} ${y}) scale(${s})`} /></Shade>
            {shine(x + 25 * s, y + 30 * s, 7 * s, 13 * s, -35)}
        </>
    );
    return (
        <>
            <path d="M22 55 Q30 92 50 116 M78 55 Q70 92 50 116 M50 83 L50 116" fill="none" stroke={STRING} strokeWidth={1.4} opacity={0.7} />
            {small(0, 8, 0.44, BALLOON_COLORS[(i + 2) % BALLOON_COLORS.length])}
            {small(56, 8, 0.44, BALLOON_COLORS[(i + 4) % BALLOON_COLORS.length])}
            {small(25, 30, 0.5, color)}
        </>
    );
}

/** Rainbow curls as [x, y, radius, RAINBOW_COLORS index] */
const curls = (list: number[][]) => list.map(([x, y, r, k]) => <circle key={k} cx={x} cy={y} r={r} fill={RAINBOW_COLORS[k]} />);
const UNICORN_MANE = [[13, 58, 9, 3], [10, 71, 9, 4], [11, 84, 8.5, 5], [15, 97, 8, 6]];
const UNICORN_FORELOCK = [[22, 51, 8, 2], [32, 44, 8, 1], [42, 39, 8, 0]];
const UNICORN_WHITE = '#fdf8ff';
const UNICORN_EDGE = '#d9c8ee';

function UnicornHead() {
    return (
        <>
            {curls(UNICORN_MANE)}
            <Shade fill={UNICORN_WHITE} dark={0.06} outline={UNICORN_EDGE}>
                <path d="M26 50 C22 36 24 22 30 12 C38 20 44 30 44 40 Z" />
                <path d="M74 50 C78 36 76 22 70 12 C62 20 56 30 56 40 Z" />
            </Shade>
            <g fill={PINK} opacity={0.8}>
                <path d="M30 42 C28 34 29 26 32 20 C36 25 39 31 39 37 Z" />
                <path d="M70 42 C72 34 71 26 68 20 C64 25 61 31 61 37 Z" />
            </g>
            <Shade fill={UNICORN_WHITE} dark={0.06} outline={UNICORN_EDGE}>
                <path d="M50 34 C74 34 88 50 88 70 C88 94 72 112 50 112 C28 112 12 94 12 70 C12 50 26 34 50 34 Z" />
            </Shade>
            {curls(UNICORN_FORELOCK)}
            {horn('M44 37 L50 3 L56 37 Z', 3, 'M45.5 30 L55 26.5 M46.8 22 L53.8 19.4 M48.1 14 L52.4 12.4', 2)}
            {happyEyes(36, 64, 69)}
            {blush(29, 71, 81, 6, 3.5, 0.55)}
            <ellipse cx={50} cy={96} rx={22} ry={13} fill="#f7d4ec" />
            <g fill="#d98bb8">
                <ellipse cx={43} cy={96} rx={2.2} ry={3} />
                <ellipse cx={57} cy={96} rx={2.2} ry={3} />
            </g>
            {valve('#e9dcf5', 112)}
        </>
    );
}

const PASTEL_FORELOCK = [[43, 28, '#ff8fab'], [37, 31, '#ffd166'], [31, 35, '#9be564'], [26, 40, '#7cc6fe'], [22, 46, '#c3a1ff']] as const;

function UnicornBalloon({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>
                <path d="M20 40 C18 26 20 14 25 6 C32 12 40 20 42 30 Z" />
                <path d="M80 40 C82 26 80 14 75 6 C68 12 60 20 58 30 Z" />
            </Shade>
            <g fill={PINK} opacity={0.85}>
                <path d="M25 32 C24 24 25 17 28 12 C32 16 36 21 37 27 Z" />
                <path d="M75 32 C76 24 75 17 72 12 C68 16 64 21 63 27 Z" />
            </g>
            <Shade fill={color}><path d={ROUND} transform="translate(8 18.1) scale(0.84)" /></Shade>
            {shine(30, 60, 6, 11, -20)}
            {PASTEL_FORELOCK.map(([x, y, fill]) => <circle key={fill} cx={x} cy={y} r={5.4} fill={fill} />)}
            {horn('M44.5 27 L50 -2 L55.5 27 Z', 2.5, 'M46 20 L54.4 17 M47.4 12 L53 10', 1.8)}
            {happyEyes(37, 63, 66, 5)}
            {blush(30, 70, 76)}
            {line('M46 77 Q50 80 54 77', 2)}
            {knot(color, 113)}
        </>
    );
}

function Cat({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>
                <ellipse cx={50} cy={70} rx={42} ry={37} />
                <path d="M12 60 C10 40 12 22 17 14 C22 11 35 22 46 34 Z" />
                <path d="M88 60 C90 40 88 22 83 14 C78 11 65 22 54 34 Z" />
            </Shade>
            <g fill={PINK} opacity={0.85}>
                <path d="M19 44 C18 34 19 26 22 21 C25 21 31 26 37 32 Z" />
                <path d="M81 44 C82 34 81 26 78 21 C75 21 69 26 63 32 Z" />
            </g>
            {shine(23, 60, 5, 9, -20)}
            {eyes(36, 64, 67)}
            {blush(28, 72, 79, 5.5, 3.2)}
            <path d="M46 77 Q50 75 54 77 L50 82 Z" fill="#ff7aa8" />
            {line('M50 82 Q47 88 42 85 M50 82 Q53 88 58 85', 2)}
            {line('M29 80 L11 77 M29 85 L12 89 M71 80 L89 77 M71 85 L88 89', 1.6, INK, 0.5)}
            {knot(color, 107)}
        </>
    );
}

function Bear({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>
                <circle cx={18} cy={32} r={14} />
                <circle cx={82} cy={32} r={14} />
                <circle cx={50} cy={66} r={40} />
            </Shade>
            <g fill="#fff" opacity={0.35}>
                <circle cx={18} cy={32} r={7} />
                <circle cx={82} cy={32} r={7} />
            </g>
            {shine(29, 44, 6, 10, -35)}
            <ellipse cx={50} cy={82} rx={18} ry={13} fill="#fff" opacity={0.5} />
            {eyes(35, 65, 61)}
            {blush(26, 74, 73)}
            <ellipse cx={50} cy={77} rx={6} ry={4.5} fill={INK} />
            {line('M50 81.5 V86 M44 87 Q50 92 56 87', 2)}
            {knot(color, 106)}
        </>
    );
}

function Bunny({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>
                <ellipse cx={34} cy={30} rx={10} ry={27} transform="rotate(-10 34 30)" />
                <ellipse cx={66} cy={30} rx={10} ry={27} transform="rotate(10 66 30)" />
                <ellipse cx={50} cy={75} rx={37} ry={32} />
            </Shade>
            <g fill={PINK} opacity={0.85}>
                <ellipse cx={34} cy={29} rx={4.8} ry={18} transform="rotate(-10 34 29)" />
                <ellipse cx={66} cy={29} rx={4.8} ry={18} transform="rotate(10 66 29)" />
            </g>
            {shine(27, 60, 5, 8, -35)}
            {eyes(38, 62, 72)}
            {blush(28, 72, 82)}
            <rect x={47} y={86} width={6} height={6} rx={1.5} fill="#fff" stroke={INK} strokeWidth={1} />
            <ellipse cx={50} cy={82} rx={4.5} ry={3.2} fill="#ff7aa8" />
            {line('M50 85 Q46 90 42 87 M50 85 Q54 90 58 87', 2)}
            {knot(color, 107)}
        </>
    );
}

function Frog({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>
                <circle cx={28} cy={42} r={17} />
                <circle cx={72} cy={42} r={17} />
                <ellipse cx={50} cy={74} rx={44} ry={32} />
            </Shade>
            {shine(20, 68, 5, 8, -40)}
            <g fill="#fff">
                <circle cx={28} cy={40} r={10.5} />
                <circle cx={72} cy={40} r={10.5} />
            </g>
            <g fill={INK}>
                <circle cx={29} cy={42} r={5.5} />
                <circle cx={71} cy={42} r={5.5} />
            </g>
            <g fill="#fff">
                <circle cx={31} cy={40} r={1.8} />
                <circle cx={73} cy={40} r={1.8} />
            </g>
            <g fill={INK} opacity={0.55}>
                <circle cx={45} cy={67} r={1.4} />
                <circle cx={55} cy={67} r={1.4} />
            </g>
            {blush(20, 80, 80)}
            {line('M28 79 Q50 97 72 79', 2.6)}
            {knot(color, 106)}
        </>
    );
}

const PIG = '#ff9cc6';
const PIG_DARK = '#f06aa5';

function Pig() {
    return (
        <>
            <Shade fill={PIG} dark={0.1}>
                <path d="M18 50 C12 34 14 20 20 12 C28 16 38 24 42 34 Z" />
                <path d="M82 50 C88 34 86 20 80 12 C72 16 62 24 58 34 Z" />
                <ellipse cx={50} cy={70} rx={42} ry={38} />
            </Shade>
            <g fill={PIG_DARK} opacity={0.55}>
                <path d="M22 40 C20 32 21 24 24 19 C29 22 34 27 36 32 Z" />
                <path d="M78 40 C80 32 79 24 76 19 C71 22 66 27 64 32 Z" />
            </g>
            {shine(30, 48, 6, 10, -35)}
            {eyes(34, 66, 62)}
            {blush(24, 76, 78, 6, 3.5, 0.45)}
            <ellipse cx={50} cy={80} rx={16} ry={11.5} fill="#ff7fb6" stroke={PIG_DARK} strokeWidth={1.5} />
            <g fill="#c2457a">
                <ellipse cx={44} cy={80} rx={2.6} ry={4} />
                <ellipse cx={56} cy={80} rx={2.6} ry={4} />
            </g>
            {line('M45 96 Q50 99 55 96', 1.8)}
            {knot(PIG, 108)}
        </>
    );
}

const PANDA_BLACK = '#33283f';
const PANDA_WHITE = '#fdfbff';

function Panda() {
    return (
        <>
            <Shade fill={PANDA_BLACK}>
                <circle cx={17} cy={34} r={13} />
                <circle cx={83} cy={34} r={13} />
            </Shade>
            <g fill="#fff" opacity={0.18}>
                <circle cx={15} cy={31} r={5} />
                <circle cx={81} cy={31} r={5} />
            </g>
            <Shade fill={PANDA_WHITE} dark={0.07} outline="#d6cde3"><ellipse cx={50} cy={68} rx={42} ry={38} /></Shade>
            <g fill={PANDA_BLACK}>
                <ellipse cx={34} cy={64} rx={10} ry={13.5} transform="rotate(30 34 64)" />
                <ellipse cx={66} cy={64} rx={10} ry={13.5} transform="rotate(-30 66 64)" />
            </g>
            <g fill="#fff">
                <circle cx={35} cy={62} r={4.3} />
                <circle cx={65} cy={62} r={4.3} />
            </g>
            <g fill={PANDA_BLACK}>
                <circle cx={35.6} cy={62.6} r={2.6} />
                <circle cx={64.4} cy={62.6} r={2.6} />
            </g>
            {blush(23, 77, 79, 6, 3.5, 0.55)}
            <ellipse cx={50} cy={79} rx={5.5} ry={3.8} fill={PANDA_BLACK} />
            {line('M50 82.5 Q46 88 42 85.5 M50 82.5 Q54 88 58 85.5', 2, PANDA_BLACK)}
            {knot(PANDA_WHITE, 106)}
        </>
    );
}

const LION_FACE = '#ffe2a6';
const LION_EDGE = '#f2b955';
/** Scalloped mane: twelve puffs around a filled center */
const LION_MANE = [
    ...Array.from({ length: 12 }, (_, k) => (
        <circle key={k} cx={Math.round((50 + 35 * Math.cos((k * Math.PI) / 6)) * 10) / 10} cy={Math.round((64 + 35 * Math.sin((k * Math.PI) / 6)) * 10) / 10} r={13} />
    )),
    <circle key="center" cx={50} cy={64} r={36} />,
];

function Lion({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>{LION_MANE}</Shade>
            {shine(20, 36, 5, 9, -40)}
            <g fill={LION_FACE} stroke={LION_EDGE} strokeWidth={1.5}>
                <circle cx={31} cy={41} r={8} />
                <circle cx={69} cy={41} r={8} />
            </g>
            <g fill={LION_EDGE}>
                <circle cx={31} cy={41} r={4} />
                <circle cx={69} cy={41} r={4} />
            </g>
            <Shade fill={LION_FACE} dark={0.08} outline={LION_EDGE}><circle cx={50} cy={66} r={30} /></Shade>
            <g fill="#fff" opacity={0.65}>
                <ellipse cx={44} cy={78} rx={8} ry={6} />
                <ellipse cx={56} cy={78} rx={8} ry={6} />
            </g>
            {eyes(39, 61, 60, 4)}
            {blush(31, 69, 72, 5, 3)}
            <path d="M44 70 Q50 67 56 70 Q54 76 50 77 Q46 76 44 70 Z" fill="#8a4b2a" />
            {line('M50 77 Q47 84 42 81 M50 77 Q53 84 58 81', 2)}
            {knot(color, 112)}
        </>
    );
}

/** Twisted modelling-balloon segments as [x1, y1, x2, y2, width, on the far side], in paint order */
const DOG: [number, number, number, number, number, boolean][] = [
    [33, 70, 37, 101, 12, true], [67, 70, 73, 100, 12, true], [33, 66, 15, 46, 11, false],
    [33, 68, 67, 68, 18, false], [33, 70, 25, 100, 13, false], [67, 70, 61, 101, 13, false],
    [73, 38, 67, 15, 11, true], [67, 66, 73, 40, 14, false], [73, 38, 60, 21, 12, false], [73, 38, 91, 41, 14, false],
];
const DOG_SEGMENTS = DOG.map(([x1, y1, x2, y2, w, far]) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    // The highlight runs along the upper side of the segment
    const flip = x2 - x1 < 0 ? -1 : 1;
    const [nx, ny] = [(flip * (y2 - y1)) / len, (-flip * (x2 - x1)) / len];
    const at = (f: number) => `${(x1 + (x2 - x1) * f + nx * w * 0.22).toFixed(1)} ${(y1 + (y2 - y1) * f + ny * w * 0.22).toFixed(1)}`;
    return {
        rect: { x: x1 - w / 2, y: y1 - w / 2, width: len + w, height: w, rx: w / 2, transform: `rotate(${angle.toFixed(1)} ${x1} ${y1})` },
        shine: `M${at(0.1)} L${at(0.75)}`,
        shineWidth: w * 0.2,
        far,
    };
});

function BalloonDog({ color }: BodyProps) {
    return (
        <>
            {DOG_SEGMENTS.map((s, i) => (
                <g key={i}>
                    <rect {...s.rect} fill={color} stroke="#000" strokeOpacity={0.22} strokeWidth={1.3} />
                    {s.far && <rect {...s.rect} fill="#000" opacity={0.14} />}
                    <path d={s.shine} stroke="#fff" strokeWidth={s.shineWidth} strokeLinecap="round" opacity={0.45} />
                </g>
            ))}
            <circle cx={79} cy={35} r={2.3} fill={INK} />
            <circle cx={95.5} cy={41.5} r={3} fill={INK} />
        </>
    );
}

function Fish({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}>
                <path d="M26 62 C16 50 8 42 4 36 C9 52 9 72 4 88 C8 82 16 74 26 62 Z" />
                <path d="M40 40 C46 24 62 22 72 38 Z" />
                <ellipse cx={52} cy={62} rx={36} ry={27} />
            </Shade>
            {line('M46 40 Q56 62 46 84 M58 37 Q68 62 58 87', 4, '#fff', 0.3)}
            {shine(32, 52, 4.5, 8, -40)}
            <circle cx={72} cy={55} r={7.5} fill="#fff" />
            <circle cx={73.5} cy={56} r={4} fill={INK} />
            <circle cx={75} cy={54.3} r={1.4} fill="#fff" />
            <ellipse cx={70} cy={69} rx={5} ry={3} fill={BLUSH} opacity={0.5} />
            {line('M86 66 Q82 70 78 68', 2)}
            {knot(color, 89)}
        </>
    );
}

/** Polygon whose corners are cut at fraction t (outer, inner) of their edges and bridged by a curve */
function roundedPolygon(points: number[][], t: [number, number]) {
    const lerp = (a: number[], b: number[], f: number) => `${(a[0] + (b[0] - a[0]) * f).toFixed(1)} ${(a[1] + (b[1] - a[1]) * f).toFixed(1)}`;
    return points.map((p, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        return `${i ? 'L' : 'M'}${lerp(p, prev, t[i % 2])} Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${lerp(p, next, t[i % 2])}`;
    }).join(' ') + ' Z';
}
const STAR_POINTS = Array.from({ length: 10 }, (_, k) => {
    const a = ((-90 + k * 36) * Math.PI) / 180;
    const r = k % 2 ? 23 : 48;
    return [50 + r * Math.cos(a), 62 + r * Math.sin(a)];
});
const STAR = roundedPolygon(STAR_POINTS, [0.2, 0.12]);
/** Foil creases from the center toward each tip */
const STAR_CREASES = STAR_POINTS.filter((_, k) => k % 2 === 0)
    .map(([x, y]) => `M50 62 L${(50 + (x - 50) * 0.78).toFixed(1)} ${(62 + (y - 62) * 0.78).toFixed(1)}`).join(' ');

function Star({ color }: BodyProps) {
    return (
        <>
            <Shade fill={color}><path d={STAR} /></Shade>
            {line(STAR_CREASES, 1.5, '#fff', 0.22)}
            {shine(46, 34, 3, 7, -15)}
            {valve(color, 86)}
        </>
    );
}

const shape = (Body: BalloonShape['Body'], stringTop: number, fixedColor?: string): BalloonShape => ({ Body, string: stringPath(stringTop), fixedColor });

export const CLASSIC_BALLOON = shape(Classic, 118);

/** Hearts, unicorns, animals and a star; shapes with a fixed color ignore the balloon color */
export const SHAPED_BALLOONS: BalloonShape[] = [
    shape(Heart, 113), shape(HeartFace, 113), shape(HeartTrio, 116),
    shape(UnicornHead, 117, '#c3a1ff'), shape(UnicornBalloon, 118),
    shape(Cat, 112), shape(Bear, 111), shape(Bunny, 112), shape(Frog, 111),
    shape(Pig, 113, PIG), shape(Panda, 111, PANDA_BLACK), shape(Lion, 117),
    shape(BalloonDog, 77), shape(Fish, 94), shape(Star, 91),
];
