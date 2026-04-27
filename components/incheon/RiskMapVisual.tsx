type RiskMapVisualProps = {
  variant?: 'hero' | 'panel' | 'mini'
  className?: string
  showLegend?: boolean
  showRadiusLabel?: boolean
}

const MAP_SIZE = { width: 1024, height: 820 }
const CENTER = { x: 524, y: 414 }
const HEX_RADIUS = 16.5

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 })
    .map((_, index) => {
      const angle = (Math.PI / 180) * (60 * index - 30)
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
    })
    .join(' ')
}

const HEX_CELLS = Array.from({ length: 27 }).flatMap((_, row) =>
  Array.from({ length: 35 }).map((__, col) => {
    const x = -34 + col * 35 + (row % 2 ? 17.5 : 0)
    const y = 48 + row * 30
    const distance = Math.hypot(x - CENTER.x, y - CENTER.y)
    const core = Math.max(0, 1 - Math.hypot(x - CENTER.x, y - CENTER.y) / 132)
    const halo = Math.max(0, 1 - distance / 350)
    const northHot = Math.max(0, 1 - Math.hypot(x - 564, y - 282) / 190)
    const southWarm = Math.max(0, 1 - Math.hypot(x - 476, y - 520) / 210)
    const westCool = Math.max(0, 1 - Math.hypot(x - 350, y - 432) / 260)
    const heat = core * 0.92 + halo * 0.48 + northHot * 0.18 + southWarm * 0.16 + westCool * 0.08
    const fill =
      heat > 0.94
        ? '#FF5635'
        : heat > 0.76
          ? '#FF8A1F'
          : heat > 0.6
          ? '#FDBA3B'
          : heat > 0.46
            ? '#4ED276'
            : heat > 0.32
              ? '#20C7E8'
              : '#0B66FF'
    return {
      id: `${row}-${col}`,
      x,
      y,
      opacity: distance < 396 ? Math.max(0.08, 0.18 + Math.min(1, heat) * 0.7) : 0.045,
      strokeOpacity: distance < 360 ? 0.52 : 0.1,
      fill,
    }
  })
)

const ROAD_LINES = [
  '-10,530 106,474 228,450 352,394 480,370 612,318 748,262 1036,184',
  '-18,270 128,302 266,336 420,370 574,410 722,482 890,548 1040,580',
  '26,692 166,632 328,586 490,536 672,496 838,412 1050,360',
  '178,-20 226,132 278,274 352,438 420,644 472,848',
  '618,-16 574,120 536,252 516,370 496,546 462,834',
  '890,-12 846,126 814,276 764,430 722,562 694,846',
  '58,158 228,206 390,232 574,260 782,292 1038,306',
  '108,804 284,720 448,662 626,626 816,628 1048,682',
  '36,410 186,416 360,424 540,448 724,460 1012,486',
]

const MINOR_ROAD_LINES = [
  '38,92 190,142 354,194 538,226 710,274 1018,350',
  '18,396 194,402 374,410 560,438 744,456 1018,494',
  '36,604 204,562 402,530 584,512 762,478 1012,422',
  '278,-8 332,130 398,268 438,426 506,608 558,824',
  '742,-8 716,124 686,258 658,418 624,616 590,822',
  '156,318 342,294 504,286 684,298 910,318',
  '88,736 230,662 360,620 512,594 714,568 956,572',
  '8,184 158,246 270,308 382,420 502,560 622,716',
  '996,92 906,206 822,322 752,446 676,592',
  '20,492 180,530 328,558 480,596 674,676 820,752',
  '126,28 190,170 232,312 298,512 344,810',
  '482,0 464,148 436,304 408,470 374,812',
  '18,720 150,672 286,642 440,620 590,600 766,598',
]

const BLOCKS = [
  ['70,112 184,84 236,160 126,214', 0.2],
  ['250,126 404,92 458,188 316,238', 0.22],
  ['702,92 888,52 960,166 796,230', 0.22],
  ['76,350 230,312 296,424 148,482', 0.2],
  ['762,392 946,374 990,492 816,540', 0.23],
  ['226,592 392,538 450,688 288,744', 0.2],
  ['612,558 796,532 856,690 672,744', 0.22],
] as const

