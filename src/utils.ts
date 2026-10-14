import type { workspaces } from '@angular-devkit/core';
import type { Tree } from '@angular-devkit/schematics';
import * as fs from 'fs/promises';

/**
 * Check if a path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Workspace host for a schematic tree (ng add).
 *
 * @angular-devkit/schematics is only loaded here: the deploy engine and the
 * standalone CLI import this module too, and must run on every supported
 * Node.js version without the schematics dependencies.
 */
export function createHost(tree: Tree): workspaces.WorkspaceHost {
  return {
    async readFile(path: string): Promise<string> {
      const data = tree.read(path);
      if (!data) {
        const { SchematicsException } = await import('@angular-devkit/schematics');
        throw new SchematicsException('File not found.');
      }
      return data.toString('utf-8');
    },
    async writeFile(path: string, data: string): Promise<void> {
      return tree.overwrite(path, data);
    },
    async isDirectory(path: string): Promise<boolean> {
      return !tree.exists(path) && tree.getDir(path).subfiles.length > 0;
    },
    async isFile(path: string): Promise<boolean> {
      return tree.exists(path);
    }
  };
}
