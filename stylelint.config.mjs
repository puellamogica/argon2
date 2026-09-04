/** @type {import("stylelint").Config} */
const config = {
  extends: ["stylelint-config-standard"],
  rules: {
    "import-notation": "string",
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["theme"],
      },
    ],
  },
};

export default config;
