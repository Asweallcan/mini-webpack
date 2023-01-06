"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeExtension = exports.completeAbsolutePathWithExtention = exports.isWithExtension = void 0;
const fs_1 = require("fs");
const isWithExtension = (filename, extensions) => {
    const last = filename.split("/").pop();
    for (let i = 0; i < extensions.length; i++) {
        const extension = extensions[i];
        if (last.endsWith(extension)) {
            return true;
        }
    }
    return false;
};
exports.isWithExtension = isWithExtension;
const completeAbsolutePathWithExtention = (absolutePath, extensions) => {
    if ((0, exports.isWithExtension)(absolutePath, extensions)) {
        return absolutePath;
    }
    for (let i = 0; i < extensions.length; i++) {
        const ext = extensions[i];
        try {
            const res = absolutePath + ext;
            (0, fs_1.statSync)(res);
            return res;
        }
        catch (error) { }
    }
    throw new Error(`No extentsion found valid for ${absolutePath}`);
};
exports.completeAbsolutePathWithExtention = completeAbsolutePathWithExtention;
const removeExtension = (filename, extensions) => {
    if (!(0, exports.isWithExtension)(filename, extensions))
        return filename;
    for (let i = 0; i < extensions.length; i++) {
        const extension = extensions[i];
        if (filename.endsWith(extension)) {
            return filename
                .split("/")
                .pop()
                .replace(new RegExp(`${extension}$`), "");
        }
    }
};
exports.removeExtension = removeExtension;
