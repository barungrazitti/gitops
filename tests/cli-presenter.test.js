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

  it('cancels on an empty custom message', async () => {
    presenter.createReadline = jest.fn(() => createFakeReadline(['4', '   ']));

    const result = await presenter.selectMessage(messages);

    expect(result).toEqual({ action: 'cancel' });
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
