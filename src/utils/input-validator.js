// Final test with new default model
export const validateInput = (input) => {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: must be a non-empty string');
  }
  return input.trim().length > 0;
};
