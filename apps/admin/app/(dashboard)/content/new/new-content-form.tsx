"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@thl/ui";
import { createCmsPageAction, type CmsFormState } from "../actions";

const EMPTY_STATE: CmsFormState = {};

export function NewContentForm() {
  const [state, formAction, pending] = useActionState(createCmsPageAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4 border border-line bg-surface p-6">
      <Input label="Slug" name="slug" required placeholder="policies/returns" />
      <Select label="Kind" name="kind" defaultValue="page">
        <option value="page">Page</option>
        <option value="policy">Policy</option>
        <option value="faq">FAQ</option>
        <option value="banner">Banner</option>
        <option value="drop">Drop</option>
      </Select>
      <Input label="Title" name="title" required />
      <label className="flex flex-col gap-2">
        <span className="font-mono text-label-caps uppercase text-on-surface-variant">Body (Markdown)</span>
        <textarea
          name="body_md"
          rows={8}
          className="border border-line bg-surface px-3 py-3 font-sans text-body-md outline-none focus:border-ink"
        />
      </label>
      <label className="flex items-center gap-2 font-sans text-body-sm text-on-surface-variant">
        <input type="checkbox" name="is_published" />
        Publish immediately
      </label>
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      <Button type="submit" loading={pending}>
        Create page
      </Button>
    </form>
  );
}
