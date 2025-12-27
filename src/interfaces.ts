/**
 * Angular outputPath configuration
 * Can be either a string (path) or an object with base + browser properties
 * See: https://angular.io/guide/workspace-config#output-path-configuration
 */
export interface AngularOutputPathObject {
  base: string;
  browser?: string;
}

export type AngularOutputPath = string | AngularOutputPathObject;

/**
 * Type guard to check if outputPath is an object with base/browser properties
 */
export function isOutputPathObject(value: unknown): value is AngularOutputPathObject {
  return !!value && typeof value === 'object' && 'base' in value;
}

/**
 * Git user credentials for commits
 */
export interface DeployUser {
  name: string;
  email: string;
}

/**
 * Options for gh-pages.publish()
 * Based on https://github.com/tschaub/gh-pages#options
 *
 * Note: Only includes options that gh-pages actually accepts.
 * Internal options (notfound, noDotfiles, noNotfound, noNojekyll, dryRun)
 * are handled by angular-cli-ghpages before calling gh-pages.
 */
export interface PublishOptions {
  repo?: string;
  remote?: string;
  branch?: string;
  message?: string;
  user?: { name: string; email: string };
  dotfiles?: boolean;
  nojekyll?: boolean;
  cname?: string;
  add?: boolean;
  git?: string;
  [key: string]: unknown; // Allow additional gh-pages options
}

export interface GHPages {
  // gh-pages v5+ supports both callback and Promise-based APIs
  publish(dir: string, options: PublishOptions, callback: (error: Error | null) => void): void;
  publish(dir: string, options: PublishOptions): Promise<void>;
  clean?(): void;
}

export interface ArchitectTarget {
  builder: string;
  options?: {
    outputPath?: string | { base?: string; browser?: string };
    [key: string]: unknown;
  };
}

export interface WorkspaceProject {
  projectType?: string;
  architect?: Record<string, ArchitectTarget>;
}

export interface Workspace {
  projects: Record<string, WorkspaceProject>;
}

export interface BuildTarget {
  name: string;
  options?: {
    outputPath?: string | { base?: string; browser?: string };
    [key: string]: unknown;
  };
}
