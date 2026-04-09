const EntityExtractor = require('../src/utils/entity-extractor');

describe('EntityExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new EntityExtractor();
  });

  describe('extractEntities', () => {
    test('extracts functions from diff', () => {
      const diff = '+ function calculateTotal() {}';
      const result = extractor.extractEntities(diff);
      expect(result.functions).toContain('calculateTotal');
    });

    test('extracts classes from diff', () => {
      const diff = '+ class UserManager {}';
      const result = extractor.extractEntities(diff);
      expect(result.classes).toContain('UserManager');
    });

    test('extracts variables from diff', () => {
      const diff = '+ const userCount = 0';
      const result = extractor.extractEntities(diff);
      expect(result.variables).toContain('userCount');
    });

    test('removes duplicates - same entity mentioned twice appears only once', () => {
      const diff = '+ function calculateTotal() {}\n+ const calculateTotal = 5';
      const result = extractor.extractEntities(diff);
      const funcs = result.functions.filter((f) => f === 'calculateTotal');
      expect(funcs).toHaveLength(1);
    });

    test('filters false positives - if, for, while, return not included as functions', () => {
      const diff =
        '+ if (x) {}\n+ for (let i = 0; i < 10; i++) {}\n+ while (true) {}\n+ return true;';
      const result = extractor.extractEntities(diff);
      expect(result.functions).not.toContain('if');
      expect(result.functions).not.toContain('for');
      expect(result.functions).not.toContain('while');
      expect(result.functions).not.toContain('return');
    });

    test('empty diff returns empty arrays', () => {
      const diff = '';
      const result = extractor.extractEntities(diff);
      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.variables).toHaveLength(0);
    });

    test('null diff returns empty arrays', () => {
      const diff = null;
      const result = extractor.extractEntities(diff);
      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.variables).toHaveLength(0);
    });

    test('returns entities with type properties', () => {
      const diff = '+ function calculateTotal() {}\n+ class UserManager {}';
      const result = extractor.extractEntities(diff);
      expect(result.all).toHaveLength(2);
      expect(result.all[0]).toHaveProperty('name');
      expect(result.all[0]).toHaveProperty('type');
    });
  });

  describe('formatEntityListByType', () => {
    test('formats entity list by type', () => {
      const entities = {
        functions: ['calculateTotal', 'updateUser'],
        classes: ['UserManager'],
        variables: ['userCount'],
      };
      const formatted = extractor.formatEntityListByType(entities);
      expect(formatted).toContain('Functions: calculateTotal, updateUser');
      expect(formatted).toContain('Classes: UserManager');
      expect(formatted).toContain('Variables: userCount');
    });

    test('handles empty entity types', () => {
      const entities = {
        functions: [],
        classes: [],
        variables: [],
      };
      const formatted = extractor.formatEntityListByType(entities);
      expect(formatted).toBe('');
    });
  });
});
