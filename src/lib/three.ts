export interface C { re: number; im: number }
export const c = (re: number, im = 0): C => ({ re, im })
export const add = (a: C, b: C): C => c(a.re + b.re, a.im + b.im)
export const sub = (a: C, b: C): C => c(a.re - b.re, a.im - b.im)
export const mul = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
export const div = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d)
}
export const conj = (a: C): C => c(a.re, -a.im)
export const abs = (a: C) => Math.hypot(a.re, a.im)
export const arg = (a: C) => (Math.atan2(a.im, a.re) * 180) / Math.PI
export const polar = (mag: number, deg: number): C => c(mag * Math.cos((deg * Math.PI) / 180), mag * Math.sin((deg * Math.PI) / 180))
export const neg = (a: C): C => c(-a.re, -a.im)

export type Conn = 'star' | 'delta'
export type Known = 'I' | 'P' | 'S'

export interface Balanced { vPhase: number; iPhase: number; iLine: number; S: number; P: number; Q: number; phiDeg: number }

/** Balanced three-phase load. `value` is line current (A), active power (W) or apparent power (VA). */
export function solveBalanced(o: { conn: Conn; vLine: number; known: Known; value: number; pf: number; leading: boolean }): Balanced {
  const { vLine, pf } = o
  const sin = Math.sqrt(Math.max(0, 1 - pf * pf))
  const k = Math.sqrt(3)
  let S: number
  if (o.known === 'I') S = k * vLine * o.value
  else if (o.known === 'S') S = o.value
  else S = o.value / pf
  const iLine = S / (k * vLine)
  const P = S * pf
  const Q = (o.leading ? -1 : 1) * S * sin
  return {
    vPhase: o.conn === 'star' ? vLine / k : vLine,
    iPhase: o.conn === 'star' ? iLine : iLine / k,
    iLine, S, P, Q,
    phiDeg: (o.leading ? -1 : 1) * (Math.acos(pf) * 180) / Math.PI,
  }
}

export type UConn = 'star4' | 'star3' | 'delta'
export interface Load { r: number; x: number }
export interface Phase { V: C; I: C; S: C }
export interface Unbalanced {
  phases: Phase[] // star: a, b, c (voltage across load); delta: ab, bc, ca
  lineI: C[]
  neutralI: C | null
  neutralShift: C | null
  S: C
  imbalancePct: number // max deviation of line currents from their mean
}

/** Source: balanced ABC sequence, Van = Vl/sqrt(3) at 0 degrees. */
export function solveUnbalanced(conn: UConn, vLine: number, loads: Load[]): Unbalanced {
  const z = loads.map((l) => c(l.r, l.x))
  const vph = vLine / Math.sqrt(3)
  const van = [polar(vph, 0), polar(vph, -120), polar(vph, 120)]
  let phases: Phase[]
  let lineI: C[]
  let neutralI: C | null = null
  let neutralShift: C | null = null
  if (conn === 'delta') {
    const vab = [sub(van[0], van[1]), sub(van[1], van[2]), sub(van[2], van[0])]
    const iph = vab.map((v, k) => div(v, z[k]))
    phases = vab.map((V, k) => ({ V, I: iph[k], S: mul(V, conj(iph[k])) }))
    lineI = [sub(iph[0], iph[2]), sub(iph[1], iph[0]), sub(iph[2], iph[1])]
  } else {
    let vn = c(0)
    if (conn === 'star3') {
      const y = z.map((q) => div(c(1), q))
      const num = van.reduce((acc, v, k) => add(acc, mul(v, y[k])), c(0))
      const den = y.reduce((acc, q) => add(acc, q), c(0))
      vn = div(num, den)
      neutralShift = vn
    }
    const vl = van.map((v) => sub(v, vn))
    lineI = vl.map((v, k) => div(v, z[k]))
    phases = vl.map((V, k) => ({ V, I: lineI[k], S: mul(V, conj(lineI[k])) }))
    if (conn === 'star4') neutralI = neg(lineI.reduce((acc, q) => add(acc, q), c(0)))
  }
  const S = phases.reduce((acc, p) => add(acc, p.S), c(0))
  const mags = lineI.map(abs)
  const mean = mags.reduce((a, b) => a + b, 0) / 3
  const imbalancePct = mean > 0 ? (Math.max(...mags.map((m) => Math.abs(m - mean))) / mean) * 100 : 0
  return { phases, lineI, neutralI, neutralShift, S, imbalancePct }
}
