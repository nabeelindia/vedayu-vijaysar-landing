// lib/holidays.js
// Returns Set of 'YYYY-MM-DD' strings that are non-shipping days.
// Includes Indian national holidays for 2025–2026 + Sundays are handled separately.

const HOLIDAYS = new Set([
  // 2025
  '2025-01-26', // Republic Day
  '2025-03-14', // Holi
  '2025-03-31', // Id-ul-Fitr (Eid)
  '2025-04-14', // Ambedkar Jayanti / Dr. B.R. Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-08-15', // Independence Day
  '2025-08-16', // Janmashtami
  '2025-10-02', // Gandhi Jayanti
  '2025-10-20', // Diwali (Lakshmi Puja)
  '2025-11-05', // Guru Nanak Jayanti
  '2025-12-25', // Christmas
  // 2026
  '2026-01-26', // Republic Day
  '2026-03-03', // Holi
  '2026-03-20', // Id-ul-Fitr (Eid)
  '2026-04-03', // Good Friday
  '2026-04-14', // Ambedkar Jayanti
  '2026-08-15', // Independence Day
  '2026-08-04', // Janmashtami
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-08', // Diwali (Lakshmi Puja)
  '2026-11-24', // Guru Nanak Jayanti
  '2026-12-25', // Christmas
]);

/**
 * Returns true if the given Date is a non-shipping day:
 * Sunday (getDay() === 0) or a national holiday.
 */
export function isBlockedDay(date) {
  if (date.getDay() === 0) return true; // Sunday
  const iso = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  return HOLIDAYS.has(iso);
}

/**
 * Returns the Set of holiday date strings (for react-day-picker's `disabled` prop).
 */
export function getHolidayDates() {
  return [...HOLIDAYS].map(iso => new Date(iso));
}

export default HOLIDAYS;
