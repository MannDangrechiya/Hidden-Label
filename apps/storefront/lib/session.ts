import { readAuthToken } from "@/lib/auth-cookie";
import { fetchMe, type StoreCustomer } from "@/lib/medusa";

/**
 * Resolves the signed-in customer for Server Components. Returns `null` for a guest or an
 * expired/invalid token — callers decide whether that means a redirect to `/login` or simply
 * rendering a guest-safe view.
 */
export async function getCurrentCustomer(): Promise<{ customer: StoreCustomer; token: string } | null> {
  const token = await readAuthToken();
  if (!token) return null;
  const customer = await fetchMe(token);
  if (!customer) return null;
  return { customer, token };
}
