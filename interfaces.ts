export interface GHPages {
  publish(dir: string, options: any): Promise<any>;
}

export interface Project {
  name: string;
  id: string;
}
