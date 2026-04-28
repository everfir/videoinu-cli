import { readFileSync } from "node:fs"
import { defineConfig } from "tsup"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  treeshake: true,
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
})
