import type { MDXComponents } from "mdx/types";
import { Card, CardGrid, ErrorTable } from "./app/components/mdx";

const components: MDXComponents = {
  Card,
  CardGrid,
  ErrorTable,
  h1: ({ children }) => <h1 className="text-4xl font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="text-2xl font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xl font-bold">{children}</h3>,
  h4: ({ children }) => <h4 className="text-lg font-bold">{children}</h4>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
