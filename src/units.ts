export type GlucoseUnit = 'mg/dL' | 'mmol/L';

const MGDL_PER_MMOL = 18.0182;

export function mgdlToMmol(value: number): number {
  return value / MGDL_PER_MMOL;
}

export function mmolToMgdl(value: number): number {
  return value * MGDL_PER_MMOL;
}

/** Level 1 hypoglycemia threshold (70 mg/dL, 3.9 mmol/L). */
export function hypoThreshold(unit: GlucoseUnit): number {
  return unit === 'mg/dL' ? 70 : 3.9;
}
