/**
 * Local CSV parsing and causal historical ζ-Field calculations.
 *
 * Provisional illustrative model (not the Riemann zeta function):
 *   x_t = 100 ln(P_t / P_(t-1)) when every P is positive; otherwise x_t = P_t-P_(t-1)
 *   μ_t = mean(x_(t-w), …, x_(t-1))
 *   σ_t = population standard deviation of those w prior changes
 *   z_t = (x_t-μ_t)/σ_t, unavailable until a full window exists and σ_t > 0
 *   ζ_t = (1-λ) z_t + λ ζ_(t-1), seeded with z_t after a data gap
 * Only observations strictly before t are used in μ_t and σ_t. ζ is a custom,
 * exponentially smoothed standardized surprise field, not a standardized zeta function.
 */

export function parseCSV(input) {
  if (typeof input !== 'string') throw new TypeError('CSV input must be text.');
  const source = input.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/).find(line => line.trim()) || '';
  const delimiterCount = delimiter => {
    let count = 0;
    let inQuotes = false;
    for (let index = 0; index < firstLine.length; index++) {
      if (firstLine[index] === '"' && firstLine[index + 1] === '"' && inQuotes) index++;
      else if (firstLine[index] === '"') inQuotes = !inQuotes;
      else if (!inQuotes && firstLine[index] === delimiter) count++;
    }
    return count;
  };
  // Most European CSV exports use semicolons when comma is the decimal separator.
  const delimiter = [',', ';', '\t'].sort((a, b) => delimiterCount(b) - delimiterCount(a))[0];
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.trim() === '') {
      field = '';
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim()); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      row.push(field.trim()); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (rows.length < 3) throw new Error('Use a header row and at least two data rows.');
  const width = rows[0].length;
  if (width < 2) throw new Error('CSV must contain a date column and at least one value column.');
  return { rows, delimiter };
}

export function parseNumericValue(raw, delimiter = ';') {
  if (raw == null || String(raw).trim() === '' || String(raw).trim() === '.') return NaN;
  let value = String(raw).trim().replace(/[€$£¥%\s]/g, '');
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    value = comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (comma >= 0) {
    const groups = value.split(',');
    const thousandsNotation = groups.length > 1 && groups[0].length > 0 && groups.slice(1).every(group => group.length === 3);
    value = delimiter === ',' && thousandsNotation ? value.replace(/,/g, '') : value.replace(',', '.');
  } else if (delimiter !== ',') {
    // In semicolon/tab-separated European exports, dot-only 3-digit groups are thousands separators.
    const groups = value.split('.');
    if (groups.length > 1 && groups[0].length > 0 && groups.slice(1).every(group => group.length === 3)) value = value.replace(/\./g, '');
  }
  return value ? Number(value) : NaN;
}

function validISODate(year, month, day) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse common ISO, year-month, European day-first, and unambiguous US dates. */
export function parseDateValue(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?(?:[T\s].*)?$/);
  if (match) return validISODate(Number(match[1]), Number(match[2]), Number(match[3] || 1));
  match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (match) {
    let first = Number(match[1]);
    let second = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    // If one field exceeds 12, the format is unambiguous. Otherwise prefer D/M/Y.
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    return validISODate(year, month, day);
  }
  // Named-month dates are accepted where the platform parser recognizes them.
  if (/^[A-Za-z]{3,9}[ ,.-]/.test(text)) {
    const time = Date.parse(text);
    if (Number.isFinite(time)) {
      const date = new Date(time);
      return validISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }
  }
  return null;
}

/** Normalize and validate date/value rows. Missing values can be skipped with a warning. */
export function prepareHistoricalRecords(records, valueIndex, delimiter = ';') {
  if (!Array.isArray(records) || records.length < 2) throw new Error('At least two data rows are required.');
  if (!Number.isInteger(valueIndex) || valueIndex < 0) throw new Error('Choose a valid numeric column.');
  const datesSeen = new Set();
  const output = [];
  const skippedMissing = [];
  const invalidDates = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const dateText = String(record.date ?? '').trim();
    const date = parseDateValue(dateText);
    if (!date) { invalidDates.push(i + 2); continue; }
    if (datesSeen.has(date)) throw new Error(`Duplicate observation date ${date}. Remove duplicates before analysis.`);
    datesSeen.add(date);
    const rawValue = record.values?.[valueIndex];
    const value = parseNumericValue(rawValue, delimiter);
    if (!Number.isFinite(value)) { skippedMissing.push(i + 2); continue; }
    output.push({ date, value });
  }
  if (invalidDates.length) {
    const sample = invalidDates.slice(0, 4).join(', ');
    throw new Error(`Invalid or missing date in CSV row${invalidDates.length > 1 ? 's' : ''} ${sample}${invalidDates.length > 4 ? ', …' : ''}. Use ISO dates (YYYY-MM-DD) or common European dates (DD.MM.YYYY).`);
  }
  output.sort((a, b) => a.date.localeCompare(b.date));
  if (output.length < 2) throw new Error('Fewer than two valid numeric observations remain in the selected column.');
  return { observations: output, skippedMissing };
}

