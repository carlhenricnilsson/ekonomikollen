import { describe, it, expect } from 'vitest'
import { rawP, clampP, fmtScaleLabel, KPI_THRESH, Thresh } from './kpi-scale'

describe('rawP – normaliserad position', () => {
  const lowerIsBetter: Thresh = { green: 800, red: 1000 } // KPI1-typ
  const higherIsBetter: Thresh = { green: 250, red: 130 } // KPI4-typ (inverterad)

  it('värde = grön tröskel → position 20', () => {
    expect(rawP(800, lowerIsBetter)).toBe(20)
    expect(rawP(250, higherIsBetter)).toBe(20)
  })
  it('värde = röd tröskel → position 80', () => {
    expect(rawP(1000, lowerIsBetter)).toBe(80)
    expect(rawP(130, higherIsBetter)).toBe(80)
  })
  it('mittpunkt mellan trösklar → position 50', () => {
    expect(rawP(900, lowerIsBetter)).toBe(50)
    expect(rawP(190, higherIsBetter)).toBe(50)
  })
  it('värde bättre än grön → position < 20 (kan bli negativ)', () => {
    expect(rawP(700, lowerIsBetter)).toBeLessThan(20)
    expect(rawP(300, higherIsBetter)).toBeLessThan(20)
  })
  it('värde sämre än röd → position > 80', () => {
    expect(rawP(1100, lowerIsBetter)).toBeGreaterThan(80)
    expect(rawP(100, higherIsBetter)).toBeGreaterThan(80)
  })
})

describe('clampP – markörsklampning', () => {
  it.each<[number, number]>([
    [-50, 3], [-0.01, 3],          // p < 0 → 3
    [0, 7], [5, 7], [9.99, 7],     // 0 ≤ p < 10 → 7
    [10, 10], [50, 50], [90, 90],  // 10 ≤ p ≤ 90 → p
    [90.01, 93], [100, 93],        // 90 < p ≤ 100 → 93
    [100.01, 97], [250, 97],       // p > 100 → 97
  ])('clampP(%d) = %d', (input, expected) => {
    expect(clampP(input)).toBe(expected)
  })
})

describe('fmtScaleLabel', () => {
  it('procent-enhet → avrundat heltal + %', () => {
    expect(fmtScaleLabel(5, '%')).toBe('5%')
    expect(fmtScaleLabel(10, '%')).toBe('10%')
    expect(fmtScaleLabel(7.5, '%')).toBe('8%') // Math.round(7.5) = 8
  })
  it('värde ≥ 10000 → k-suffix', () => {
    expect(fmtScaleLabel(15000, 'kr/kvm')).toBe('15k')
    expect(fmtScaleLabel(10000, 'kr/kvm')).toBe('10k')
  })
  it('1000 ≤ värde < 10000 → tusentalsavgränsare (sv-SE)', () => {
    const out = fmtScaleLabel(5000, 'kr/kvm')
    expect(out.replace(/\D/g, '')).toBe('5000') // siffrorna bevaras
    expect(out).not.toBe('5000')                 // separator tillagd
    expect(out.length).toBeGreaterThanOrEqual(5)
  })
  it('värde < 1000 → rått heltal', () => {
    expect(fmtScaleLabel(800, 'kr/kvm')).toBe('800')
    expect(fmtScaleLabel(0, 'kr/kvm')).toBe('0')
    expect(fmtScaleLabel(175.4, 'kr/kvm')).toBe('175')
  })
})

describe('KPI_THRESH – struktur (skyddar delad källa)', () => {
  it('innehåller exakt KPI 1–7', () => {
    expect(Object.keys(KPI_THRESH).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('varje tröskel har numeriska green/red', () => {
    for (const t of Object.values(KPI_THRESH)) {
      expect(typeof t.green).toBe('number')
      expect(typeof t.red).toBe('number')
      expect(t.green).not.toBe(t.red) // undvik division med noll i rawP
    }
  })
  it('KPI4 är inverterad (green > red), övriga green < red', () => {
    expect(KPI_THRESH[4].green).toBeGreaterThan(KPI_THRESH[4].red)
    for (const id of [1, 2, 3, 5, 6, 7]) {
      expect(KPI_THRESH[id].green).toBeLessThan(KPI_THRESH[id].red)
    }
  })
})
