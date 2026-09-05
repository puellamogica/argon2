import createMDX from "@next/mdx";
import path from "node:path";
import type { NextConfig } from "next";

const mdxPluginPath = (fileName: string) =>
  path.join(process.cwd(), "lib", "mdx", fileName);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [mdxPluginPath("rehype-expressive-code.mjs")],
  },
});

export default withMDX(nextConfig);
