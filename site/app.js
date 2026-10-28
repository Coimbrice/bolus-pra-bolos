import { BolusInputError, calculateBolus, mgdlToMmol, mmolToMgdl } from './lib/index.js';
import { STRINGS } from './i18n.js';

const $ = (selector) => document.querySelector(selector);

const form = $('#form');
const historyList = $('#history');
const entryTemplate = $('#entry-template');

const LANGUAGE_KEY = 'bolus-pra-bolos-language';

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

let lang = initialLanguage();
let t = STRINGS[lang];
let nextEntryId = 0;

function initialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved in STRINGS) return saved;
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  const preferred = navigator.languages?.[0] ?? navigator.language ?? '';
  return preferred.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

function parseNumber(text) {
  const value = String(text).trim().replace(',', '.');
  return value === '' ? NaN : Number(value);
}

function format(value, digits = 2) {
  // `|| 0` turns -0 into 0, so a tiny negative correction doesn't show as "-0".
  const rounded = Number(value.toFixed(digits)) || 0;
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(rounded);
}

function checked(name) {
  return form.querySelector(`input[name="${name}"]:checked`).value;
}

function check(name, value) {
  form.querySelector(`input[name="${name}"][value="${value}"]`).checked = true;
}

function validate(value, labelKey, rule) {
  if (rule === 'positive' && !(value > 0))
    throw new BolusInputError(t.notPositive(t[labelKey]));
  if (rule === 'non-negative' && value < 0)
    throw new BolusInputError(t.negative(t[labelKey]));
  return value;
}

function required(id, labelKey, rule = 'positive') {
  const value = parseNumber($(`#${id}`).value);
  if (Number.isNaN(value)) throw new BolusInputError(t.missing(t[labelKey]));
  return validate(value, labelKey, rule);
}

function optional(id, labelKey) {
  const value = parseNumber($(`#${id}`).value);
  return Number.isNaN(value) ? undefined : validate(value, labelKey, 'positive');
}

function translate(root) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t[node.dataset.i18n];
  }
  for (const node of root.querySelectorAll('[data-i18n-html]')) {
    node.innerHTML = t[node.dataset.i18nHtml];
  }
  for (const node of root.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t[node.dataset.i18nAria]);
  }
}

function setLanguage(next) {
  const values = [...form.querySelectorAll('input[inputmode="decimal"]')].map((input) => [
    input,
    parseNumber(input.value),
  ]);

  lang = next;
  t = STRINGS[lang];
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Not remembering the choice is fine.
  }

  document.documentElement.lang = lang;
  document.title = t.title;
  translate(document);
  translate(entryTemplate.content);
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }
  for (const option of $('#dose-step').options) {
    option.textContent = `${format(Number(option.value), 1)} U`;
  }
  for (const [input, value] of values) {
    if (!Number.isNaN(value)) input.value = format(value, 4);
  }
  update();
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
    const read = (name) => parseNumber(row.querySelector(`[name="${name}"]`).value);
    const minutesAgo = read('minutesAgo');
    if (Number.isNaN(minutesAgo)) continue;
    validate(minutesAgo, 'minutesAgo', 'non-negative');
    const time = new Date(now.getTime() - minutesAgo * 60_000);
    const carbs = read('carbs');
    const units = read('units');
    if (validate(carbs, 'entryCarbs', 'non-negative') > 0) meals.push({ time, carbs });
    if (validate(units, 'entryBolus', 'non-negative') > 0) doses.push({ time, units });
  }
  return { doses, meals };
}

function readInsulinModel() {
  const durationHours = required('duration', 'duration');
  if (checked('curve') === 'linear') return { type: 'linear', durationHours };
  if (durationHours <= 2.5) throw new BolusInputError(t.curveTooShort);
  return { type: 'exponential', durationHours, peakMinutes: 75 };
}

function readRequest() {
  const now = new Date();
  const maxBolus = optional('max-bolus', 'maxBolus');
  const glucose = optional('glucose', 'glucose');
  const settings = {
    unit: checked('unit'),
    carbRatio: required('carb-ratio', 'carbRatio'),
    sensitivity: required('sensitivity', 'sensitivity'),
    target: required('target', 'target'),
    insulinModel: readInsulinModel(),
    doseStep: Number($('#dose-step').value),
    iobStrategy: checked('strategy'),
    ...(maxBolus === undefined ? {} : { maxBolus }),
  };
  return {
    settings,
    carbs: required('carbs', 'carbs', 'non-negative'),
    ...(glucose === undefined ? {} : { glucose }),
    ...readHistory(now),
    activityFactor: Number(checked('activity')),
    digestion: checked('digestion'),
    now,
  };
}

function describeTiming({ fromMinutes, toMinutes }) {
  if (fromMinutes === 0 && toMinutes === 0) return t.atStart;
  if (toMinutes < 0) return t.before(-toMinutes, -fromMinutes);
  return t.after(fromMinutes, toMinutes);
}

function renderBreakdown(result) {
  const labels = t.breakdown;
  const rows = [
    [labels.food, `${format(result.foodDose)} U`],
    [labels.correction, `${format(result.correctionDose)} U`],
    [labels.iob, `${format(result.insulinOnBoard)} U`],
    [labels.cob, `${format(result.carbsOnBoard, 0)} g`],
    [labels.iobApplied, `${format(result.iobApplied)} U`],
    [labels.activity, `× ${format(result.activityFactor)}`],
    [labels.unrounded, `${format(result.unroundedUnits)} U`],
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
  const messages = result.warnings.map((code) => t.warnings[code]);
  if (result.suggestedCarbs > 0) messages.push(t.suggestCarbs(result.suggestedCarbs));
  $('#warnings').replaceChildren(
    ...messages.map((message) => {
      const li = document.createElement('li');
      li.textContent = message;
      return li;
    }),
  );
}

function update() {
  $('#strategy-hint').textContent = t.strategyHints[checked('strategy')];

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
    split.textContent = t.split(
      format(now),
      format(later),
      format(laterFromMinutes / 60),
      format(laterToMinutes / 60),
    );
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
for (const button of document.querySelectorAll('[data-lang]')) {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
}

for (const node of document.querySelectorAll('[data-year]')) {
  node.textContent = new Date().getFullYear();
}

loadExample();
setLanguage(lang);
