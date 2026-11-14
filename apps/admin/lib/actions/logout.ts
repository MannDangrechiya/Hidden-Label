"use server";

import { redirect } from "next/navigation";
import { clearSessionToken } from "../session";

export async function logoutAction(): Promise<void> {
  await clearSessionToken();
  redirect("/login");
}
