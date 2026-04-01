import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json"
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      prettier: prettierPlugin
    },
    rules: {
      // Extend recommended rules
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      "prefer-template": "error",

      // Disable base ESLint rules that are superseded by TypeScript rules
      "no-unused-vars": "off",
      "no-use-before-define": "off",

      // TypeScript-specific rules
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-unsafe-function-type": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true
        }
      ],

      // Type assertions
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression",
          message: "Type assertions are not allowed."
        },
        {
          selector: "TSTypeAssertion",
          message: "Type assertions are not allowed."
        }
      ],

      // Prettier integration
      "prettier/prettier": "error",

      // Disable style rules that conflict with Prettier
      indent: "off",
      "no-console": "off"
    }
  },
  {
    files: ["**/*.spec.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        vitest: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    }
  }
];
