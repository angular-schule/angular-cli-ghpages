/**
 * Options for gh-pages.publish()
 * Based on https://github.com/tschaub/gh-pages#options
 */
export interface PublishOptions {
  repo?: string;
  remote?: string;
  branch?: string;
  message?: string;
  user?: { name: string; email: string };
  dotfiles?: boolean;
  notfound?: boolean;
  nojekyll?: boolean;
  noDotfiles?: boolean;
  noNotfound?: boolean;
  noNojekyll?: boolean;
  cname?: string;
  add?: boolean;
  git?: string;
  dryRun?: boolean;
  [key: string]: unknown; // Allow additional gh-pages options
}

export interface GHPages {
  publish(dir: string, options: PublishOptions, callback: (error: Error | null) => void): void;
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
