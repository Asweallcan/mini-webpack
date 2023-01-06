import { BundlesMap } from "../types";

export const manifestTemplate = (bundlesMap: BundlesMap) => `
window.__webpackBundlesMap = ${JSON.stringify(bundlesMap)};
window.__webpackLoadedBundles = {};
window.__webpackLoadingBundles = {};
function __importPreBundles(modules) {
    const bundles = Object.values(modules).map(m => Object.values(m.bundles)).flat().filter(b => !b.isAsync);
    return Promise.all(bundles.map(b => __importBundle(b.absolutePath)));
}
function __importBundle(absolutePath) {
    const name = __webpackBundlesMap[absolutePath];
    if(__webpackLoadedBundles[name]) return __webpackLoadedBundles[name];
    if(__webpackLoadingBundles[absolutePath]) return __webpackLoadingBundles[absolutePath].promise;
    __webpackLoadingBundles[absolutePath] = {};
    return (__webpackLoadingBundles[absolutePath].promise = new Promise(resolve => {
        __webpackLoadingBundles[absolutePath].resolve = (params) => {
            resolve(params);
            delete __webpackLoadingBundles[absolutePath];
        }
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = "./" + name + ".js";
        document.body.appendChild(script);
    }));
}
function __require(modules, id) {
    const { fn, mapping, bundles } = modules[id];
    const module = { exports: {} };
    const require = (importPath) => {
      const bundle = bundles[importPath];
      if(bundle) return __webpackLoadedBundles[__webpackBundlesMap[bundle.absolutePath]];
      return __require(modules, mapping[importPath]);
    }
    require.ensure = importPath => __importBundle(bundles[importPath].absolutePath);
    fn(require, module, module.exports);
    return module.exports;
}
`;
