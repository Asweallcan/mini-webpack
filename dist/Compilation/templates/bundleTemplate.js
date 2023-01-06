"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bundleTemplate = void 0;
const bundleTemplate = (params) => {
    const { name, graph } = params;
    let modules = "";
    Object.values(graph).forEach((module) => {
        const { id, code, mapping, bundles } = module;
        modules += `${id}: {
          fn: (require, module, exports) => {${code}},
          mapping: ${JSON.stringify(mapping)},
          bundles: ${JSON.stringify(bundles)}
        },`;
    });
    return `
    (async function (modules) {
      if (__webpackLoadedBundles["${name}"]) return;

      __webpackLoadedBundles["${name}"] = await __require(modules, Object.keys(modules)[0]);
    })({${modules}})
    `;
};
exports.bundleTemplate = bundleTemplate;
