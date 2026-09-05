const env = require('../lib/env');

describe('env', () => {
  it('should return the environment variable if it exists', () => {
    process.env.TEST_KEY = 'test_value';
    expect(env.get('TEST_KEY')).toBe('test_value');
  });

  it('should return the fallback if the environment variable does not exist', () => {
    expect(env.get('NON_EXISTENT_KEY', 'fallback_value')).toBe('fallback_value');
  });
});
