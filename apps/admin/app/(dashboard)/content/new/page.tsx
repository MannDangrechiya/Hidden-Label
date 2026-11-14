import type { Metadata } from "next";
import { NewContentForm } from "./new-content-form";

export const metadata: Metadata = { title: "New page" };

export default function NewContentPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">New page</h1>
      <NewContentForm />
    </div>
  );
}
