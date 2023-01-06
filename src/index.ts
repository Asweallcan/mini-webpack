import { Config } from "./types";
import { Compiler } from "./Compiler";

function webpack(config: Config) {
  process.env.NODE_ENV = "production";

  return new Compiler(config);
}

export default webpack;
