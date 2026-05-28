export const API_URL = import.meta.env.VITE_API_URL || "/api";

export function getTenantId() {
  return localStorage.getItem("berisa_tenant_id");
}

export function setTenantId(tenantId) {
  if (tenantId) localStorage.setItem("berisa_tenant_id", tenantId);
  else localStorage.removeItem("berisa_tenant_id");
}

export async function api(path, options = {}) {
  const tenantId = getTenantId();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(tenantId ? { "X-Berisa-Tenant-ID": tenantId } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof payload === "string" ? payload : payload.error || "Error de solicitud";
    throw new Error(message);
  }
  return payload;
}
