export interface GHPages {
  publish(dir: string, options: any): Promise<any>;
  clean?(): void;
}

export interface Project {
  name: string;
  id: string;
}
