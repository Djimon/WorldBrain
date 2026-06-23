declare module 'node:fs' {
  export const readFileSync: (path: string, encoding: BufferEncoding) => string;
  export const readdirSync: (
    path: string,
    options: { withFileTypes: true },
  ) => Array<{
    isDirectory: () => boolean;
    isFile: () => boolean;
    name: string;
  }>;
  export const statSync: (path: string) => {
    isDirectory: () => boolean;
  };
}

declare module 'node:path' {
  export const join: (...paths: string[]) => string;
  export const relative: (from: string, to: string) => string;
}
