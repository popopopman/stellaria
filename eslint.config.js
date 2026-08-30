import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tests/**/*.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-console": "off" },
  },
];
