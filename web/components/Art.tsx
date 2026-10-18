// Hand-drawn SVG art (no image files, no images from the internet). Every image has a text alternative (NFR-13).

export function Logo({ size = 36, title = "Luknang Arena" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} data-testid="logo">
      <title>{title}</title>
      <defs>
        <radialGradient id="lg-glow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFD54A" />
          <stop offset="100%" stopColor="#f2b400" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#1F9D55" stroke="#FFD54A" strokeWidth="3" />
      <path d="M2 32h60" stroke="#F7F7F2" strokeWidth="2" opacity="0.8" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="#F7F7F2" strokeWidth="2" opacity="0.8" />
      <circle cx="32" cy="32" r="7" fill="url(#lg-glow)" stroke="#0B3D2E" strokeWidth="1.5" />
      <path d="M32 27l4 3-1.5 4.5h-5L28 30z" fill="#0B3D2E" />
    </svg>
  );
}

/** top-down pitch: 5-a-side (A, B) or 7-a-side (C, covered with a roof) */
export function FieldArt({ id, size, covered, title }: { id: string; size: number; covered: boolean; title: string }) {
  const w = 320;
  const h = 200;
  const stripes = size === 7 ? 10 : 8;
  const inset = size === 7 ? 14 : 22;
  const gid = `fa-${id}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} data-testid={`field-art-${id}`}>
      <title>{title}</title>
      <defs>
        <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#072a20" />
          <stop offset="100%" stopColor="#0B3D2E" />
        </linearGradient>
        <radialGradient id={`${gid}-light`} cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#FFD54A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFD54A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} rx="14" fill={`url(#${gid}-sky)`} />
      {Array.from({ length: stripes }, (_, i) => (
        <rect
          key={i}
          x={inset + (i * (w - inset * 2)) / stripes}
          y={inset + 10}
          width={(w - inset * 2) / stripes}
          height={h - inset * 2 - 10}
          fill={i % 2 ? "#1F9D55" : "#23a95c"}
        />
      ))}
      <g fill="none" stroke="#F7F7F2" strokeWidth="2.2" opacity="0.92">
        <rect x={inset} y={inset + 10} width={w - inset * 2} height={h - inset * 2 - 10} />
        <line x1={w / 2} y1={inset + 10} x2={w / 2} y2={h - inset} />
        <circle cx={w / 2} cy={(h + 10) / 2} r={size === 7 ? 22 : 18} />
        <rect x={inset} y={(h + 10) / 2 - 30} width={size === 7 ? 34 : 26} height="60" />
        <rect x={w - inset - (size === 7 ? 34 : 26)} y={(h + 10) / 2 - 30} width={size === 7 ? 34 : 26} height="60" />
      </g>
      <g fill="#F7F7F2">
        <rect x={inset - 6} y={(h + 10) / 2 - 14} width="6" height="28" rx="1" />
        <rect x={w - inset} y={(h + 10) / 2 - 14} width="6" height="28" rx="1" />
        <circle cx={w / 2} cy={(h + 10) / 2} r="3" />
      </g>
      {covered ? (
        <g>
          <path d={`M6 ${inset + 6} Q ${w / 2} -18 ${w - 6} ${inset + 6}`} fill="rgba(247,247,242,0.18)" stroke="#F7F7F2" strokeWidth="2" />
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <line key={p} x1={w * p} y1={inset + 2} x2={w * p} y2={h - 6} stroke="rgba(247,247,242,0.22)" strokeWidth="2" />
          ))}
          <rect x="6" y={inset + 2} width="6" height={h - inset - 8} fill="#c9d2cd" />
          <rect x={w - 12} y={inset + 2} width="6" height={h - inset - 8} fill="#c9d2cd" />
        </g>
      ) : (
        <g>
          <rect width={w} height={h} rx="14" fill={`url(#${gid}-light)`} />
          {[18, w - 18].map((x) => (
            <g key={x}>
              <line x1={x} y1={h - 8} x2={x} y2="14" stroke="#9fb2a8" strokeWidth="3" />
              <rect x={x - 9} y="6" width="18" height="9" rx="2" fill="#FFD54A" />
            </g>
          ))}
        </g>
      )}
      <g>
        <rect x={w / 2 - 22} y="4" width="44" height="26" rx="8" fill="#0B3D2E" stroke="#FFD54A" strokeWidth="2" />
        <text x={w / 2} y="23" textAnchor="middle" fontFamily="Prompt, sans-serif" fontWeight="700" fontSize="17" fill="#FFD54A">
          {id}
        </text>
      </g>
    </svg>
  );
}

