import * as esbuild from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const clerkPkg = join(root, "node_modules/@clerk/chrome-extension");

function loadEnv() {
  const env = { ...process.env };
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  return env;
}

const env = loadEnv();
const watch = process.argv.includes("--watch");

const options = {
  absWorkingDir: root,
  entryPoints: ["src/popup.js", "src/background.js"],
  bundle: true,
  format: "esm",
  outdir: ".",
  outbase: "src",
  platform: "browser",
  target: ["chrome114"],
  alias: {
    "@clerk/chrome-extension/internal": join(clerkPkg, "dist/esm/chunk-DTSYW65T.js"),
    "@clerk/chrome-extension/background": join(clerkPkg, "dist/esm/background/index.js")
  },
  define: {
    "process.env.CLERK_PUBLISHABLE_KEY": JSON.stringify(env.CLERK_PUBLISHABLE_KEY || "")
  },
  logLevel: "info"
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes…");
} else {
  await esbuild.build(options);
  if (!env.CLERK_PUBLISHABLE_KEY) {
    console.warn(
      "Warning: CLERK_PUBLISHABLE_KEY is empty. Add it to .env and rebuild before testing sign-in."
    );
  }
}
