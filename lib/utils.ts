import type { Category } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function inr(value: number): string {
  if (!Number.isFinite(value)) {
    return "₹0";
  }

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export const CHART_COLORS = [
  "#D4AF37",
  "#10B981",
  "#F43F5E",
  "#3B82F6",
  "#8B5CF6",
] as const;

export const AVAILABLE_TAGS = [
  "Gluten-Free",
  "Nut-Free",
  "Vegan",
  "Jain",
  "Keto",
  "Spicy",
] as const;

export function getCategoryPath(
  catId: string,
  cats: readonly Category[],
): string {
  if (!catId || !Array.isArray(cats) || cats.length === 0) {
    return "";
  }

  const categoryMap = new Map<string, Category>();

  for (const category of cats) {
    if (category?.id) {
      categoryMap.set(category.id, category);
    }
  }

  const path: string[] = [];
  const visited = new Set<string>();

  let currentId: string | null = catId;

  while (currentId) {
    if (visited.has(currentId)) {
      return "Circular Loop";
    }

    visited.add(currentId);

    const category = categoryMap.get(currentId);

    if (!category) {
      return path.length > 0 ? path.reverse().join(" → ") : "";
    }

    path.push(category.name);
    currentId = category.parent_id ?? null;
  }

  return path.reverse().join(" → ");
}

export function getDescendantIds(
  catId: string,
  cats: readonly Category[],
): string[] {
  if (!catId || !Array.isArray(cats) || cats.length === 0) {
    return [];
  }

  const childrenByParent = new Map<string, string[]>();

  for (const category of cats) {
    if (!category?.id || !category.parent_id) {
      continue;
    }

    const children = childrenByParent.get(category.parent_id) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parent_id, children);
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const stack: string[] = [catId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    result.push(currentId);

    const children = childrenByParent.get(currentId);

    if (!children) {
      continue;
    }

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return result;
}