/** decorative pitch lines behind the hero */
export function PitchLines() {
  return (
    <svg className="hero-lines" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#F7F7F2" strokeWidth="3">
        <rect x="40" y="40" width="1120" height="420" />
        <line x1="600" y1="40" x2="600" y2="460" />
        <circle cx="600" cy="250" r="80" />
        <rect x="40" y="150" width="140" height="200" />
        <rect x="1020" y="150" width="140" height="200" />
        <path d="M180 200 A 60 60 0 0 1 180 300" />
        <path d="M1020 200 A 60 60 0 0 0 1020 300" />
      </g>
    </svg>
  );
}

/** sample PromptPay QR drawn from the booking code (not a real payment QR) */
export function SampleQr({ seed, title }: { seed: string; title: string }) {
  const n = 25;
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  const finder = (x: number, y: number) => x < 8 && y < 8 ? true : x >= n - 8 && y < 8 ? true : x < 8 && y >= n - 8;
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && rand() > 0.52) cells.push([x, y]);
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#0B3D2E" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0B3D2E" />
    </g>
  );
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={title} data-testid="pay-qr" shapeRendering="crispEdges">
      <title>{title}</title>
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill="#0B3D2E" />
      ))}
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
      <rect x={n / 2 - 3} y={n / 2 - 3} width="6" height="6" rx="1" fill="#1F9D55" stroke="#fff" strokeWidth="0.6" />
    </svg>
  );
}

/** v2 · chatbot "น้องบอล": a smiling football with a headset (chat button + chat header) */
export function BotAvatar({ size = 34, title }: { size?: number; title: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} data-testid="bot-avatar">
      {title && <title>{title}</title>}
      <circle cx="32" cy="34" r="24" fill="#F7F7F2" stroke="#0B3D2E" strokeWidth="2.5" />
      <path d="M32 22l7 5-2.6 8.2h-8.8L25 27z" fill="#0B3D2E" />
      <path d="M25 27l-9-2M39 27l9-2M27.6 35.2l-5 7M36.4 35.2l5 7" stroke="#0B3D2E" strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="44" r="2" fill="#0B3D2E" />
      <circle cx="38" cy="44" r="2" fill="#0B3D2E" />
      <path d="M27 50c3 2.5 7 2.5 10 0" stroke="#0B3D2E" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M8 34a24 24 0 0 1 48 0" stroke="#FFD54A" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="4" y="31" width="8" height="12" rx="3" fill="#1F9D55" stroke="#0B3D2E" strokeWidth="1.5" />
      <rect x="52" y="31" width="8" height="12" rx="3" fill="#1F9D55" stroke="#0B3D2E" strokeWidth="1.5" />
      <path d="M8 43c0 8 6 12 14 12" stroke="#0B3D2E" strokeWidth="2" fill="none" />
      <circle cx="23" cy="55" r="2.5" fill="#FFD54A" stroke="#0B3D2E" strokeWidth="1" />
    </svg>
  );
}

/** v2 · empty state for back-office lists */
export function EmptyNet({ title }: { title: string }) {
  return (
    <svg width="96" height="64" viewBox="0 0 96 64" role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="8" y="8" width="80" height="48" rx="4" fill="none" stroke="#1F9D55" strokeWidth="3" />
      <path d="M8 20h80M8 32h80M8 44h80M24 8v48M40 8v48M56 8v48M72 8v48" stroke="#1F9D55" strokeWidth="1" opacity="0.5" />
      <circle cx="48" cy="40" r="9" fill="#F7F7F2" stroke="#0B3D2E" strokeWidth="2" />
    </svg>
  );
}
