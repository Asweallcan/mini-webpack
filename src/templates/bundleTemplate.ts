import { Graph } from "../types";

export const bundleTemplate = (params: {
  name: string;
  graph: Graph;
  relativePath: string;
}) => {
  const { name, graph, relativePath } = params;

  const modules = Object.values(graph).reduce((acc, module) => {
    const { id, code, mapping, bundles } = module;

    acc += `${id}: {
          fn: (require, module, exports) => {${code}},
          mapping: ${JSON.stringify(mapping)},
          bundles: ${JSON.stringify(bundles)}
        },`;

    return acc;
  }, "");

  return `
    (async function (modules) {
      if (__webpackLoadedBundles["${name}"]) return;
      await __importPreBundles(modules);
      __webpackLoadedBundles["${name}"] = __require(modules, Object.keys(modules)[0]);
      __webpackLoadingBundles["${relativePath}"]?.resolve?.(__webpackLoadedBundles["${name}"]);
    })({${modules}})
    `;
};
