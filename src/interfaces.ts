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
  defaultProject?: string;
  projects: Record<string, WorkspaceProject>;
}

export interface BuildTarget {
  name: string;
  options?: { [name: string]: any };
}
