/**
 * A failing removal of the temporary clone never decides the deploy result.
 * fs/promises is mocked to make the removal fail (e.g. a virus scanner holding a file on Windows).
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const { rmFailures } = vi.hoisted(() => ({ rmFailures: new Set<string>() }));

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    rm: vi.fn(async (target: string, options?: Parameters<typeof actual.rm>[1]) => {
      if ([...rmFailures].some((prefix) => path.basename(target).startsWith(prefix))) {
        throw Object.assign(new Error(`EBUSY: resource busy or locked, rmdir '${target}'`), { code: 'EBUSY' });
      }
      return actual.rm(target, options);
    })
  };
});

import { createBareRepo, fileUrl, tree } from '../../test-helpers/git';
import { publish } from '../lib';

describe('gh-pages-fork publish() with a failing cleanup', () => {
  const user = { name: 'Deploy Bot', email: 'bot@example.org' };
  let tempDir: string;
  let remote: string;
  let dist: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gh-pages-fork-cleanup-'));
    process.env.CACHE_DIR = path.join(tempDir, 'cache');
    remote = createBareRepo(path.join(tempDir, 'remote.git'));
    dist = path.join(tempDir, 'dist');
    await fs.mkdir(dist);
    await fs.writeFile(path.join(dist, 'index.html'), '<h1>test</h1>');
    rmFailures.add('clone-');
  });

  afterEach(async () => {
    rmFailures.clear();
    process.env = originalEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('resolves after a successful push and logs the cleanup error', async () => {
    const messages: string[] = [];

    await publish(dist, { repo: fileUrl(remote), user, nojekyll: false, notfound: false }, (message) => messages.push(message));

    expect(tree(remote)).toEqual(['index.html']);
    expect(messages.at(-1)).toMatch(/^Could not remove the temporary clone .*clone-.*: EBUSY: resource busy or locked/);
  });

  it('rejects with the git error, not the cleanup error, when the push fails', async () => {
    const hook = path.join(remote, 'hooks', 'pre-receive');
    await fs.writeFile(hook, '#!/bin/sh\necho "rejected by hook" >&2\nexit 1\n');
    await fs.chmod(hook, 0o755);

    await expect(publish(dist, { repo: fileUrl(remote), user, nojekyll: false, notfound: false })).rejects.toThrow('rejected by hook');
  });
});
