/**
 * Tests for utils.ts
 */

import { SchematicsException, Tree } from '@angular-devkit/schematics';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { createHost, pathExists } from './utils';

describe('createHost', () => {
  it('should read file from tree', async () => {
    const tree = Tree.empty();
    tree.create('/test.txt', 'hello world');

    const host = createHost(tree);
    const content = await host.readFile('/test.txt');

    expect(content).toBe('hello world');
  });

  it('should throw SchematicsException when file not found', async () => {
    const tree = Tree.empty();
    const host = createHost(tree);

    await expect(host.readFile('/nonexistent.txt')).rejects.toThrow(SchematicsException);
    await expect(host.readFile('/nonexistent.txt')).rejects.toThrow('File not found.');
  });

  it('should write file to tree', async () => {
    const tree = Tree.empty();
    tree.create('/test.txt', 'original');

    const host = createHost(tree);
    await host.writeFile('/test.txt', 'updated');

    expect(tree.read('/test.txt')?.toString()).toBe('updated');
  });

  it('should detect file as file', async () => {
    const tree = Tree.empty();
    tree.create('/file.txt', 'content');

    const host = createHost(tree);

    expect(await host.isFile('/file.txt')).toBe(true);
  });

  it('should detect non-existing path as not a file', async () => {
    const tree = Tree.empty();
    const host = createHost(tree);

    expect(await host.isFile('/nonexistent.txt')).toBe(false);
  });

  it('should detect directory as directory', async () => {
    const tree = Tree.empty();
    tree.create('/subdir/file.txt', 'content');

    const host = createHost(tree);

    expect(await host.isDirectory('/subdir')).toBe(true);
  });

  it('should detect file as not a directory', async () => {
    const tree = Tree.empty();
    tree.create('/file.txt', 'content');

    const host = createHost(tree);

    expect(await host.isDirectory('/file.txt')).toBe(false);
  });
});

describe('pathExists', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pathExists-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return true for existing directory', async () => {
    expect(await pathExists(tempDir)).toBe(true);
  });

  it('should return true for existing file', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'test');

    expect(await pathExists(filePath)).toBe(true);
  });

  it('should return false for non-existing path', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist');

    expect(await pathExists(nonExistentPath)).toBe(false);
  });

  it('should return false for non-existing nested path', async () => {
    const nonExistentPath = '/nonexistent/path/12345/foo/bar';

    expect(await pathExists(nonExistentPath)).toBe(false);
  });
});
