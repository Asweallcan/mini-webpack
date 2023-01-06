import path from "path";
import { promises as fs } from "fs";

import { manifestTemplate } from "./templates";
import { BundlesMap, Config, Context, Entries, Entry } from "./types";
import { Compilation } from "./Compilation";

const ROOT_DIR = path.dirname(path.resolve(__dirname, "../package.json"));

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
          absolutePath: path.isAbsolute(importPath)
            ? importPath
            : path.join(ROOT_DIR, importPath),
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

  private ensureOutput = async () => {
    let outputDirExists = true;
    try {
      await fs.stat(`${ROOT_DIR}/output`);
    } catch (error) {
      outputDirExists = false;
    }

    if (outputDirExists) {
      await fs.rm(`${ROOT_DIR}/output`, {
        force: true,
        recursive: true,
      });
    }

    await fs.mkdir(`${ROOT_DIR}/output`);
  };

  private createManifestBundle = async () => {
    const { rootdir } = this.context;

    await fs.writeFile(
      `${rootdir}/output/manifest.js`,
      manifestTemplate(this.context.bundlesMap)
    );
  };

  compile = async () => {
    await this.ensureOutput();

    new Compilation(
      Object.entries(this.context.entries)[0][1],
      this.context
    ).compile();

    await this.createManifestBundle();
  };
}
