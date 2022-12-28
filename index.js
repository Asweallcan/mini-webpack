const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;

let ID = 0;

const createAsset = (filename) => {
  const content = fs.readFileSync(filename, { encoding: "utf-8" });

  const ast = babel.parseSync(content, { sourceType: "module" });
  const { code } = babel.transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env"],
  });

  const dependencies = [];

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
    CallExpression: ({ node }) => {
      if (node.callee.name === "require") {
        dependencies.push(node.arguments[0].value);
      }
    },
  });

  return {
    id: ID++,
    code,
    filename,
    dependencies,
  };
};

const createGraph = (filename) => {
  const entry = createAsset(filename);

  const graph = [entry];

  for (const asset of graph) {
    const { filename, dependencies } = asset;

    const dirname = path.dirname(filename);

    asset.mapping = {};

    dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);

      const child = createAsset(absolutePath);

      asset.mapping[relativePath] = child.id;

      graph.push(child);
    });
  }

  return graph;
};

const createBundle = (graph) => {
  let modules = "";

  graph.forEach((module) => {
    const { id, code, mapping } = module;

    modules += `${id}: {
        fn: (require, module, exports) => {
            ${code}
        },
        mapping: ${JSON.stringify(mapping)}
    },`;
  });

  return `(function (modules) {
    const require = (moduleId) => {
        const asset = modules[moduleId];

        const { fn, mapping } = asset;

        const module = { exports: {} };

        const localRequire = (relativePath) => {
            return require(mapping[relativePath]);
        }

        fn(localRequire, module, module.exports);

        return module.exports;
    }

    require(0);
  })({${modules}})`;
};

const graph = createGraph("./src/index.js");
const bundle = createBundle(graph);

if (!fs.existsSync("./output")) {
  fs.mkdirSync("./output");
}

fs.writeFileSync("./output/index.js", bundle, {});
