import path from "path";
import { readFileSync, writeFileSync } from "fs";
import traverse from "@babel/traverse";
import { parseSync, transformFromAstSync } from "@babel/core";
import { blockStatement, identifier, memberExpression } from "@babel/types";

import { bundleTemplate } from "../templates";
import { Asset, Context, Dependency, Entry, Graph } from "../types";
import {
  removeExtension,
  completeAbsolutePathWithExtention,
} from "./extensions";
import { isEntry, isNodeModule } from "./utils";

let ID = 0;

export class Compilation {
  private entry: Entry;
  private context: Context;

  graph: Graph;

  constructor(entry: Entry, context: Context) {
    this.entry = entry;
    this.context = context;

    this.graph = this.createGraph({ entry });
  }

  private createDependency = (params: {
    isAsync: boolean;
    importPath: string;
    parentAbsolutePath: string;
  }): Dependency => {
    const { isAsync, importPath, parentAbsolutePath } = params;

    const { rootdir, alias, extensions, externals } = this.context;

    let absolutePath = "";

    let isExternal = false;

    if (isNodeModule(importPath, alias)) {
      const packageJson = readFileSync(
        `${rootdir}/node_modules/${importPath}/package.json`
      ).toString();

      const { main } = JSON.parse(packageJson);

      absolutePath = `${rootdir}/node_modules/${importPath}/${main}`;

      isExternal = externals[importPath];
    } else if (alias[importPath]) {
      absolutePath = path.isAbsolute(alias[importPath])
        ? alias[importPath]
        : path.join(rootdir, alias[importPath]);
    } else {
      absolutePath = completeAbsolutePathWithExtention(
        path.join(path.dirname(parentAbsolutePath), importPath),
        extensions
      );
    }

    return {
      isAsync,
      isEntry: isEntry(absolutePath, this.context.entries),
      isExternal,
      importPath,
      absolutePath,
    };
  };

  private createAsset = (params: {
    importPath?: string;
    absolutePath: string;
  }) => {
    const { importPath, absolutePath } = params;

    const content = readFileSync(absolutePath, { encoding: "utf-8" }).replace(
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
              parentAbsolutePath: absolutePath,
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
              parentAbsolutePath: absolutePath,
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
              parentAbsolutePath: absolutePath,
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
      id: ID++,
      code: code as string,
      mapping: {},
      bundles: {},
      importPath,
      absolutePath,
      dependencies,
    } as Asset;
  };

  private createGraph = (params: { entry: Entry }) => {
    const { entry } = params;

    const entryAsset = this.createAsset({
      absolutePath: entry.absolutePath,
    });

    const assetsQueue = [entryAsset];

    const addedAssets = {};

    const graph: Graph = {};

    for (const asset of assetsQueue) {
      const { dependencies } = asset;

      for (const dependency of dependencies) {
        if (dependency.isAsync || dependency.isEntry || dependency.isExternal) {
          asset.bundles[dependency.importPath] = {
            isAsync: dependency.isAsync,
            absolutePath: dependency.absolutePath,
          };

          continue;
        }

        if (addedAssets[dependency.absolutePath]) {
          asset.mapping[dependency.importPath] =
            addedAssets[dependency.absolutePath];

          continue;
        }

        const child = this.createAsset({
          importPath: dependency.importPath,
          absolutePath: dependency.absolutePath,
        });

        addedAssets[dependency.absolutePath] = asset.mapping[
          dependency.importPath
        ] = child.id;

        assetsQueue.push(child);
      }

      graph[asset.id] = asset;
    }

    return graph;
  };

  compile = () => {
    const { rootdir } = this.context;

    const { absolutePath } = this.entry;

    if (this.context.bundlesMap[absolutePath]) return;

    for (const { dependencies } of Object.values(this.graph)) {
      for (const dependency of dependencies) {
        const { isAsync, isExternal } = dependency;

        if (this.context.bundlesMap[dependency.absolutePath]) continue;

        if (dependency.isEntry) {
          const [name, entry] = Object.entries(this.context.entries).find(
            ([name, e]) => e.absolutePath === dependency.absolutePath
          );

          if (entry) new Compilation(entry, this.context).compile();
        }

        if (isExternal) {
          const entry = {
            name: dependency.importPath,
            absolutePath: dependency.absolutePath,
          };

          new Compilation(entry, this.context).compile();
        }

        if (!dependency.isEntry && !isExternal && isAsync) {
          const entry = {
            name: removeExtension(
              dependency.absolutePath,
              this.context.extensions
            ),
            absolutePath: dependency.absolutePath,
          };

          new Compilation(entry, this.context).compile();
        }
      }
    }

    const bundle = bundleTemplate({
      name: this.entry.name,
      graph: this.graph,
      absolutePath,
    });

    this.context.bundlesMap[absolutePath] = this.entry.name;

    writeFileSync(`${rootdir}/output/${this.entry.name}.js`, bundle);
  };
}
