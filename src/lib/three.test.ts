import { describe, expect, it } from 'vitest'
import { abs, arg, polar, solveBalanced, solveUnbalanced } from './three'

describe('balanced', () => {
  it('400 V, 10 A, pf 0.8 lagging (star)', () => {
    const r = solveBalanced({ conn: 'star', vLine: 400, known: 'I', value: 10, pf: 0.8, leading: false })
    expect(r.vPhase).toBeCloseTo(230.94, 2)
    expect(r.iPhase).toBe(10)
    expect(r.S).toBeCloseTo(6928.2, 1)
    expect(r.P).toBeCloseTo(5542.6, 1)
    expect(r.Q).toBeCloseTo(4156.9, 1)
    expect(r.phiDeg).toBeCloseTo(36.87, 2)
  })
  it('delta divides the line current by sqrt(3)', () => {
    const r = solveBalanced({ conn: 'delta', vLine: 400, known: 'I', value: 10, pf: 1, leading: true })
    expect(r.vPhase).toBe(400)
    expect(r.iPhase).toBeCloseTo(5.7735, 4)
    expect(r.Q).toBeCloseTo(0, 6)
  })
  it('power input round-trips', () => {
    const r = solveBalanced({ conn: 'star', vLine: 400, known: 'P', value: 11000, pf: 0.85, leading: true })
    expect(r.P).toBeCloseTo(11000, 6)
    expect(r.iLine).toBeCloseTo(11000 / (Math.sqrt(3) * 400 * 0.85), 6)
    expect(r.Q).toBeLessThan(0)
    expect(r.phiDeg).toBeLessThan(0)
  })
})

describe('unbalanced', () => {
  const eq = [{ r: 10, x: 0 }, { r: 10, x: 0 }, { r: 10, x: 0 }]
  it('equal star loads have no neutral current', () => {
    const u = solveUnbalanced('star4', 400, eq)
    expect(abs(u.neutralI!)).toBeLessThan(1e-9)
    expect(abs(u.lineI[0])).toBeCloseTo(400 / Math.sqrt(3) / 10, 9)
    expect(u.S.re).toBeCloseTo(3 * 23.094 ** 2 * 10, 0)
    expect(u.imbalancePct).toBeCloseTo(0, 9)
  })
  it('4-wire star: neutral is the negative sum', () => {
    const u = solveUnbalanced('star4', 400, [{ r: 10, x: 0 }, { r: 20, x: 0 }, { r: 40, x: 0 }])
    const sum = u.lineI.reduce((a, b) => ({ re: a.re + b.re, im: a.im + b.im }))
    expect(u.neutralI!.re).toBeCloseTo(-sum.re, 9)
    expect(abs(u.neutralI!)).toBeGreaterThan(5)
  })
  it('3-wire star with an open phase is two loads in series across the line voltage', () => {
    const u = solveUnbalanced('star3', 400, [{ r: 10, x: 0 }, { r: 10, x: 0 }, { r: 1e12, x: 0 }])
    expect(abs(u.lineI[0])).toBeCloseTo(20, 4)
    expect(abs(u.lineI[1])).toBeCloseTo(20, 4)
    expect(abs(u.lineI[2])).toBeLessThan(1e-6)
    expect(abs(u.neutralShift!)).toBeGreaterThan(100)
  })
  it('balanced delta: line current = sqrt(3) phase current, lagging 30 degrees', () => {
    const u = solveUnbalanced('delta', 400, eq)
    expect(abs(u.phases[0].I)).toBeCloseTo(40, 9)
    expect(abs(u.lineI[0])).toBeCloseTo(40 * Math.sqrt(3), 9)
    expect(arg(u.lineI[0]) - arg(u.phases[0].I)).toBeCloseTo(-30, 6)
    expect(u.neutralI).toBeNull()
    expect(u.S.re).toBeCloseTo(3 * 400 * 400 / 10, 6)
  })
  it('polar helper', () => expect(polar(2, 90).im).toBeCloseTo(2, 12))
})
