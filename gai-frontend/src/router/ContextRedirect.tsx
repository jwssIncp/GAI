import { Navigate, useLocation } from "react-router-dom";

export function ContextRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}
