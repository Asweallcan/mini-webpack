"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Compiler = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Compilation_1 = require("./Compilation");
const templates_1 = require("./templates");
const ROOT_DIR = path_1.default.dirname(path_1.default.resolve(__dirname, "../package.json"));
const OUTPUT_DIR = `${ROOT_DIR}/output`;
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
                relativePath: path_1.default.isAbsolute(importPath)
                    ? "./" + path_1.default.relative(ROOT_DIR, importPath)
                    : importPath,
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
    ensureOutput = () => {
        let outputDirExists = true;
        try {
            fs_1.default.statSync(OUTPUT_DIR);
        }
        catch (error) {
            outputDirExists = false;
        }
        if (outputDirExists) {
            fs_1.default.rmSync(OUTPUT_DIR, {
                force: true,
                recursive: true,
            });
        }
        fs_1.default.mkdirSync(OUTPUT_DIR);
    };
    createManifestBundle = async () => {
        fs_1.default.writeFileSync(`${OUTPUT_DIR}/manifest.js`, (0, templates_1.manifestTemplate)(this.context.bundlesMap));
    };
    compile = () => {
        this.ensureOutput();
        new Compilation_1.Compilation(Object.entries(this.context.entries)[0][1], this.context).compile();
        this.createManifestBundle();
    };
}
exports.Compiler = Compiler;
