"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCmsPage, updateCmsPage, type CmsKind } from "../../../lib/api/cms";
import { BackendError } from "../../../lib/backend";

export interface CmsFormState {
  error?: string;
}

export async function createCmsPageAction(
  _prev: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const kind = String(formData.get("kind") ?? "page") as CmsKind;
  const title = String(formData.get("title") ?? "").trim();
  const body_md = String(formData.get("body_md") ?? "").trim();
  const is_published = formData.get("is_published") === "on";

  if (!slug || !title) return { error: "A slug and title are required." };

  let id: string;
  try {
    const page = await createCmsPage({ slug, kind, title, body_md: body_md || null, is_published });
    id = page.id;
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not create the page." };
  }
  revalidatePath("/content");
  redirect(`/content/${id}`);
}

export async function updateCmsPageAction(
  _prev: CmsFormState,
  formData: FormData,
): Promise<CmsFormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body_md = String(formData.get("body_md") ?? "").trim();
  const is_published = formData.get("is_published") === "on";
  const seo_title = String(formData.get("seo_title") ?? "").trim();
  const seo_description = String(formData.get("seo_description") ?? "").trim();

  if (!title) return { error: "A title is required." };

  try {
    await updateCmsPage(id, {
      title,
      body_md: body_md || null,
      is_published,
      seo_title: seo_title || null,
      seo_description: seo_description || null,
    });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not save the page." };
  }
  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  return {};
}
