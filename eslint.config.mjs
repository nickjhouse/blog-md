// ESLint 9 flat config. eslint-config-next 16 ships a NATIVE flat-config array
// (Linter.Config[]), so we spread it directly. We deliberately no longer use
// @eslint/eslintrc's FlatCompat to bridge "next/core-web-vitals": under v16 the
// plugin objects are circular and FlatCompat throws "Converting circular
// structure to JSON" at config-load time.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // eslint-plugin-react-hooks 7 (bundled by next 16's flat config) promotes
    // several React-Compiler-readiness checks to errors. They flag legitimate
    // existing patterns (on-mount DOM sync, debounced effects, etc.), not bugs,
    // so we keep them as warnings to keep the Next 16 bump isolated. Tracked as
    // separate cleanup before enabling the React Compiler.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // next/core-web-vitals already ignores .next, out, build, next-env.d.ts;
    // add our Cloudflare/OpenNext build output dirs.
    ignores: [".open-next/**", ".wrangler/**"],
  },
];

export default eslintConfig;
