import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared lint rules. Deliberately small: this is a correctness gate for CI, not a style
 * opinion generator (formatting is Prettier's job).
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain JS/MJS tooling scripts run in Node; declare the globals they legitimately use.
    files: ["**/*.mjs", "**/*.js", "**/*.cjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        global: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "writable",
        require: "readonly",
        exports: "writable",
      },
    },
  },
  {
    rules: {
      // Rules the project actually depends on — see agent/RULES.md.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": "off",
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },
);
