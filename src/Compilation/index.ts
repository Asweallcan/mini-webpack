import path from "path";
import { readFileSync, writeFileSync } from "fs";
import traverse from "@babel/traverse";
import { parseSync, transformFromAstSync } from "@babel/core";
import { blockStatement, identifier, memberExpression } from "@babel/types";

import { bundleTemplate } from "../templates";
import { isEntry, isNodeModule } from "./utils";
import { Asset, Context, Dependency, Entry, Graph } from "../types";
import { removeExtension, completeFilenameWithExtention } from "./extensions";

let ASSET_ID = 0;

export class Compilation {
  private entry: Entry;
  private context: Context;

  graph: Graph = {};

  constructor(entry: Entry, context: Context) {
    this.entry = entry;
    this.context = context;
    this.createGraph({ entry });
  }

  private createDependency = (params: {
    isAsync: boolean;
    importPath: string;
    parentRelativePath: string;
  }): Dependency => {
    const { isAsync, importPath, parentRelativePath } = params;

    const { rootdir, alias, extensions, externals } = this.context;

    let relativePath = "";

    let isExternal = false;

    if (isNodeModule(importPath, alias)) {
      const { main } = JSON.parse(
        readFileSync(
          `${rootdir}/node_modules/${importPath}/package.json`
        ).toString()
      );

      relativePath = `./node_modules/${importPath}/${main}`;

      isExternal = externals[importPath];
    } else if (alias[importPath]) {
      relativePath = path.isAbsolute(alias[importPath])
        ? "./" + path.relative(rootdir, alias[importPath])
        : alias[importPath];
    } else {
      relativePath = completeFilenameWithExtention(
        "./" + path.join(path.dirname(parentRelativePath), importPath),
        extensions
      );
    }

    return {
      isAsync,
      isEntry: isEntry(relativePath, this.context.entries),
      isExternal,
      importPath,
      relativePath,
    };
  };

  private createAsset = (params: {
    importPath?: string;
    relativePath: string;
  }) => {
    const { rootdir } = this.context;

    const { importPath, relativePath } = params;

    const content = readFileSync(path.join(rootdir, relativePath), {
      encoding: "utf-8",
    }).replace(
      /process\.env\.NODE_ENV\s*([!=]==?)\s*['"](.+?)['"]/g,
      (match, operator: string, $1: string) => {
        return eval(`"${process.env.NODE_ENV}" ${operator} "${$1}"`);
      }
    );

    const ast = parseSync(content, {
      sourceType: "module",
      presets: ["@babel/preset-react"],
    });

    const dependencies: Array<Dependency> = [];

    traverse(ast, {
      ImportDeclaration: {
        exit: (path) => {
          const { node } = path;
          const { source } = node;

          const importPath = source.value;

          dependencies.push(
            this.createDependency({
              isAsync: false,
              importPath,
              parentRelativePath: relativePath,
            })
          );
        },
      },
      CallExpression: ({ node }) => {
        if (node.callee.type === "Import") {
          dependencies.push(
            this.createDependency({
              isAsync: true,
              // @ts-ignore
              importPath: node.arguments[0].value,
              parentRelativePath: relativePath,
            })
          );

          node.callee = memberExpression(
            identifier("require"),
            identifier("ensure")
          );
        }

        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          dependencies.push(
            this.createDependency({
              isAsync: false,
              // @ts-ignore
              importPath: node.arguments[0].value,
              parentRelativePath: relativePath,
            })
          );
        }
      },
      IfStatement: ({ node }) => {
        if (node.test.type === "BooleanLiteral") {
          if (node.test.value) {
            if (!node.alternate) return;

            node.alternate = blockStatement([]);
          } else {
            node.consequent = blockStatement([]);
          }
        }
      },
    });

    const { code } = transformFromAstSync(ast!, undefined, {
      presets: ["@babel/preset-env", "@babel/preset-react"],
      comments: false,
      minified: true,
    })!;

    return {
      id: ASSET_ID++,
      code: code as string,
      mapping: {},
      bundles: {},
      importPath,
      relativePath,
      dependencies,
    } as Asset;
  };

  private createGraph = (params: { entry: Entry }) => {
    const { entry } = params;

    const entryAsset = this.createAsset({
      relativePath: entry.relativePath,
    });

    const assetsQueue = [entryAsset];

    const addedAssets = {};

    for (const asset of assetsQueue) {
      const { dependencies } = asset;

      for (const dependency of dependencies) {
        if (dependency.isAsync || dependency.isEntry || dependency.isExternal) {
          asset.bundles[dependency.importPath] = {
            isAsync: dependency.isAsync,
            relativePath: dependency.relativePath,
          };

          continue;
        }

        if (addedAssets[dependency.relativePath]) {
          asset.mapping[dependency.importPath] =
            addedAssets[dependency.relativePath];

          continue;
        }

        const child = this.createAsset({
          importPath: dependency.importPath,
          relativePath: dependency.relativePath,
        });

        addedAssets[dependency.relativePath] = asset.mapping[
          dependency.importPath
        ] = child.id;

        assetsQueue.push(child);
      }

      this.graph[asset.id] = asset;
    }
  };

  compile = () => {
    const { rootdir } = this.context;

    const { relativePath } = this.entry;

    if (this.context.bundlesMap[relativePath]) return;

    for (const { dependencies } of Object.values(this.graph)) {
      for (const dependency of dependencies) {
        const { isAsync, isExternal } = dependency;

        if (this.context.bundlesMap[dependency.relativePath]) continue;

        if (dependency.isEntry) {
          const [name, entry] = Object.entries(this.context.entries).find(
            ([name, e]) => e.relativePath === dependency.relativePath
          );

          if (entry) new Compilation(entry, this.context).compile();
        }

        if (isExternal) {
          const entry = {
            name: dependency.importPath,
            relativePath: dependency.relativePath,
          };

          new Compilation(entry, this.context).compile();
        }

        if (!dependency.isEntry && !isExternal && isAsync) {
          const entry = {
            name: removeExtension(
              dependency.relativePath,
              this.context.extensions
            ),
            relativePath: dependency.relativePath,
          };

          new Compilation(entry, this.context).compile();
        }
      }
    }

    const bundle = bundleTemplate({
      name: this.entry.name,
      graph: this.graph,
      relativePath,
    });

    this.context.bundlesMap[relativePath] = this.entry.name;

    writeFileSync(`${rootdir}/output/${this.entry.name}.js`, bundle);
  };
}
