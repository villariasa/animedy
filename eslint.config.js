// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/animedy_v1/**/*.ts", "src/lib/**/*.ts"],
    languageOptions: {
      parserOptions: {
        sourceType: "module"
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/ui_test/**"]
  }
);