const BUILDING_LOTS = Array.from({ length: 26 }).flatMap((_, row) =>
  Array.from({ length: 32 }).map((__, col) => {
    const x = 28 + col * 34 + ((row * 7 + col * 3) % 11)
    const y = 34 + row * 29 + ((row * 5 + col * 2) % 9)
    const distance = Math.hypot(x - CENTER.x, y - CENTER.y)
    return {
      id: `${row}-${col}`,
      x,
      y,
      width: 10 + ((row + col) % 4) * 4,
      height: 5 + ((row * 2 + col) % 4) * 4,
      opacity: distance < 520 ? 0.1 + Math.max(0, 1 - distance / 520) * 0.2 : 0.05,
    }
  })
)

export default function RiskMapVisual({
  variant = 'panel',
  className = '',
  showLegend = true,
  showRadiusLabel = true,
}: RiskMapVisualProps) {
  const isHero = variant === 'hero'
  const isMini = variant === 'mini'
  const rootClass = isHero
    ? `absolute inset-0 overflow-hidden bg-[#03162E] ${className}`
    : `relative overflow-hidden border border-[#1B6CB7] bg-[#041C3C] shadow-[0_0_0_1px_rgba(74,179,255,0.1),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_34px_rgba(26,127,213,0.2)] ${
        isMini ? 'min-h-[210px]' : 'min-h-[420px] lg:min-h-[635px]'
      } ${className}`

  return (
    <section className={rootClass} aria-label="500m 반경 위험도 지도">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="incheon-map-heat" cx="50%" cy="50%" r="45%">
            <stop offset="0%" stopColor="#FF4F2C" stopOpacity="0.76" />
            <stop offset="18%" stopColor="#FF8A1F" stopOpacity="0.62" />
            <stop offset="34%" stopColor="#F6C636" stopOpacity="0.5" />
            <stop offset="52%" stopColor="#17C9E8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#03162E" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="incheon-map-water" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#0E5E99" stopOpacity="0.28" />
            <stop offset="52%" stopColor="#20C7E8" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#082A57" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="incheon-map-pin" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE0A1" />
            <stop offset="48%" stopColor="#FF9E2C" />
            <stop offset="100%" stopColor="#FF5B1D" />
          </linearGradient>
          <filter id="incheon-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="0 0 0 0 0.12 0 0 0 0 0.78 0 0 0 0 1 0 0 0 0.75 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pin-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              result="glow"
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 0.42 0 0 0 0 0.08 0 0 0 0.82 0"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="map-texture" x="0" y="0" width="100%" height="100%">
            <feTurbulence baseFrequency="0.72" numOctaves="3" seed="17" type="fractalNoise" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA tableValues="0 0.08" type="table" />
            </feComponentTransfer>
          </filter>
        </defs>

        <rect width={MAP_SIZE.width} height={MAP_SIZE.height} fill="#020D1F" />
        <path
          d="M-36 104 C42 56 114 52 176 80 C238 110 282 138 350 112 C418 86 448 28 520 -8 L796 -8 L796 142 C704 162 626 150 540 112 C454 74 410 92 348 134 C272 184 210 170 142 132 C78 96 28 126 -36 178 Z"
          fill="url(#incheon-map-water)"
        />
        <path
          d="M-22 584 C82 540 144 522 220 548 C304 574 380 620 496 606 C610 592 690 544 786 586 L786 660 L-22 660 Z"
          fill="#062D55"
          opacity="0.45"
        />

        {BLOCKS.map(([points, opacity]) => (
          <polygon key={points} points={points} fill="#0C3D71" opacity={opacity} stroke="#2A80C8" strokeOpacity="0.16" />
        ))}

        <g opacity="0.62" transform={`rotate(-13 ${CENTER.x} ${CENTER.y})`}>
          {BUILDING_LOTS.map((lot) => (
            <rect
              key={lot.id}
              x={lot.x}
              y={lot.y}
              width={lot.width}
              height={lot.height}
              fill="#4DA8E9"
              opacity={lot.opacity}
            />
          ))}
        </g>

        <g opacity="0.78">
          {ROAD_LINES.map((points) => (
            <polyline
              key={points}
              points={points}
              fill="none"
              stroke="#155891"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeOpacity="0.38"
              strokeWidth="11"
            />
          ))}
          {ROAD_LINES.map((points) => (
            <polyline
              key={`${points}-core`}
              points={points}
              fill="none"
              stroke="#39C9FF"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeOpacity="0.5"
              strokeWidth="2.2"
            />
          ))}
        </g>

        <g opacity="0.32">
          {MINOR_ROAD_LINES.map((points) => (
            <polyline
              key={points}
              points={points}
              fill="none"
              stroke="#61C8FF"
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeWidth="1.25"
            />
          ))}
        </g>

        <ellipse cx={CENTER.x} cy={CENTER.y} rx="292" ry="292" fill="url(#incheon-map-heat)" opacity="0.88" />

        <g opacity={isMini ? 0.56 : 0.88}>
          {HEX_CELLS.map((cell) => (
            <polygon
              key={cell.id}
              points={hexPoints(cell.x, cell.y, HEX_RADIUS)}
              fill={cell.fill}
              fillOpacity={cell.opacity}
              stroke="#6DE6FF"
              strokeOpacity={cell.strokeOpacity}
              strokeWidth="1.05"
            />
          ))}
        </g>

        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r="318"
          fill="none"
          stroke="#74DEFF"
          strokeOpacity="0.95"
          strokeWidth="4.3"
          filter="url(#incheon-soft-glow)"
        />
        <circle cx={CENTER.x} cy={CENTER.y} r="254" fill="none" stroke="#2D8CFF" strokeOpacity="0.13" strokeWidth="1.4" />
        <circle cx={CENTER.x} cy={CENTER.y} r="116" fill="#FF7A1F" opacity="0.13" />

        <g transform={`translate(${CENTER.x - 38} ${CENTER.y - 98})`} filter="url(#pin-glow)">
          <path
            d="M38 0C17 0 0 17.2 0 38.3C0 68 38 105 38 105C38 105 76 68 76 38.3C76 17.2 59 0 38 0Z"
            fill="url(#incheon-map-pin)"
          />
          <circle cx="38" cy="38" r="16.5" fill="#FFF8E8" />
          <circle cx="38" cy="38" r="7.2" fill="#E9551B" />
          <circle cx="38" cy="103" r="10" fill="#FFCB3D" opacity="0.82" />
        </g>

        <rect width={MAP_SIZE.width} height={MAP_SIZE.height} fill="#031225" opacity={isHero ? '0.28' : '0.05'} />
        <rect width={MAP_SIZE.width} height={MAP_SIZE.height} filter="url(#map-texture)" opacity="0.55" />
        <rect
          width={MAP_SIZE.width}
          height={MAP_SIZE.height}
          fill="none"
          stroke="#56B7FF"
          strokeOpacity={isHero ? '0' : '0.58'}
          strokeWidth="3"
        />
      </svg>

      {showRadiusLabel && (
        <div className="absolute right-[9%] top-[18%] border border-[#2FB9FF]/55 bg-[#0A3A86]/92 px-3 py-1.5 text-sm font-black text-white shadow-[0_8px_26px_rgba(15,105,255,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] md:text-base">
          500m
        </div>
      )}

      {showLegend && (
        <div className="absolute bottom-7 right-6 w-44 border border-[#155396] bg-[#071D3F]/94 p-4 text-white shadow-[0_18px_44px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <h3 className="text-sm font-black">위험도 수준</h3>
          <div className="mt-3 flex gap-1">
            {['#2D8CFF', '#20C7E8', '#47D78D', '#FDBA3B', '#FFB14A', '#FF8A1F', '#FF5B1D', '#FF4B4B'].map((color) => (
              <span key={color} className="h-3.5 flex-1" style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-bold text-white/72">
            <span>위험 낮음</span>
            <span>위험 높음</span>
          </div>
        </div>
      )}

      {isHero && <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,18,37,0.98)_0%,rgba(3,18,37,0.86)_40%,rgba(3,18,37,0.18)_72%,rgba(3,18,37,0.58)_100%)]" />}
    </section>
  )
}
