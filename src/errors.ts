export class BolusInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BolusInputError';
  }
}

export function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BolusInputError(`${name} must be a positive number, got ${value}`);
  }
}

export function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new BolusInputError(`${name} must be zero or a positive number, got ${value}`);
  }
}
