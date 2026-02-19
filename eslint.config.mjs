import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/consistent-type-imports": "error",
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    },
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/.next/**",
            "**/coverage/**",
            "_bmad/**",
            "_bmad-output/**",
        ],
    }
);
