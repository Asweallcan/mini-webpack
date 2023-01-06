"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Compiler_1 = require("./Compiler");
function webpack(config) {
    process.env.NODE_ENV = "production";
    return new Compiler_1.Compiler(config);
}
exports.default = webpack;
