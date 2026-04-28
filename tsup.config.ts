import { defineConfig } from "tsup"

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  sourcemap: false,
  banner: { js: "#!/usr/bin/env node" },
  env: {
    NODE_ENV: process.env.NODE_ENV ?? (options.watch ? "development" : "production"),
  },
  treeshake: true,
}))
