export interface GHPages {
  publish(dir: string, options: any, callback: (error: any) => void);
  clean?(): void;
}

export interface WorkspaceProject {
  projectType?: string;
  architect?: Record<
    string,
    { builder: string; options?: Record<string, any> }
  >;
}

export interface Workspace {
  projects: Record<string, WorkspaceProject>;
}

export interface BuildTarget {
  name: string;
  options?: Record<string, any>;
}

// just for testing, NullLogger can't be imported any longer?
// export const consoleLogger = {
//   log: console.log,
//   debug: console.debug,
//   info: console.info,
//   warn: console.warn,
//   error: console.error,
//   fatal: console.error
// };
