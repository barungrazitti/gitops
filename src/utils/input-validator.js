// Final test with new default model
const validateInput = (input) => {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: must be a non-empty string');
  }
  if (input.trim().length === 0) {
    throw new Error('Invalid input: must be a non-empty string');
  }
  return true;
};

module.exports = {
  validateInput
};
