import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "backend/**",
      "downloads/**",
      "newsician 2/**",
      "Newsician/**",
    ],
  },
];

export default eslintConfig;
