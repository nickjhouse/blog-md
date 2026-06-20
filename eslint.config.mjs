import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bridge eslint-config-next (still eslintrc-format) into ESLint 9 flat config.
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "out/**"] },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
