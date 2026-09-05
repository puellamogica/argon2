/** @type {import("stylelint").Config} */
const config = {
  extends: ["stylelint-config-standard"],
  rules: {
    "import-notation": "string",
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["theme", "plugin"],
      },
    ],
    "at-rule-prelude-no-invalid": [
      true,
      {
        ignoreAtRules: ["apply"],
      },
    ],
  },
};

export default config;
