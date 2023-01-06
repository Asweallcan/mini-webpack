export type Config = {
  entries: Record<string, string>;
  resolve: {
    alias: Record<string, string>;
    extensions: string[];
  };
  externals: Record<string, string>;
};

export type Entry = {
  name: string;
  absolutePath: string;
};

export type Entries = Record<string, Entry>;

export type BundlesMap = Record<
  string, // absolute path
  string // bundle name
>;

export type Graph = Record<number, Asset>;

export type Context = {
  rootdir: string;
  entries: Entries;
  externals: Record<string, any>;
  bundlesMap: BundlesMap;
  extensions: string[];
  alias: Record<string, string>; // import path => absolute or relative path
};

export type Dependency = {
  isAsync: boolean;
  isEntry: boolean;
  isExternal: boolean;
  importPath: string;
  absolutePath: string;
};

export type Asset = {
  id: number;
  code: string;
  mapping: Record<string, number>; // import path => module Id
  bundles: Record<
    string,
    {
      isAsync: boolean;
      absolutePath: string;
    }
  >; // import path =>
  importPath: string;
  absolutePath: string;
  dependencies: Dependency[];
};
