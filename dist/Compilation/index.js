"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Compilation = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const traverse_1 = __importDefault(require("@babel/traverse"));
const core_1 = require("@babel/core");
const types_1 = require("@babel/types");
const templates_1 = require("../templates");
const extensions_1 = require("./extensions");
const utils_1 = require("./utils");
let ID = 0;
class Compilation {
    entry;
    context;
    graph;
    constructor(entry, context) {
        this.entry = entry;
        this.context = context;
        this.graph = this.createGraph({ entry });
    }
    createDependency = (params) => {
        const { isAsync, importPath, parentAbsolutePath } = params;
        const { rootdir, alias, extensions, externals } = this.context;
        let absolutePath = "";
        let isExternal = false;
        if ((0, utils_1.isNodeModule)(importPath, alias)) {
            const packageJson = (0, fs_1.readFileSync)(`${rootdir}/node_modules/${importPath}/package.json`).toString();
            const { main } = JSON.parse(packageJson);
            absolutePath = `${rootdir}/node_modules/${importPath}/${main}`;
            isExternal = externals[importPath];
        }
        else if (alias[importPath]) {
            absolutePath = path_1.default.isAbsolute(alias[importPath])
                ? alias[importPath]
                : path_1.default.join(rootdir, alias[importPath]);
        }
        else {
            absolutePath = (0, extensions_1.completeAbsolutePathWithExtention)(path_1.default.join(path_1.default.dirname(parentAbsolutePath), importPath), extensions);
        }
        return {
            isAsync,
            isEntry: (0, utils_1.isEntry)(absolutePath, this.context.entries),
            isExternal,
            importPath,
            absolutePath,
        };
    };
    createAsset = (params) => {
        const { importPath, absolutePath } = params;
        const content = (0, fs_1.readFileSync)(absolutePath, { encoding: "utf-8" }).replace(/process\.env\.NODE_ENV\s*([!=]==?)\s*['"](.+?)['"]/g, (match, operator, $1) => {
            return eval(`"${process.env.NODE_ENV}" ${operator} "${$1}"`);
        });
        const ast = (0, core_1.parseSync)(content, {
            sourceType: "module",
            presets: ["@babel/preset-react"],
        });
        const dependencies = [];
        (0, traverse_1.default)(ast, {
            ImportDeclaration: {
                exit: (path) => {
                    const { node } = path;
                    const { source } = node;
                    const importPath = source.value;
                    dependencies.push(this.createDependency({
                        isAsync: false,
                        importPath,
                        parentAbsolutePath: absolutePath,
                    }));
                },
            },
            CallExpression: ({ node }) => {
                if (node.callee.type === "Import") {
                    dependencies.push(this.createDependency({
                        isAsync: true,
                        // @ts-ignore
                        importPath: node.arguments[0].value,
                        parentAbsolutePath: absolutePath,
                    }));
                    node.callee = (0, types_1.memberExpression)((0, types_1.identifier)("require"), (0, types_1.identifier)("ensure"));
                }
                if (node.callee.type === "Identifier" &&
                    node.callee.name === "require") {
                    dependencies.push(this.createDependency({
                        isAsync: false,
                        // @ts-ignore
                        importPath: node.arguments[0].value,
                        parentAbsolutePath: absolutePath,
                    }));
                }
            },
            IfStatement: ({ node }) => {
                if (node.test.type === "BooleanLiteral") {
                    if (node.test.value) {
                        if (!node.alternate)
                            return;
                        node.alternate = (0, types_1.blockStatement)([]);
                    }
                    else {
                        node.consequent = (0, types_1.blockStatement)([]);
                    }
                }
            },
        });
        const { code } = (0, core_1.transformFromAstSync)(ast, undefined, {
            presets: ["@babel/preset-env", "@babel/preset-react"],
            comments: false,
            minified: true,
        });
        return {
            id: ID++,
            code: code,
            mapping: {},
            bundles: {},
            importPath,
            absolutePath,
            dependencies,
        };
    };
    createGraph = (params) => {
        const { entry } = params;
        const entryAsset = this.createAsset({
            absolutePath: entry.absolutePath,
        });
        const assetsQueue = [entryAsset];
        const addedAssets = {};
        const graph = {};
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
                addedAssets[dependency.absolutePath] = asset.mapping[dependency.importPath] = child.id;
                assetsQueue.push(child);
            }
            graph[asset.id] = asset;
        }
        return graph;
    };
    compile = () => {
        const { rootdir } = this.context;
        const { absolutePath } = this.entry;
        if (this.context.bundlesMap[absolutePath])
            return;
        for (const { dependencies } of Object.values(this.graph)) {
            for (const dependency of dependencies) {
                const { isAsync, isExternal } = dependency;
                if (this.context.bundlesMap[dependency.absolutePath])
                    continue;
                if (dependency.isEntry) {
                    const [name, entry] = Object.entries(this.context.entries).find(([name, e]) => e.absolutePath === dependency.absolutePath);
                    if (entry)
                        new Compilation(entry, this.context).compile();
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
                        name: (0, extensions_1.removeExtension)(dependency.absolutePath, this.context.extensions),
                        absolutePath: dependency.absolutePath,
                    };
                    new Compilation(entry, this.context).compile();
                }
            }
        }
        const bundle = (0, templates_1.bundleTemplate)({
            name: this.entry.name,
            graph: this.graph,
            absolutePath,
        });
        this.context.bundlesMap[absolutePath] = this.entry.name;
        (0, fs_1.writeFileSync)(`${rootdir}/output/${this.entry.name}.js`, bundle);
    };
}
exports.Compilation = Compilation;
