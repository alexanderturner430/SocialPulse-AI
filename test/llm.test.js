const { askLLM } = require('../lib/llm');
const OpenAI = require('openai');

jest.mock('openai');

describe('askLLM', () => {
  it('should ask the LLM and return the content', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'test response' } }]
    });
    OpenAI.prototype.chat = { completions: { create: mockCreate } };

    const response = await askLLM('test prompt');
    expect(response).toBe('test response');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'test prompt' }
      ]
    }));
  });
});
