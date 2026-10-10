import { abs, type C } from './lib/three'

export interface Vec { label: string; v: C; kind: 'V' | 'I' }

/** Phasor diagram: voltages scaled to the outer ring, currents to 70 % of it (separate scales). */
export default function Phasor({ vecs, label }: { vecs: Vec[]; label: string }) {
  const S = 360
  const R = S / 2 - 34
  const maxOf = (k: 'V' | 'I') => Math.max(1e-9, ...vecs.filter((v) => v.kind === k).map((v) => abs(v.v)))
  const sc = { V: R / maxOf('V'), I: (R * 0.7) / maxOf('I') }
  const col = { V: ['#2563eb', '#d97706', '#dc2626'], I: ['#1d4ed8', '#b45309', '#b91c1c'] }
  const pos = (v: Vec) => [S / 2 + v.v.re * sc[v.kind], S / 2 - v.v.im * sc[v.kind]] as const
  const idx = (v: Vec) => vecs.filter((x) => x.kind === v.kind).indexOf(v)
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={label}>
      <defs>
        {[0, 1, 2, 3].map((i) => (
          <marker key={i} id={`ah${i}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="context-stroke" />
          </marker>
        ))}
      </defs>
      <rect width={S} height={S} rx="8" fill="var(--chart-bg)" stroke="var(--line)" />
      {[0.35, 0.7, 1].map((f) => <circle key={f} cx={S / 2} cy={S / 2} r={R * f} fill="none" stroke="var(--grid)" />)}
      <line x1={S / 2 - R - 12} x2={S / 2 + R + 12} y1={S / 2} y2={S / 2} stroke="var(--grid-strong)" />
      <line y1={S / 2 - R - 12} y2={S / 2 + R + 12} x1={S / 2} x2={S / 2} stroke="var(--grid-strong)" />
      {vecs.map((v) => {
        const [x, y] = pos(v)
        const color = col[v.kind][idx(v) % 3]
        const dx = x - S / 2, dy = y - S / 2
        const L = Math.hypot(dx, dy) || 1
        return (
          <g key={v.label + v.kind}>
            <line x1={S / 2} y1={S / 2} x2={x} y2={y} stroke={color} strokeWidth={v.kind === 'V' ? 2 : 3} strokeDasharray={v.kind === 'V' ? '' : ''} markerEnd="url(#ah0)" opacity={v.kind === 'V' ? 0.75 : 1} />
            <text x={x + (dx / L) * 12} y={y + (dy / L) * 12 + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={color}>{v.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
