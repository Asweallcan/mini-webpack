import { Graph } from "../types";

export const bundleTemplate = (params: {
  name: string;
  graph: Graph;
  absolutePath: string;
}) => {
  const { name, graph, absolutePath } = params;

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
      __webpackLoadingBundles["${absolutePath}"]?.resolve?.(__webpackLoadedBundles["${name}"]);
    })({${modules}})
    `;
};
