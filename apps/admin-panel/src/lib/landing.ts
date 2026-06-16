import { nav } from "@/components/layout/Sidebar";

/**
 * The first route (in sidebar order) the current admin is permitted to open,
 * or null when they can access nothing. Used to land an admin who lacks
 * `dashboard.view` on a useful page instead of the (blocked) dashboard —
 * mirrors the same `can()` filter the sidebar applies, so the landing target
 * is always a nav item they can actually see.
 */
export function firstAllowedPath(
  can: (permission?: string) => boolean,
): string | null {
  for (const section of nav) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          if (can(child.perm)) return child.href;
        }
      } else if (item.href && can(item.perm)) {
        return item.href;
      }
    }
  }
  return null;
}
