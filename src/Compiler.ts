import path from "path";
import fs from "fs";

import { Compilation } from "./Compilation";
import { manifestTemplate } from "./templates";
import { BundlesMap, Config, Context, Entries, Entry } from "./types";

const ROOT_DIR = path.dirname(path.resolve(__dirname, "../package.json"));
const OUTPUT_DIR = `${ROOT_DIR}/output`;

export class Compiler {
  config: Config;

  private context: Context;

  constructor(config: Config) {
    this.config = config;
    this.initContext();
  }

  private initContext = () => {
    const bundlesMap: BundlesMap = {};

    const entries: Entries = Object.entries(this.config.entries).reduce(
      (acc, [name, importPath]) => {
        const entry: Entry = {
          name,
          relativePath: path.isAbsolute(importPath)
            ? "./" + path.relative(ROOT_DIR, importPath)
            : importPath,
        };

        acc[name] = entry;

        return acc;
      },
      {}
    );

    this.context = {
      entries,
      rootdir: ROOT_DIR,
      externals: this.config.externals,
      bundlesMap,
      extensions: this.config.resolve?.extensions || [".js"],
      alias: this.config.resolve?.alias || {},
    };
  };

  private ensureOutput = () => {
    let outputDirExists = true;

    try {
      fs.statSync(OUTPUT_DIR);
    } catch (error) {
      outputDirExists = false;
    }

    if (outputDirExists) {
      fs.rmSync(OUTPUT_DIR, {
        force: true,
        recursive: true,
      });
    }

    fs.mkdirSync(OUTPUT_DIR);
  };

  private createManifestBundle = async () => {
    fs.writeFileSync(
      `${OUTPUT_DIR}/manifest.js`,
      manifestTemplate(this.context.bundlesMap)
    );
  };

  compile = () => {
    this.ensureOutput();

    new Compilation(
      Object.entries(this.context.entries)[0][1],
      this.context
    ).compile();

    this.createManifestBundle();
  };
}
