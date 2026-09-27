/**
 * Unit tests for CLIPresenter interactive message selection.
 * selectMessage returns a discriminated result:
 * { action: 'commit', message } | { action: 'regenerate' } | { action: 'cancel' }
 */

const CLIPresenter = require('../src/cli-presenter');

describe('CLIPresenter.selectMessage', () => {
  let presenter;

  const messages = ['feat: add feature', 'fix: resolve bug'];

  /**
   * Fake readline that answers sequentially from a queue of answers.
   */
  const createFakeReadline = answers => {
    let index = 0;
    const rl = {
      question: jest.fn((prompt, callback) => {
        callback(answers[Math.min(index, answers.length - 1)]);
        index++;
      }),
      close: jest.fn(),
    };
    return rl;
  };

  beforeEach(() => {
    presenter = new CLIPresenter({});
    presenter.createReadline = jest.fn(() => createFakeReadline(['1']));
  });

  it('returns a commit result for a picked candidate', async () => {
    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'commit', message: 'feat: add feature' });
  });

  it('defaults to the first candidate on empty input', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'commit', message: 'feat: add feature' });
  });

  it('returns a commit result for a later candidate', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['2']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'commit', message: 'fix: resolve bug' });
  });

  it('returns a commit result for a custom message', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['4', '  my custom message  ']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'commit', message: 'my custom message' });
  });

  it('re-prompts on empty custom message then commits on valid input', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['4', '   ', 'my valid message']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'commit', message: 'my valid message' });
  });

  it('returns a regenerate result', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['3']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'regenerate' });
  });

  it('returns a cancel result', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['5']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'cancel' });
  });

  it('cancels on an invalid choice', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['99']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'cancel' });
  });

  it('closes the readline on every terminal path', async () => {
    const rl = createFakeReadline(['2']);
    presenter.createReadline = jest.fn(() => rl);

    await presenter.selectMessage(messages);

    expect(rl.close).toHaveBeenCalled();
  });
});

describe('CLIPresenter.config', () => {
  const RAW_KEY = 'gsk_test_raw_secret_key';
  let presenter;
  let configManager;

  beforeEach(() => {
    configManager = {
      get: jest.fn().mockResolvedValue(RAW_KEY),
      set: jest.fn().mockResolvedValue(undefined),
      load: jest.fn().mockResolvedValue({ defaultProvider: 'groq', apiKey: RAW_KEY }),
      reset: jest.fn().mockResolvedValue(undefined),
    };
    presenter = new CLIPresenter({ configManager });
  });

  it('masks apiKey on --get', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await presenter.config({ get: 'apiKey' });

    const out = logSpy.mock.calls.flat().map(String).join('\n');
    expect(out).toContain('***configured***');
    expect(out).not.toContain(RAW_KEY);
  });

  it('masks apiKey on --set and never echoes the raw value', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await presenter.config({ set: `apiKey=${RAW_KEY}` });

    expect(configManager.set).toHaveBeenCalledWith('apiKey', RAW_KEY);
    const out = logSpy.mock.calls.flat().map(String).join('\n');
    expect(out).toContain('***masked***');
    expect(out).not.toContain(RAW_KEY);
  });

  it('still prints non-secret values plainly on --get', async () => {
    configManager.get.mockResolvedValue('groq');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await presenter.config({ get: 'defaultProvider' });

    const out = logSpy.mock.calls.flat().map(String).join('\n');
    expect(out).toContain('defaultProvider: groq');
  });
});
