export interface GHPages {
  publish(dir: string, options: any, callback: (error: any) => void);
  clean?(): void;
}
