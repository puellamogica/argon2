import type { MDXComponents } from "mdx/types";
import { Card, CardGrid, ConfigTable, ErrorTable } from "./app/components/mdx";

const components: MDXComponents = {
  Card,
  CardGrid,
  ConfigTable,
  ErrorTable,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
