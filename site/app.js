import { BolusInputError, calculateBolus, mgdlToMmol, mmolToMgdl } from './lib/index.js';

const $ = (selector) => document.querySelector(selector);

const form = $('#form');
const historyList = $('#history');
const entryTemplate = $('#entry-template');

const STRATEGY_HINTS = {
  'carb-aware':
    'Only subtracts the insulin not already covering carbs from earlier meals that are still being absorbed.',
  'subtract-from-total':
    'Subtracts all active insulin from the new bolus, as the book does by default.',
  'correction-only':
    'Active insulin only offsets the correction, as the book suggests after slow or very large meals.',
};

const WARNINGS = {
  'low-glucose': 'Glucose is low. Treat the low first.',
  'insulin-on-board-exceeds-need': 'Active insulin is more than what is needed.',
  'capped-at-max': 'The dose was capped at the maximum bolus.',
};

const EXAMPLE = {
  carbs: '30',
  glucose: '100',
  digestion: 'moderate',
  activity: '1',
  strategy: 'carb-aware',
  history: [{ minutesAgo: '60', carbs: '60', units: '6' }],
};

const SETTINGS = {
  'carb-ratio': '10',
  sensitivity: '50',
  target: '100',
  duration: '4',
  'max-bolus': '15',
};

let nextEntryId = 0;

function parseNumber(text) {
  const value = String(text).trim().replace(',', '.');
  return value === '' ? NaN : Number(value);
}

function format(value, digits = 2) {
  return String(Number(value.toFixed(digits)));
}

function checked(name) {
  return form.querySelector(`input[name="${name}"]:checked`).value;
}

function check(name, value) {
  form.querySelector(`input[name="${name}"][value="${value}"]`).checked = true;
}

function required(id, label) {
  const value = parseNumber($(`#${id}`).value);
  if (Number.isNaN(value)) throw new BolusInputError(`Enter the ${label}.`);
  return value;
}

function optional(id) {
  const value = parseNumber($(`#${id}`).value);
  return Number.isNaN(value) ? undefined : value;
}

function addEntry(values = { minutesAgo: '', carbs: '', units: '' }) {
  const row = entryTemplate.content.firstElementChild.cloneNode(true);
  const id = nextEntryId++;
  for (const input of row.querySelectorAll('input')) {
    input.id = `entry-${id}-${input.name}`;
    input.value = values[input.name];
    input.closest('.field').querySelector('label').htmlFor = input.id;
  }
  row.querySelector('.remove').addEventListener('click', () => {
    row.remove();
    update();
  });
  historyList.append(row);
}

function readHistory(now) {
  const doses = [];
  const meals = [];
  for (const row of historyList.children) {
    const minutesAgo = parseNumber(row.querySelector('[name="minutesAgo"]').value);
    if (Number.isNaN(minutesAgo)) continue;
    const time = new Date(now.getTime() - minutesAgo * 60_000);
    const carbs = parseNumber(row.querySelector('[name="carbs"]').value);
    const units = parseNumber(row.querySelector('[name="units"]').value);
    if (carbs > 0) meals.push({ time, carbs });
    if (units > 0) doses.push({ time, units });
  }
  return { doses, meals };
}

function readRequest() {
  const now = new Date();
  const maxBolus = optional('max-bolus');
  const glucose = optional('glucose');
  const settings = {
    unit: checked('unit'),
    carbRatio: required('carb-ratio', 'carb ratio'),
    sensitivity: required('sensitivity', 'sensitivity factor'),
    target: required('target', 'target'),
    insulinModel:
      checked('curve') === 'linear'
        ? { type: 'linear', durationHours: required('duration', 'insulin action time') }
        : {
            type: 'exponential',
            durationHours: required('duration', 'insulin action time'),
            peakMinutes: 75,
          },
    doseStep: Number($('#dose-step').value),
    iobStrategy: checked('strategy'),
    ...(maxBolus === undefined ? {} : { maxBolus }),
  };
  return {
    settings,
    carbs: required('carbs', 'carbs'),
    ...(glucose === undefined ? {} : { glucose }),
    ...readHistory(now),
    activityFactor: Number(checked('activity')),
    digestion: checked('digestion'),
    now,
  };
}

