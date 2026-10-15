import { BolusInputError } from './errors.js';

export interface ScheduleEntry {
  /** Local time the value starts applying, as "HH:MM". */
  start: string;
  value: number;
}

/** A fixed value, or values that change during the day (e.g. a stronger breakfast ratio). */
export type Scheduled = number | ScheduleEntry[];

export function valueAt(setting: Scheduled, time: Date): number {
  if (typeof setting === 'number') {
    return setting;
  }
  if (setting.length === 0) {
    throw new BolusInputError('schedule must have at least one entry');
  }

  const entries = setting
    .map((entry) => ({ minute: parseTime(entry.start), value: entry.value }))
    .sort((a, b) => a.minute - b.minute);
  const minuteOfDay = time.getHours() * 60 + time.getMinutes();

  // Before the first entry of the day, the last one from the previous day still applies.
  let current = entries[entries.length - 1]!;
  for (const entry of entries) {
    if (entry.minute > minuteOfDay) break;
    current = entry;
  }
  return current.value;
}

function parseTime(text: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (!match) {
    throw new BolusInputError(`invalid schedule time "${text}", expected HH:MM`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
