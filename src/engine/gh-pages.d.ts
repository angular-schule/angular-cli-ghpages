/**
 * Type declarations for gh-pages internal modules
 *
 * gh-pages/lib/git is an internal API we use to get the remote URL.
 * See engine.prepare-options-helpers.ts for usage and upgrade risk documentation.
 */
declare module 'gh-pages/lib/git' {
  class Git {
    constructor(cwd: string, git?: string);
    getRemoteUrl(remote?: string): Promise<string>;
  }
  export = Git;
}
