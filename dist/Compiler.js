"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Compiler = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const templates_1 = require("./templates");
const Compilation_1 = require("./Compilation");
const ROOT_DIR = path_1.default.dirname(path_1.default.resolve(__dirname, "../package.json"));
class Compiler {
    config;
    context;
    constructor(config) {
        this.config = config;
        this.initContext();
    }
    initContext = () => {
        const bundlesMap = {};
        const entries = Object.entries(this.config.entries).reduce((acc, [name, importPath]) => {
            const entry = {
                name,
                absolutePath: path_1.default.isAbsolute(importPath)
                    ? importPath
                    : path_1.default.join(ROOT_DIR, importPath),
            };
            acc[name] = entry;
            return acc;
        }, {});
        this.context = {
            entries,
            rootdir: ROOT_DIR,
            externals: this.config.externals,
            bundlesMap,
            extensions: this.config.resolve?.extensions || [".js"],
            alias: this.config.resolve?.alias || {},
        };
    };
    ensureOutput = async () => {
        let outputDirExists = true;
        try {
            await fs_1.promises.stat(`${ROOT_DIR}/output`);
        }
        catch (error) {
            outputDirExists = false;
        }
        if (outputDirExists) {
            await fs_1.promises.rm(`${ROOT_DIR}/output`, {
                force: true,
                recursive: true,
            });
        }
        await fs_1.promises.mkdir(`${ROOT_DIR}/output`);
    };
    createManifestBundle = async () => {
        const { rootdir } = this.context;
        await fs_1.promises.writeFile(`${rootdir}/output/manifest.js`, (0, templates_1.manifestTemplate)(this.context.bundlesMap));
    };
    compile = async () => {
        await this.ensureOutput();
        new Compilation_1.Compilation(Object.entries(this.context.entries)[0][1], this.context).compile();
        await this.createManifestBundle();
    };
}
exports.Compiler = Compiler;
