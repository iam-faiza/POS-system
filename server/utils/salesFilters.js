class SalesFilterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SalesFilterError';
    this.status = 400;
  }
}

function dateParts(date, timeZone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
  } catch (error) {
    throw new SalesFilterError('Invalid store time zone');
  }
  const values = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour % 24, minute: values.minute, second: values.second };
}

function localDateKey(date, timeZone) {
  const parts = dateParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function parseDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SalesFilterError('Dates must use YYYY-MM-DD format');
  }
  const [year, month, day] = value.split('-').map(Number);
  const validation = new Date(Date.UTC(year, month - 1, day));
  if (validation.toISOString().slice(0, 10) !== value) {
    throw new SalesFilterError('Date is invalid');
  }
  return { year, month, day };
}

function dateKeyOffset(value, offsetDays) {
  const { year, month, day } = parseDateKey(value);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

function zonedMidnightUtc(dateKey, timeZone) {
  const { year, month, day } = parseDateKey(dateKey);
  const targetUtcMs = Date.UTC(year, month - 1, day);
  let candidateMs = targetUtcMs;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateParts(new Date(candidateMs), timeZone);
    const representedUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = targetUtcMs - representedUtcMs;
    candidateMs += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(candidateMs);
}

function buildSalesDateFilter({ preset, date, startDate, endDate } = {}, timeZone = 'Asia/Karachi', now = new Date()) {
  if (!preset || preset === 'all') return null;

  const today = localDateKey(now, timeZone);
  let firstDate;
  let lastDate;

  if (preset === 'today') {
    firstDate = today;
    lastDate = today;
  } else if (preset === 'yesterday') {
    firstDate = dateKeyOffset(today, -1);
    lastDate = firstDate;
  } else if (preset === 'date') {
    firstDate = date;
    lastDate = date;
  } else if (preset === 'range') {
    firstDate = startDate;
    lastDate = endDate;
  } else if (['week', 'month', 'year'].includes(preset)) {
    const { year, month, day } = parseDateKey(today);
    if (preset === 'week') {
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      firstDate = dateKeyOffset(today, -((weekday + 6) % 7));
      lastDate = today;
    } else if (preset === 'month') {
      firstDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
      lastDate = today;
    } else {
      firstDate = `${String(year).padStart(4, '0')}-01-01`;
      lastDate = today;
    }
  } else {
    throw new SalesFilterError('Unsupported sales date filter');
  }

  parseDateKey(firstDate);
  parseDateKey(lastDate);
  if (firstDate > lastDate) throw new SalesFilterError('Start date must not be after end date');
  const exclusiveLastDate = dateKeyOffset(lastDate, 1);
  return {
    createdAt: {
      $gte: zonedMidnightUtc(firstDate, timeZone),
      $lt: zonedMidnightUtc(exclusiveLastDate, timeZone)
    }
  };
}

function parseSalesPagination({ page, limit } = {}) {
  const parsedPage = page === undefined ? 1 : Number(page);
  const requestedLimit = limit === undefined ? 25 : Number(limit);
  if (!Number.isSafeInteger(parsedPage) || parsedPage < 1 || parsedPage > 1000000) {
    throw new SalesFilterError('Page must be a positive integer');
  }
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    throw new SalesFilterError('Page size must be a positive integer');
  }
  const pageSize = Math.min(requestedLimit, 100);
  return { page: parsedPage, pageSize, skip: (parsedPage - 1) * pageSize };
}

function getStoreTimeZone(env = process.env) {
  const timeZone = env.POS_TIME_ZONE || 'Asia/Karachi';
  dateParts(new Date(0), timeZone);
  return timeZone;
}

module.exports = {
  SalesFilterError,
  buildSalesDateFilter,
  getStoreTimeZone,
  parseSalesPagination,
  zonedMidnightUtc
};