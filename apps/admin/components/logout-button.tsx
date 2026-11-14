"use client";

import { logoutAction } from "../lib/actions/logout";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="font-mono text-label-caps uppercase text-muted hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
