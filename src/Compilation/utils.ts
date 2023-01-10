import { Entries } from "../types";

export const isNodeModule = (
  importPath: string,
  alias: Record<string, any>
) => {
  return (
    !importPath.startsWith("./") &&
    !importPath.startsWith("../") &&
    !alias[importPath]
  );
};

export const isEntry = (relativePath: string, entries: Entries) => {
  for (const entry of Object.values(entries)) {
    if (entry.relativePath === relativePath) return true;
  }

  return false;
};
