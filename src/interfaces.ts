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
 * Type guard to check if outputPath is a valid object with base/browser properties.
 *
 * Validates:
 * - value is an object (not null, not array)
 * - base property exists and is a non-empty string
 * - browser property, if present, is a string (can be empty for Angular 19+ SPA mode)
 */
export function isOutputPathObject(value: unknown): value is AngularOutputPathObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // base must be a non-empty string
  if (typeof obj.base !== 'string' || obj.base === '') {
    return false;
  }

  // browser, if present, must be a string (empty string is valid for SPA mode)
  if ('browser' in obj && typeof obj.browser !== 'string') {
    return false;
  }

  return true;
}

/**
 * Git user credentials for commits
 */
export interface DeployUser {
  name: string;
  email: string;
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
