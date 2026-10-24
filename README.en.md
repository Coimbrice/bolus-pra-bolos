# bolus-pra-bolos

[Português](README.md) · **English**

[![CI](https://github.com/Coimbrice/bolus-pra-bolos/actions/workflows/ci.yml/badge.svg)](https://github.com/Coimbrice/bolus-pra-bolos/actions/workflows/ci.yml)

A TypeScript library for calculating insulin boluses, based on the method in Gary Scheiner's _Think Like a Pancreas_.

> [!WARNING]
> **This is not a medical device and must not be used to make treatment decisions.** It is a programming exercise, not approved by any regulatory agency, not clinically validated and provided without warranty (see [LICENSE](LICENSE)). Insulin dosing errors can cause severe hypoglycemia or hyperglycemia. Always follow the guidance of your diabetes care team. If you build anything on top of this code, making it safe and compliant with the regulations where you live is your responsibility.

## Why

I was diagnosed with type 1 diabetes in August 2025. Learning to live with it, I came across carb counting and the math behind insulin doses, mostly through _Think Like a Pancreas_. I knew how to do the math but always used apps for it, and I got curious about what it would be like to write my own program, even though plenty already exist.

## How it works

The formula from chapter 7 of the book:

```
bolus = (food dose + correction - insulin on board) × activity factor
```

- **Food dose**: carbs ÷ carb ratio.
- **Correction**: (current glucose − target) ÷ sensitivity factor. Negative below target, which lowers the dose.
- **Insulin on board (IOB)**: what is left of previous boluses, using the book's linear curve or the exponential one used by Loop and OpenAPS.
- **Activity factor**: below 1 for exercise, above 1 for long periods sitting still.

Carb ratio, sensitivity and target can change through the day. The dose is rounded down to the pen step and can be capped at a maximum.

**Eating again shortly after a meal.** Lunch is 60 g at a 1:10 ratio with 6 U. An hour later comes 30 g of dessert. There are still 4.5 U active, and subtracting all of it would leave the dessert uncovered. But about 40 g of lunch is still being absorbed and needs 4 U of that insulin, so only 0.5 U is extra and the right bolus is 2.5 U. This is the default `carb-aware` strategy. The book's own approaches are also available: `subtract-from-total` and `correction-only`.

**When to bolus.** Given how fast the meal digests (`digestion`), the result suggests when to bolus: 20 to 30 minutes before fast food (bread, rice, potatoes), 5 to 10 minutes before moderate, and at the meal for slow, with the dose split in two halves, the second 1 to 2 hours later. Glucose moves that window earlier or later.

## Limitations

- Carbs are assumed to absorb at a constant rate. Fat, protein, fiber and glycemic index change that, and fat and protein aren't counted.
- The insulin curve is fixed, but in practice it varies with dose size, injection site, temperature and exercise.
- The bolus timing and the half-and-half split are my interpretation of the book's guidance, which is qualitative.
- Results depend on the history passed in: a missing dose or meal silently produces a wrong answer.

## Usage

```sh
npm install github:Coimbrice/bolus-pra-bolos
```

```ts
import { calculateBolus } from 'bolus-pra-bolos';

const result = calculateBolus({
  settings: {
    unit: 'mg/dL',
    carbRatio: [
      { start: '06:00', value: 8 },
      { start: '11:00', value: 12 },
      { start: '17:00', value: 10 },
    ],
    sensitivity: 50,
    target: 100,
    insulinModel: { type: 'linear', durationHours: 4 },
    doseStep: 0.5,
    maxBolus: 15,
  },
  carbs: 30,
  glucose: 140,
  digestion: 'moderate',
  doses: [{ time: new Date('2026-10-22T12:00'), units: 6 }],
  meals: [{ time: new Date('2026-10-22T12:00'), carbs: 60 }],
  now: new Date('2026-10-22T13:00'),
});

result.units; // 2 (2.13 rounded down to the 0.5 U step)
result.timing; // { fromMinutes: -10, toMinutes: -5 }
result.split; // null, only slow meals are split
```

There are also helpers from the carb counting chapter (`netCarbs`, `carbsFromWeight`) and the book's starting-point rules (`carbRatioFromTotalDailyDose`, `sensitivityFromTotalDailyDose`, `carbRatioFromWeight`). Invalid input throws a `BolusInputError`.

[`examples/dessert.js`](examples/dessert.js) compares the three strategies on the dessert case: `npm run example`.

## Development

```sh
npm install
npm test
npm run lint
npm run typecheck
```

## How this was made

This project was built with the help of Claude, Anthropic's AI assistant. The idea, the scope and the design decisions are mine, based on what I learned from the book and from living with diabetes. Claude helped write the code, tests and documentation, and I reviewed all of it.

## References

- Gary Scheiner, _Think Like a Pancreas_, 2012 edition: chapters 4 (carb counting) and 7 (bolus calculation).
- [LoopKit/Loop#388](https://github.com/LoopKit/Loop/issues/388): the exponential insulin activity curve.

## License

[MIT](LICENSE)
