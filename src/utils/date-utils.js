// Updated utility function
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

// Simple ISO date formatter
export const formatDateISO = (date) => {
  return date.toISOString().split('T')[0];
};
