"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEntry = exports.isNodeModule = void 0;
const isNodeModule = (importPath, alias) => {
    return (!importPath.startsWith("./") &&
        !importPath.startsWith("../") &&
        !alias[importPath]);
};
exports.isNodeModule = isNodeModule;
const isEntry = (absolutePath, entries) => {
    for (const entry of Object.values(entries)) {
        if (entry.absolutePath === absolutePath)
            return true;
    }
    return false;
};
exports.isEntry = isEntry;
