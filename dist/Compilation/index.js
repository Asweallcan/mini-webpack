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
const utils_1 = require("./utils");
const extensions_1 = require("./extensions");
let ASSET_ID = 0;
class Compilation {
    entry;
    context;
    graph = {};
    constructor(entry, context) {
        this.entry = entry;
        this.context = context;
        this.createGraph({ entry });
    }
    createDependency = (params) => {
        const { isAsync, importPath, parentRelativePath } = params;
        const { rootdir, alias, extensions, externals } = this.context;
        let relativePath = "";
        let isExternal = false;
        if ((0, utils_1.isNodeModule)(importPath, alias)) {
            const { main } = JSON.parse((0, fs_1.readFileSync)(`${rootdir}/node_modules/${importPath}/package.json`).toString());
            relativePath = `./node_modules/${importPath}/${main}`;
            isExternal = externals[importPath];
        }
        else if (alias[importPath]) {
            relativePath = path_1.default.isAbsolute(alias[importPath])
                ? "./" + path_1.default.relative(rootdir, alias[importPath])
                : alias[importPath];
        }
        else {
            relativePath = (0, extensions_1.completeFilenameWithExtention)("./" + path_1.default.join(path_1.default.dirname(parentRelativePath), importPath), extensions);
        }
        return {
            isAsync,
            isEntry: (0, utils_1.isEntry)(relativePath, this.context.entries),
            isExternal,
            importPath,
            relativePath,
        };
    };
    createAsset = (params) => {
        const { rootdir } = this.context;
        const { importPath, relativePath } = params;
        const content = (0, fs_1.readFileSync)(path_1.default.join(rootdir, relativePath), {
            encoding: "utf-8",
        }).replace(/process\.env\.NODE_ENV\s*([!=]==?)\s*['"](.+?)['"]/g, (match, operator, $1) => {
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
                        parentRelativePath: relativePath,
                    }));
                },
            },
            CallExpression: ({ node }) => {
                if (node.callee.type === "Import") {
                    dependencies.push(this.createDependency({
                        isAsync: true,
                        // @ts-ignore
                        importPath: node.arguments[0].value,
                        parentRelativePath: relativePath,
                    }));
                    node.callee = (0, types_1.memberExpression)((0, types_1.identifier)("require"), (0, types_1.identifier)("ensure"));
                }
                if (node.callee.type === "Identifier" &&
                    node.callee.name === "require") {
                    dependencies.push(this.createDependency({
                        isAsync: false,
                        // @ts-ignore
                        importPath: node.arguments[0].value,
                        parentRelativePath: relativePath,
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
            id: ASSET_ID++,
            code: code,
            mapping: {},
            bundles: {},
            importPath,
            relativePath,
            dependencies,
        };
    };
    createGraph = (params) => {
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
                addedAssets[dependency.relativePath] = asset.mapping[dependency.importPath] = child.id;
                assetsQueue.push(child);
            }
            this.graph[asset.id] = asset;
        }
    };
    compile = () => {
        const { rootdir } = this.context;
        const { relativePath } = this.entry;
        if (this.context.bundlesMap[relativePath])
            return;
        for (const { dependencies } of Object.values(this.graph)) {
            for (const dependency of dependencies) {
                const { isAsync, isExternal } = dependency;
                if (this.context.bundlesMap[dependency.relativePath])
                    continue;
                if (dependency.isEntry) {
                    const [name, entry] = Object.entries(this.context.entries).find(([name, e]) => e.relativePath === dependency.relativePath);
                    if (entry)
                        new Compilation(entry, this.context).compile();
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
                        name: (0, extensions_1.removeExtension)(dependency.relativePath, this.context.extensions),
                        relativePath: dependency.relativePath,
                    };
                    new Compilation(entry, this.context).compile();
                }
            }
        }
        const bundle = (0, templates_1.bundleTemplate)({
            name: this.entry.name,
            graph: this.graph,
            relativePath,
        });
        this.context.bundlesMap[relativePath] = this.entry.name;
        (0, fs_1.writeFileSync)(`${rootdir}/output/${this.entry.name}.js`, bundle);
    };
}
exports.Compilation = Compilation;
