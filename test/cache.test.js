const cache = require('../lib/cache');

describe('cache', () => {
  beforeEach(() => {
    cache.clear();
  });

  test('should set and get a value', () => {
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  test('should return null for non-existent key', () => {
    expect(cache.get('non-existent')).toBeNull();
  });

  test('should delete a key', () => {
    cache.set('key', 'value');
    cache.del('key');
    expect(cache.get('key')).toBeNull();
  });

  test('should expire items after TTL', async () => {
    cache.set('key', 'value', 10);
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(cache.get('key')).toBeNull();
  });
});
