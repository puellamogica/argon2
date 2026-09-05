import rehypeExpressiveCode from "rehype-expressive-code";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";

const plugin = [
  rehypeExpressiveCode,
  {
    plugins: [pluginLineNumbers(), pluginCollapsibleSections()],
    themes: ["catppuccin-macchiato", "catppuccin-latte"],
    themeCssSelector: (theme) =>
      `[data-theme="${theme.type === "light" ? "acid" : "aqua"}"]`,
  },
];

export default plugin;
