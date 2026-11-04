const idPattern = /^[1-9]\d*$/;
export function projectContextId(params: URLSearchParams): string | null {
  const id = params.get("project_id");
  return id && idPattern.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
}

// Return links only accept this application route. No URL resolution, redirects,
// protocol-relative destinations, nested return links or arbitrary paths.
export function dashboardReturn(value: string | null): string | null {
  if (!value || value.length > 2048 || ([...value].some((c) => c.charCodeAt(0) <= 32) || value.includes("\\") || value.includes("#"))) return null;
  const [path, query = ""] = value.split("?");
  if (path !== "/app/dashboard") return null;
  const allowed = new Set(["year", "month", "status", "state", "company_id", "search", "date_from", "date_to", "contract_from", "contract_to", "contract_status", "segment", "contract_state", "recurring", "service", "assets_min", "assets_max"]);
  const params = new URLSearchParams(query);
  if ([...params.keys()].some((key) => !allowed.has(key))) return null;
  return path + (params.size ? "?" + params : "");
}

export function navigationContext(params: URLSearchParams) {
  const result = new URLSearchParams();
  const project = projectContextId(params), back = dashboardReturn(params.get("return_to"));
  if (project) result.set("project_id", project);
  if (back) result.set("return_to", back);
  return result;
}

export function navigationHref(path: string, search: URLSearchParams | string) {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const [withoutHash, fragment] = path.split("#");
  const [pathname, ownQuery = ""] = withoutHash.split("?");
  const next = navigationContext(params);
  const keys = pathname.startsWith("/app/budgets")
    ? ["search", "status", "company_id", "page", "organization_id"]
    : pathname.startsWith("/app/finance/dre")
      ? ["organization_id", "month", "start_month", "end_month", "from", "to", "company_id", "account_id", "currency", "status", "page"]
      : pathname.startsWith("/app/finance")
        ? ["company_id", "contract_id", "date_from", "date_to", "status", "view", "direction", "page", "page_size", "organization_id"]
        : [];
  if (pathname.startsWith("/app/projects")) next.delete("project_id");
  for (const key of keys) if (params.has(key)) next.set(key, params.get(key)!);
  for (const [key, value] of new URLSearchParams(ownQuery)) next.set(key, value);
  return pathname + (next.size ? "?" + next : "") + (fragment ? "#" + fragment : "");
}

export function requestFilters(params: URLSearchParams) {
  return Object.fromEntries([...params].filter(([key]) => !["return_to", "tab", "version"].includes(key)));
}
