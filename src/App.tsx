import { Box, Choice, Num, Section, Seg, Shell, Stat, usePersisted, usePrefs } from './ui'
import { download, fmt, toCsv } from './io'
import { UK } from './uk'
import Phasor, { type Vec } from './Phasor'
import { abs, arg, polar, solveBalanced, solveUnbalanced, type Conn, type Known, type Load, type UConn } from './lib/three'

interface State {
  mode: 'bal' | 'unbal'; conn: Conn; uconn: UConn; vLine: number; known: Known; value: number; pf: number; leading: boolean; loads: Load[]
}
const INIT: State = {
  mode: 'bal', conn: 'star', uconn: 'star4', vLine: 400, known: 'P', value: 15, pf: 0.85, leading: false,
  loads: [{ r: 10, x: 5 }, { r: 20, x: 0 }, { r: 15, x: -5 }],
}
const eng = (x: number, unit: string, t: number) => (Math.abs(x) >= 1e6 ? `${fmt(x / 1e6, t)} M${unit}` : Math.abs(x) >= 1e3 ? `${fmt(x / 1e3, t)} k${unit}` : `${fmt(x, t)} ${unit}`)
const ang = (a: number) => (Math.abs(a) < 1e-9 ? 0 : a)

export default function App() {
  const { prefs, setPrefs, t } = usePrefs(UK)
  const [s, set, link] = usePersisted<State>('three-phase-calculator', INIT)
  const unit: Record<Known, string> = { I: 'A', P: 'kW', S: 'kVA' }
  const bal = solveBalanced({ conn: s.conn, vLine: s.vLine, known: s.known, value: s.known === 'I' ? s.value : s.value * 1000, pf: s.pf, leading: s.leading })
  const validLoads = s.loads.every((l) => Math.hypot(l.r, l.x) > 1e-9)
  const un = validLoads ? solveUnbalanced(s.uconn, s.vLine, s.loads) : null
  const star = s.mode === 'bal' ? s.conn === 'star' : s.uconn !== 'delta'
  const names = star ? ['A', 'B', 'C'] : ['AB', 'BC', 'CA']

  const vecs: Vec[] = []
  if (s.mode === 'bal') {
    const ph = bal.vPhase
    ;[0, -120, 120].forEach((a, k) => {
      vecs.push({ label: `V${'ABC'[k]}`, v: polar(ph, s.conn === 'star' ? a : a + 30), kind: 'V' })
    })
    ;[0, -120, 120].forEach((a, k) => vecs.push({ label: `I${'ABC'[k]}`, v: polar(bal.iLine, a - bal.phiDeg), kind: 'I' }))
  } else if (un) {
    un.phases.forEach((p, k) => vecs.push({ label: `V${names[k]}`, v: p.V, kind: 'V' }))
    un.lineI.forEach((i, k) => vecs.push({ label: `I${'ABC'[k]}`, v: i, kind: 'I' }))
  }
  const rows = un?.phases.map((p, k) => [names[k], fmt(abs(p.V), 1), fmt(ang(arg(p.V)), 1), fmt(abs(p.I), 2), fmt(ang(arg(p.I)), 1), fmt(p.S.re, 0), fmt(p.S.im, 0), fmt(abs(p.S), 0), fmt(abs(un.lineI[k]), 2)])
  const setLoad = (k: number, p: Partial<Load>) => set({ loads: s.loads.map((l, i) => (i === k ? { ...l, ...p } : l)) })

  return (
    <Shell title={t('Three-phase calculator')} subtitle={t('Star and delta, P, Q, S, and unbalanced loads.')} note={t('Ideal balanced ABC source, no line impedance. Results are for learning and quick checks.')} repo="three-phase-calculator" prefs={prefs} setPrefs={setPrefs} t={t} link={link}
      side={<>
        <Seg value={s.mode} onChange={(mode) => set({ mode })} options={[['bal', t('Balanced')], ['unbal', t('Unbalanced')]]} />
        <Section title={t('Supply')}>
          <Num label={t('Line voltage')} unit="V" value={s.vLine} min={1} onChange={(vLine) => set({ vLine })} />
          {s.mode === 'bal' ? (
            <Seg value={s.conn} onChange={(conn) => set({ conn })} options={[['star', t('Star')], ['delta', t('Delta')]]} />
          ) : (
            <Choice label={t('Connection')} value={s.uconn} onChange={(uconn) => set({ uconn })} options={[['star4', t('Star, 4-wire (neutral)')], ['star3', t('Star, 3-wire (floating)')], ['delta', t('Delta')]]} />
          )}
        </Section>
        {s.mode === 'bal' ? (
          <Section title={t('Load')}>
            <Choice label={t('Known quantity')} value={s.known} onChange={(known) => set({ known, value: known === 'I' ? 20 : 15 })} options={[['P', t('Active power P')], ['S', t('Apparent power S')], ['I', t('Line current')]]} />
            <Num label={t('Value')} unit={unit[s.known]} value={s.value} min={0.001} onChange={(value) => set({ value })} />
            <Num label={t('Power factor')} value={s.pf} min={0.01} max={1} step={0.01} onChange={(pf) => set({ pf })} />
            <Seg value={s.leading ? 'lead' : 'lag'} onChange={(v) => set({ leading: v === 'lead' })} options={[['lag', t('Lagging')], ['lead', t('Leading')]]} />
          </Section>
        ) : (
          <Section title={t('Load')}>
            {s.loads.map((l, k) => (
              <div key={k} className="card">
                <b>{t('Phase {0}', names[k])}</b>
                <div className="grid2">
                  <Num label={t('Resistance R')} unit="Ω" value={l.r} min={0} onChange={(r) => setLoad(k, { r })} />
                  <Num label={t('Reactance X (+ inductive)')} unit="Ω" value={l.x} onChange={(x) => setLoad(k, { x })} />
                </div>
              </div>
            ))}
            {!validLoads && <p className="msg err">{t('Enter a non-zero impedance for every phase.')}</p>}
          </Section>
        )}
      </>}>
      {s.mode === 'bal' ? (
        <>
          <div className="stats">
            <Stat label={t('Phase voltage')} value={fmt(bal.vPhase, 1)} unit="V" />
            <Stat label={t('Phase current')} value={fmt(bal.iPhase, 2)} unit="A" />
            <Stat label={t('Line current')} value={fmt(bal.iLine, 2)} unit="A" />
            <Stat label={t('Active power')} value={eng(bal.P, 'W', 2)} />
            <Stat label={t('Reactive power')} value={eng(bal.Q, 'var', 2)} />
            <Stat label={t('Apparent power')} value={eng(bal.S, 'VA', 2)} />
            <Stat label={t('Phase angle φ')} value={fmt(bal.phiDeg, 1)} unit="°" />
          </div>
        </>
      ) : un ? (
        <>
          <div className="stats">
            <Stat label={t('Active power')} value={eng(un.S.re, 'W', 2)} />
            <Stat label={t('Reactive power')} value={eng(un.S.im, 'var', 2)} />
            <Stat label={t('Apparent power')} value={eng(abs(un.S), 'VA', 2)} />
            <Stat label={t('Power factor')} value={fmt(abs(un.S) > 0 ? un.S.re / abs(un.S) : 1, 3)} />
            <Stat label={t('Current imbalance')} value={fmt(un.imbalancePct, 1)} unit="%" tone={un.imbalancePct > 10 ? 'warn' : 'ok'} />
            {un.neutralI && <Stat label={t('Neutral current')} value={fmt(abs(un.neutralI), 2)} unit="A" tone={abs(un.neutralI) > 1 ? 'warn' : 'ok'} />}
            {un.neutralShift && <Stat label={t('Neutral shift')} value={fmt(abs(un.neutralShift), 1)} unit="V" tone={abs(un.neutralShift) > 10 ? 'warn' : 'ok'} />}
          </div>
          <Box title={t('Phase')} actions={<button className="small" onClick={() => download('three-phase.csv', toCsv([[t('Phase'), 'V', '∠V°', 'I', '∠I°', 'P W', 'Q var', 'S VA', t('Line current I') + ' A'], ...rows!]), 'text/csv')}>{t('Export CSV')}</button>}>
            <div className="scroll-x">
              <table className="data">
                <thead><tr><th>{t('Phase')}</th><th className="num">V</th><th className="num">∠V °</th><th className="num">I (A)</th><th className="num">∠I °</th><th className="num">P (W)</th><th className="num">Q (var)</th><th className="num">S (VA)</th><th className="num">{t('Line current I')}</th></tr></thead>
                <tbody>
                  {rows!.map((r) => <tr key={r[0]}><td>{r[0]}</td>{r.slice(1).map((c, i) => <td key={i} className="num">{c}</td>)}</tr>)}
                  <tr><td><b>{t('Totals')}</b></td><td /><td /><td /><td /><td className="num"><b>{fmt(un.S.re, 0)}</b></td><td className="num"><b>{fmt(un.S.im, 0)}</b></td><td className="num"><b>{fmt(abs(un.S), 0)}</b></td><td /></tr>
                </tbody>
              </table>
            </div>
          </Box>
        </>
      ) : null}
      <Box title={t('Phasor diagram')}>
        <Phasor vecs={vecs} label={t('Phasor diagram')} />
        <p className="hint">{t('Voltages (thin) and currents (bold) are drawn at separate scales.')}</p>
      </Box>
    </Shell>
  )
}
