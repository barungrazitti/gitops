// Updated utility function
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};
// Adding new utility function for date formatting

export function formatDate(date) { return date.toISOString().split('T')[0]; }
