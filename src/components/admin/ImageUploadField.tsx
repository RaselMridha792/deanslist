"use client";

import { useRef, useState } from "react";
import { mediaImage } from "@/lib/media";

const MAX_MB = 15;

/**
 * An image field with an Upload button beside it.
 *
 * The text input stays the source of truth and stays editable: an upload only
 * fills it in, and the form's normal Save stores it. So an existing /media path
 * still works, a pasted https:// link still works, and an upload that is never
 * saved changes nothing.
 *
 * `output` is what the rest of the site expects in this particular field:
 *
 *   "path"  extensionless, e.g. /uploads/images/ab12… — for fields drawn with
 *           <picture>, which appends .avif, .webp and .jpg itself. Posters,
 *           portraits, key art.
 *   "webp"  one real file, e.g. /uploads/images/ab12….webp — for fields drawn
 *           with a plain <img>. Sponsor logos. WebP keeps a logo's transparent
 *           background, which the JPEG fallback cannot.
 */
export function ImageUploadField({
  label,
  name,
  defaultValue,
  placeholder,
  help,
  output = "path",
  span = true,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  help?: string;
  output?: "path" | "webp";
  span?: boolean;
}) {
  const id = `f-${name}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  async function upload(file: File) {
    setError(null);
    setNote(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    // Saving mid-upload would store the OLD value and look like success. A
    // custom validity message makes the browser refuse the submit and say why.
    inputRef.current?.setCustomValidity("Wait for the image to finish uploading.");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        path?: string;
        width?: number;
        height?: number;
        error?: string;
      };
      if (!res.ok || !data.path) {
        throw new Error(data.error ?? `Upload failed (${res.status}). Try again.`);
      }
      setValue(output === "webp" ? `${data.path}.webp` : data.path);
      setPreviewFailed(false);
      setNote(`Uploaded, ${data.width}×${data.height}. Save the form to use it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      inputRef.current?.setCustomValidity("");
      setBusy(false);
      // Clear the picker so choosing the same file again still fires onChange.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const preview = previewSrc(value, output);

  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="label" htmlFor={id}>
        {label}
      </label>

      <div className="flex flex-wrap items-stretch gap-3">
        <input
          ref={inputRef}
          id={id}
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setPreviewFailed(false);
            setNote(null);
          }}
          placeholder={placeholder}
          className="field min-w-0 flex-1 basis-64"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn btn-ghost shrink-0 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      <div aria-live="polite">
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {note && !error && <p className="help text-brand-onDark">{note}</p>}
      </div>

      {preview && (
        <div className="mt-3 flex items-start gap-4">
          {previewFailed ? (
            <p className="help !mt-0">
              Nothing loads from that path yet. Check it, or upload the image instead.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              onError={() => setPreviewFailed(true)}
              className="max-h-40 max-w-[16rem] border border-admin-line bg-admin-raised object-contain"
            />
          )}
        </div>
      )}

      {help && <p className="help">{help}</p>}
      <p className="help">
        Upload a JPEG, PNG, WebP or AVIF up to {MAX_MB} MB. It is stored on the site&apos;s
        own server, resized, and stripped of camera location data.
      </p>
    </div>
  );
}

/** What to show as a thumbnail for the value in the box, if anything. */
function previewSrc(value: string, output: "path" | "webp"): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (!v.startsWith("/")) return null;
  // Already a file (a logo path, or a legacy value with an extension).
  if (output === "webp" || /\.[a-z0-9]{3,4}$/i.test(v)) return mediaImage(v);
  // Extensionless: every image the site stores that way has a .webp beside it.
  return `${mediaImage(v)}.webp`;
}
