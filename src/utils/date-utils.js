// Utility functions for date validation
export function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatDate(date, format = "YYYY-MM-DD") {
  if (!isValidDate(date)) return "";
  return date.toISOString().split("T")[0];
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
