const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

describe('bin/aic.js (composition root smoke)', () => {
  it('requires cleanly without executing the CLI', () => {
    const aic = require('../bin/aic.js');
    expect(aic.program).toBeDefined();
    expect(typeof aic.program.name).toBe('function');
  });

  it('prints a version via subprocess', async () => {
    const { stdout } = await execFileAsync('node', ['bin/aic.js', '--version'], {
      cwd: process.cwd(),
    });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  }, 15000);

  it('lists commands via --help', async () => {
    const { stdout } = await execFileAsync('node', ['bin/aic.js', '--help'], {
      cwd: process.cwd(),
    });
    expect(stdout).toContain('auto');
    expect(stdout).toContain('setup');
  }, 15000);
});
