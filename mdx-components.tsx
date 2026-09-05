import type { MDXComponents } from "mdx/types";
import { Card, CardGrid, ErrorTable } from "./app/components/mdx";

const components: MDXComponents = {
  Card,
  CardGrid,
  ErrorTable,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