function describeTiming({ fromMinutes, toMinutes }) {
  if (fromMinutes === 0 && toMinutes === 0) return 'Take it as you start eating.';
  if (toMinutes < 0)
    return `Take it ${-toMinutes} to ${-fromMinutes} minutes before eating.`;
  return `Take it ${fromMinutes} to ${toMinutes} minutes after you start eating.`;
}

function renderBreakdown(result) {
  const rows = [
    ['Food dose', `${format(result.foodDose)} U`],
    ['Correction', `${format(result.correctionDose)} U`],
    ['Insulin on board', `${format(result.insulinOnBoard)} U`],
    ['Carbs on board', `${format(result.carbsOnBoard, 0)} g`],
    ['IOB subtracted', `${format(result.iobApplied)} U`],
    ['Activity', `× ${result.activityFactor}`],
    ['Before rounding', `${format(result.unroundedUnits)} U`],
  ];
  $('#breakdown').replaceChildren(
    ...rows.flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}

function renderWarnings(result) {
  const messages = result.warnings.map((code) => WARNINGS[code]);
  if (result.suggestedCarbs > 0) {
    messages.push(`Consider eating about ${result.suggestedCarbs} g of carbs.`);
  }
  $('#warnings').replaceChildren(
    ...messages.map((message) => {
      const li = document.createElement('li');
      li.textContent = message;
      return li;
    }),
  );
}

function update() {
  $('#strategy-hint').textContent = STRATEGY_HINTS[checked('strategy')];

  let result;
  try {
    result = calculateBolus(readRequest());
  } catch (error) {
    if (!(error instanceof BolusInputError)) throw error;
    $('#dose').textContent = '–';
    $('#timing').textContent = '';
    $('#split').hidden = true;
    $('#error').hidden = false;
    $('#error').textContent = error.message;
    $('#breakdown').replaceChildren();
    $('#warnings').replaceChildren();
    return;
  }

  $('#error').hidden = true;
  $('#dose').textContent = `${format(result.units)} U`;
  $('#timing').textContent = result.timing ? describeTiming(result.timing) : '';

  const split = $('#split');
  split.hidden = !result.split;
  if (result.split) {
    const { now, later, laterFromMinutes, laterToMinutes } = result.split;
    split.textContent = `Split it: ${format(now)} U now and ${format(later)} U ${
      laterFromMinutes / 60
    } to ${laterToMinutes / 60} hours later.`;
  }

  renderBreakdown(result);
  renderWarnings(result);
}

function convertGlucoseFields(unit) {
  const convert =
    unit === 'mmol/L'
      ? (value) => format(mgdlToMmol(value), 1)
      : (value) => format(mmolToMgdl(value), 0);
  for (const id of ['glucose', 'sensitivity', 'target']) {
    const input = $(`#${id}`);
    const value = parseNumber(input.value);
    if (!Number.isNaN(value)) input.value = convert(value);
  }
  for (const label of document.querySelectorAll('.glucose-unit')) {
    label.textContent = unit;
  }
}

function loadExample() {
  if (checked('unit') !== 'mg/dL') {
    check('unit', 'mg/dL');
    convertGlucoseFields('mg/dL');
  }
  for (const [id, value] of Object.entries(SETTINGS)) {
    $(`#${id}`).value = value;
  }
  $('#carbs').value = EXAMPLE.carbs;
  $('#glucose').value = EXAMPLE.glucose;
  check('digestion', EXAMPLE.digestion);
  check('activity', EXAMPLE.activity);
  check('strategy', EXAMPLE.strategy);
  historyList.replaceChildren();
  EXAMPLE.history.forEach(addEntry);
  update();
}

form.addEventListener('input', update);
form.addEventListener('change', (event) => {
  if (event.target.name === 'unit') convertGlucoseFields(event.target.value);
  update();
});
form.addEventListener('submit', (event) => event.preventDefault());
$('#add-entry').addEventListener('click', () => {
  addEntry();
  historyList.lastElementChild.querySelector('input').focus();
  update();
});
$('#example').addEventListener('click', loadExample);

for (const node of document.querySelectorAll('[data-year]')) {
  node.textContent = new Date().getFullYear();
}

loadExample();
