// Run with `npm run example`. Imports the package by name, the same way an app would.
import { calculateBolus } from 'bolus-pra-bolos';

const at = (time) => new Date(`2026-10-22T${time}`);

const settings = { unit: 'mg/dL', carbRatio: 10, sensitivity: 50, target: 100 };
const lunch = { time: at('12:00'), carbs: 60 };
const lunchBolus = { time: at('12:00'), units: 6 };

console.log('Lunch at 12:00: 60 g, 6 U bolus');
console.log('Dessert at 13:00: 30 g, glucose 100 mg/dL\n');

const strategies = ['carb-aware', 'subtract-from-total', 'correction-only'];
const results = strategies.map((iobStrategy) =>
  calculateBolus({
    settings: { ...settings, iobStrategy },
    carbs: 30,
    glucose: 100,
    doses: [lunchBolus],
    meals: [lunch],
    now: at('13:00'),
  }),
);

const rows = [
  ['Food dose', (r) => `${r.foodDose.toFixed(2)} U`],
  ['Correction dose', (r) => `${r.correctionDose.toFixed(2)} U`],
  ['Insulin on board', (r) => `${r.insulinOnBoard.toFixed(2)} U`],
  ['Carbs on board', (r) => `${r.carbsOnBoard.toFixed(0)} g`],
  ['IOB subtracted', (r) => `${r.iobApplied.toFixed(2)} U`],
  ['Bolus', (r) => `${r.units} U`],
  ['Suggested carbs', (r) => `${r.suggestedCarbs} g`],
];

const firstColumn = 18;
const column = 22;
console.log(''.padEnd(firstColumn) + strategies.map((s) => s.padStart(column)).join(''));
for (const [label, format] of rows) {
  console.log(
    label.padEnd(firstColumn) + results.map((r) => format(r).padStart(column)).join(''),
  );
}
