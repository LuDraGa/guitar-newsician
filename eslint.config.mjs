import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".claude/**",
      "backend/**",
      "downloads/**",
      // The Maestro agent is a separate Python (uv) project; its `.venv`
      // vendored JS bundles are not part of the Next app and must not be linted.
      "maestro/**",
      "newsician 2/**",
      "Newsician/**",
    ],
  },
];

export default eslintConfig;
