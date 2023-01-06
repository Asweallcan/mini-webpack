"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifestTemplate = void 0;
const manifestTemplate = (bundlesMap) => `
window.__webpackBundlesMap = ${JSON.stringify(bundlesMap)};
window.__webpackLoadedBundles = {};
window.__webpackLoadingBundles = {};

function __interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
}

function __importBundle(absolutePath) {
    const name = __webpackBundlesMap[absolutePath];

    if(__webpackLoadingBundles[absolutePath]) {
        return __webpackLoadingBundles[absolutePath];
    }
    
    if (!__webpackLoadedBundles[name]) {
        __webpackLoadingBundles[absolutePath] = new Promise(resolve => {
            const script = document.createElement("script");

            script.type = "text/javascript";
            script.src = "./" + name + ".js";
            script.onload = () => {
                resolve(__webpackLoadedBundles[name]);

                delete __webpackLoadingBundles[absolutePath];
            };
    
            document.body.appendChild(script);
        })
    } 

    return __webpackLoadedBundles[name]
}

function __require(modules, moduleId) {
    const { fn, mapping, bundles } = modules[moduleId];

    const module = { exports: {} };

    const require = (importPath) => {
      const bundle = bundles[importPath];

      if(bundle) {
        if(__webpackLoadedBundles[__webpackBundlesMap[bundle.absolutePath]]) return __webpackLoadedBundles[__webpackBundlesMap[bundle.absolutePath]];

        return __importBundle(bundle.absolutePath);
      }

      return __require(modules, mapping[importPath]);
    }

    require.ensure = (importPath) => {
        const bundle = bundles[importPath];

        return __importBundle(bundle.absolutePath);
    }

    fn(require, module, module.exports);

    return __interopRequireDefault(module.exports);
}
`;
exports.manifestTemplate = manifestTemplate;
