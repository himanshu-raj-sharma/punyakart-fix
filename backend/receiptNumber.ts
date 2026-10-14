export function indianFinancialYear(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 3 ? year : year - 1;

  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}