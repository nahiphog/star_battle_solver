export type Page = "backtracking" | "techniques" | "technique-list" | "generation";

export function createRoutes(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  const paths: Record<Page, string> = {
    backtracking: "/solve_via_backtracking",
    techniques: "/solve_with_given_techniques",
    "technique-list": "/techniques_list",
    generation: "/puzzle_generation",
  };
  const pageToRoute = Object.fromEntries(
    Object.entries(paths).map(([page, path]) => [page, `${base}${path}`]),
  ) as Record<Page, string>;
  const routeToPage = (pathname: string): Page => {
    const path = (base && pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname).replace(/\/$/, "");
    // Keep existing bookmarks using the old singular spelling working.
    if (path === "/technique_list") return "technique-list";
    return (Object.entries(paths).find(([, route]) => route === path)?.[0] as Page | undefined) ?? "techniques";
  };
  return { pageToRoute, routeToPage };
}
