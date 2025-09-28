import { supabase } from "./supabaseClient";

const SUBMISSION_BUCKET = "submission-assets";

export interface UploadedAsset {
  path: string;
  publicUrl: string;
}

function makeObjectPath(userId: string, assignmentId: string, fileName: string) {
  const clean = fileName.replace(/[^A-Za-z0-9._-]+/g, "-");
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const safeFileName = clean.length ? clean : "file";
  return `${userId}/${assignmentId}/${unique}-${safeFileName}`;
}

export async function uploadSubmissionAssets(userId: string, assignmentId: string, files: File[]): Promise<UploadedAsset[]> {
  if (!files.length) {
    return [];
  }

  const bucket = supabase.storage.from(SUBMISSION_BUCKET);
  const uploaded: UploadedAsset[] = [];

  for (const file of files) {
    const path = makeObjectPath(userId, assignmentId, file.name || "attachment");
    const { error: uploadError } = await bucket.upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload submission asset");
    }
    const { data } = bucket.getPublicUrl(path);
    uploaded.push({ path, publicUrl: data.publicUrl });
  }

  return uploaded;
}

export function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(SUBMISSION_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
