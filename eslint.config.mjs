import shared from "@thl/config/eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.medusa/**",
      "**/.dev/**",
      "**/coverage/**",
      "**/*.d.ts",
      "apps/backend/migrations/**",
    ],
  },
  ...shared,
];
