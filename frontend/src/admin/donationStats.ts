import { AdminDonation, CertificateLogRow } from './adminTypes';

export function isSuccessfulDonation(status: string): boolean {
  const value = status.toLowerCase();
  return value === 'verified' || value === 'completed';
}

export function parseLooseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

export function donationDate(row: AdminDonation): Date | null {
  return parseLooseDate(row.verifiedAt) || parseLooseDate(row.timestamp);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const weekday = day.getDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - offset);
  return day;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export interface PeriodTotals {
  label: string;
  amount: number;
  count: number;
  previousAmount: number;
  previousCount: number;
}

export interface DailyPoint {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface NamedTotal {
  name: string;
  amount: number;
  count: number;
}

export interface DonationStats {
  today: PeriodTotals;
  week: PeriodTotals;
  month: PeriodTotals;
  allTime: PeriodTotals;
  averageTicket: number;
  uniqueDonors: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  daily: DailyPoint[];
  causes: NamedTotal[];
  fundRaisers: NamedTotal[];
  cities: NamedTotal[];
  eightyG: {
    today: number;
    week: number;
    month: number;
    allTime: number;
  };
}

function inRange(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false;
  return date >= start && date < end;
}

function totalsFor(
  rows: AdminDonation[],
  label: string,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date,
): PeriodTotals {
  const current = rows.filter((row) => inRange(donationDate(row), start, end));
  const previous = rows.filter((row) => inRange(donationDate(row), prevStart, prevEnd));
  return {
    label,
    amount: current.reduce((sum, row) => sum + row.amount, 0),
    count: current.length,
    previousAmount: previous.reduce((sum, row) => sum + row.amount, 0),
    previousCount: previous.length,
  };
}

function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function periodChangeLabel(period: PeriodTotals): string {
  const pct = changePct(period.amount, period.previousAmount);
  if (pct === null) return 'No prior period';
  if (pct === 0) return 'Flat vs last period';
  return `${pct > 0 ? '+' : ''}${pct}% vs last period`;
}

function ymd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function shortDay(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function countCerts(rows: CertificateLogRow[], start: Date, end: Date): number {
  return rows.filter((row) => inRange(parseLooseDate(row.downloadedAt), start, end)).length;
}

export function buildDonationStats(
  donations: AdminDonation[],
  certificates: CertificateLogRow[],
  now = new Date(),
): DonationStats {
  const successful = donations.filter((row) => isSuccessfulDonation(row.status));
  const todayStart = startOfDay(now);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const weekStart = startOfWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const monthStart = startOfMonth(now);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

  const allStart = new Date(2000, 0, 1);
  const farFuture = new Date(now.getFullYear() + 1, 0, 1);

  const today = totalsFor(successful, 'Today', todayStart, tomorrow, yesterdayStart, todayStart);
  const week = totalsFor(successful, 'This week', weekStart, nextWeek, lastWeekStart, weekStart);
  const month = totalsFor(successful, 'This month', monthStart, nextMonth, lastMonthStart, monthStart);
  const allTime = totalsFor(successful, 'All time', allStart, farFuture, allStart, allStart);
  allTime.previousAmount = 0;
  allTime.previousCount = 0;

  const daily: DailyPoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const rows = successful.filter((row) => inRange(donationDate(row), day, next));
    daily.push({
      key: ymd(day),
      label: shortDay(day),
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      count: rows.length,
    });
  }

  const causeMap = new Map<string, NamedTotal>();
  const raiserMap = new Map<string, NamedTotal>();
  const cityMap = new Map<string, NamedTotal>();
  const cityFromAddress = (address: string): string => {
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    return parts.at(-1) || 'Unknown';
  };
  for (const row of successful) {
    const cause = row.causeTitle || 'Unspecified';
    const causeEntry = causeMap.get(cause) || { name: cause, amount: 0, count: 0 };
    causeEntry.amount += row.amount;
    causeEntry.count += 1;
    causeMap.set(cause, causeEntry);

    const raiser = row.fundRaiser || 'Unassigned';
    const raiserEntry = raiserMap.get(raiser) || { name: raiser, amount: 0, count: 0 };
    raiserEntry.amount += row.amount;
    raiserEntry.count += 1;
    raiserMap.set(raiser, raiserEntry);

    const city = cityFromAddress(row.address || '');
    const cityEntry = cityMap.get(city) || { name: city, amount: 0, count: 0 };
    cityEntry.amount += row.amount;
    cityEntry.count += 1;
    cityMap.set(city, cityEntry);
  }

  const failedCount = donations.filter((row) => row.status.toLowerCase() === 'failed').length;
  const pendingCount = donations.filter((row) => {
    const status = row.status.toLowerCase();
    return status === 'initiated' || status === 'pending_verification';
  }).length;
  const decided = successful.length + failedCount;

  return {
    today,
    week,
    month,
    allTime,
    averageTicket: successful.length ? Math.round(allTime.amount / successful.length) : 0,
    uniqueDonors: new Set(successful.map((row) => row.email || row.phone || row.fullName)).size,
    failedCount,
    pendingCount,
    successRate: decided ? Math.round((successful.length / decided) * 100) : 0,
    daily,
    causes: [...causeMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 6),
    fundRaisers: [...raiserMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 6),
    cities: [...cityMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 8),
    eightyG: {
      today: countCerts(
        certificates.filter((row) => (row.downloadCount || 0) > 0 || row.source !== 'issued'),
        todayStart,
        tomorrow,
      ),
      week: countCerts(
        certificates.filter((row) => (row.downloadCount || 0) > 0 || row.source !== 'issued'),
        weekStart,
        nextWeek,
      ),
      month: countCerts(
        certificates.filter((row) => (row.downloadCount || 0) > 0 || row.source !== 'issued'),
        monthStart,
        nextMonth,
      ),
      allTime: certificates.filter((row) => (row.downloadCount || 0) > 0 || row.source !== 'issued')
        .length,
    },
  };
}