/** Calculate a causal rolling field at every observation; no future rows are inspected. */
export function calculateZetaField(observations, options = {}) {
  const values = observations.map(item => Number(item.value));
  const windowSize = Math.max(2, Math.trunc(Number(options.window) || 20));
  const dampingValue = Number(options.damping ?? 0.25);
  const damping = Number.isFinite(dampingValue) ? Math.min(0.9, Math.max(0, dampingValue)) : 0.25;
  const hasValidValues = values.every(Number.isFinite);
  if (!hasValidValues) throw new Error('Historical values must all be finite numbers before analysis.');
  const useLogReturns = values.every(value => value > 0);
  const unit = useLogReturns ? '% log-return' : 'Δ value units';
  const series = observations.map((item, index) => ({
    date: item.date,
    value: values[index],
    index,
    change: null,
    baselineCount: 0,
    baselineMean: null,
    baselineStdDev: null,
    zScore: null,
    zeta: null,
    sufficient: false,
    zeroVariance: false
  }));
  for (let index = 1; index < series.length; index++) {
    const previous = values[index - 1];
    const current = values[index];
    series[index].change = useLogReturns ? Math.log(current / previous) * 100 : current - previous;
    const baselineStart = Math.max(1, index - windowSize);
    const baseline = series.slice(baselineStart, index).map(item => item.change).filter(Number.isFinite);
    series[index].baselineCount = baseline.length;
    if (baseline.length !== windowSize) continue;
    const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
    const variance = baseline.reduce((sum, value) => sum + (value - mean) ** 2, 0) / baseline.length;
    const deviation = Math.sqrt(variance);
    series[index].baselineMean = mean;
    series[index].baselineStdDev = deviation;
    series[index].sufficient = true;
    const epsilon = Number.EPSILON * Math.max(1, Math.abs(mean)) * 16;
    if (!(deviation > epsilon)) {
      series[index].zeroVariance = true;
      continue;
    }
    const zScore = (series[index].change - mean) / deviation;
    const previousZeta = index > 1 ? series[index - 1].zeta : null;
    // After unavailable history, seed with the current standardized innovation.
    const zeta = Number.isFinite(previousZeta) ? (1 - damping) * zScore + damping * previousZeta : zScore;
    series[index].zScore = zScore;
    series[index].zeta = zeta;
  }
  return { series, window: windowSize, damping, useLogReturns, unit };
}

export function metricsAt(field, index, threshold = 1.5) {
  const selected = field.series[index];
  if (!selected) throw new RangeError('Selected observation index is outside the historical series.');
  const limit = Number.isFinite(Number(threshold)) ? Math.max(0, Number(threshold)) : 1.5;
  const hasSignal = Number.isFinite(selected.zeta);
  return {
    date: selected.date,
    index,
    count: index + 1,
    totalCount: field.series.length,
    lastValue: selected.value,
    lastReturn: selected.change,
    unit: field.unit,
    baselineCount: selected.baselineCount,
    hasBaseline: selected.sufficient,
    hasSignal,
    zeroVariance: selected.zeroVariance,
    zScore: selected.zScore,
    zeta: selected.zeta,
    signalStrength: hasSignal ? 100 * (1 - Math.exp(-Math.abs(selected.zeta) / 2)) : null,
    triggered: hasSignal && Math.abs(selected.zeta) >= limit,
    method: field.useLogReturns ? 'log returns' : 'raw changes'
  };
}

/** Backwards-compatible summary helper for callers needing just the final observation. */
export function calculateRollingSignal(observations, options = {}) {
  if (!Array.isArray(observations) || observations.length < 2) {
    return { count: observations?.length || 0, lastValue: observations?.at(-1)?.value, lastReturn: null, unit: '', hasBaseline: false, hasSignal: false, zScore: null, signal: null, signalStrength: null, triggered: false, method: 'unavailable' };
  }
  const field = calculateZetaField(observations, options);
  const metrics = metricsAt(field, observations.length - 1, options.threshold ?? 1.5);
  return { ...metrics, signal: metrics.zeta };
}
