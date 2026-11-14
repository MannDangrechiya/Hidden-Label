"use client";

import { useActionState } from "react";
import { Button, Input } from "@thl/ui";
import type { CmsPage } from "../../../../lib/api/cms";
import { updateCmsPageAction, type CmsFormState } from "../actions";

const EMPTY_STATE: CmsFormState = {};

export function EditContentForm({ page }: { page: CmsPage }) {
  const [state, formAction, pending] = useActionState(updateCmsPageAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4 border border-line bg-surface p-6">
      <input type="hidden" name="id" value={page.id} />
      <Input label="Title" name="title" defaultValue={page.title} required />
      <label className="flex flex-col gap-2">
        <span className="font-mono text-label-caps uppercase text-on-surface-variant">Body (Markdown)</span>
        <textarea
          name="body_md"
          rows={10}
          defaultValue={page.body_md ?? ""}
          className="border border-line bg-surface px-3 py-3 font-sans text-body-md outline-none focus:border-ink"
        />
      </label>
      <Input label="SEO title" name="seo_title" defaultValue={page.seo_title ?? ""} />
      <Input label="SEO description" name="seo_description" defaultValue={page.seo_description ?? ""} />
      <label className="flex items-center gap-2 font-sans text-body-sm text-on-surface-variant">
        <input type="checkbox" name="is_published" defaultChecked={page.is_published} />
        Published
      </label>
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
