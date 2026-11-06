import { build } from "esbuild";
import { cp, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/background.ts", "src/content.ts", "src/options.ts"],
  outdir: "dist",
  bundle: true,
  // Content scripts are not modules, and an IIFE works for the other two as well.
  format: "iife",
  target: "chrome120",
  minify: true,
});
await cp("static", "dist", { recursive: true });
