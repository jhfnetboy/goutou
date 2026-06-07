"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, FloppyDisk, UploadSimple } from "@phosphor-icons/react";

import { PROJECT_SWATCHES } from "@/lib/swatches";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SystemSettingsFormProps = {
  webTitle: string;
  systemName: string;
  accentColor: string;
  logoDarkKey: string | null;
  logoLightKey: string | null;
  faviconKey: string | null;
  sidebarMarkKey: string | null;
  logoDarkUrl: string | null;
  logoLightUrl: string | null;
  faviconUrl: string | null;
  sidebarMarkUrl: string | null;
};

type BrandingKind = "logo-dark" | "logo-light" | "favicon" | "sidebar-mark";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ACCEPT = "image/png,image/jpeg,image/webp";
const DEFAULT_ACCENT = "#10b981";

async function uploadBranding(kind: BrandingKind, file: File) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);
  const res = await fetch("/api/admin/system/branding", {
    method: "POST",
    body: formData,
  });
  const data = (await res.json().catch(() => ({}))) as {
    key?: string;
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.key || !data.url) {
    throw new Error(data.error || "Upload failed");
  }
  return { key: data.key, url: data.url };
}

export function SystemSettingsForm({
  webTitle: initialWebTitle,
  systemName: initialSystemName,
  accentColor: initialAccent,
  logoDarkKey: initialLogoDarkKey,
  logoLightKey: initialLogoLightKey,
  faviconKey: initialFaviconKey,
  sidebarMarkKey: initialSidebarMarkKey,
  logoDarkUrl,
  logoLightUrl,
  faviconUrl,
  sidebarMarkUrl,
}: SystemSettingsFormProps) {
  const router = useRouter();

  const [webTitle, setWebTitle] = useState(initialWebTitle);
  const [systemName, setSystemName] = useState(initialSystemName);
  const [accent, setAccent] = useState(initialAccent);

  const [logoDarkKey, setLogoDarkKey] = useState(initialLogoDarkKey);
  const [logoLightKey, setLogoLightKey] = useState(initialLogoLightKey);
  const [faviconKey, setFaviconKey] = useState(initialFaviconKey);
  const [sidebarMarkKey, setSidebarMarkKey] = useState(initialSidebarMarkKey);

  const [logoDarkPreview, setLogoDarkPreview] = useState(logoDarkUrl);
  const [logoLightPreview, setLogoLightPreview] = useState(logoLightUrl);
  const [faviconPreview, setFaviconPreview] = useState(faviconUrl);
  const [sidebarMarkPreview, setSidebarMarkPreview] = useState(sidebarMarkUrl);

  const [uploading, setUploading] = useState<BrandingKind | null>(null);
  const [saving, setSaving] = useState(false);

  const accentValid = HEX_RE.test(accent);
  const accentSafe = accentValid ? accent : DEFAULT_ACCENT;
  const busy = saving || uploading !== null;

  const SETTERS: Record<
    BrandingKind,
    [(v: string | null) => void, (v: string | null) => void]
  > = {
    "logo-dark": [setLogoDarkKey, setLogoDarkPreview],
    "logo-light": [setLogoLightKey, setLogoLightPreview],
    favicon: [setFaviconKey, setFaviconPreview],
    "sidebar-mark": [setSidebarMarkKey, setSidebarMarkPreview],
  };

  async function handleFile(kind: BrandingKind, file: File) {
    setUploading(kind);
    try {
      const { key, url } = await uploadBranding(kind, file);
      const [setKey, setPreview] = SETTERS[kind];
      setKey(key);
      setPreview(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Upload failed", "danger");
    } finally {
      setUploading(null);
    }
  }

  function clearAsset(kind: BrandingKind) {
    const [setKey, setPreview] = SETTERS[kind];
    setKey(null);
    setPreview(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!accentValid) {
      toast("Accent must be a #rrggbb hex color.", "danger");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webTitle,
          systemName,
          accentColor: accent,
          logoDarkKey: logoDarkKey ?? "",
          logoLightKey: logoLightKey ?? "",
          faviconKey: faviconKey ?? "",
          sidebarMarkKey: sidebarMarkKey ?? "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast("System settings saved", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Save failed", "danger");
    } finally {
      setSaving(false);
    }
  }

  const previewStyle = {
    ["--accent" as string]: accentSafe,
    ["--accent-strong" as string]: accentSafe,
    ["--accent-soft" as string]: `color-mix(in srgb, ${accentSafe} 16%, transparent)`,
    ["--ring" as string]: `color-mix(in srgb, ${accentSafe} 45%, transparent)`,
    ["--brand" as string]: accentSafe,
  } as React.CSSProperties;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identity */}
      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            Identity
          </p>
          <h2 className="mt-2 text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Names
          </h2>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-medium text-foreground">
              Web title
            </span>
            <input
              className="ui-input"
              value={webTitle}
              maxLength={80}
              onChange={(e) => setWebTitle(e.target.value)}
              placeholder="Seeder"
            />
            <span className="text-[12px] leading-5 text-muted">
              Shown in the browser tab and bookmarks.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-medium text-foreground">
              System name
            </span>
            <input
              className="ui-input"
              value={systemName}
              maxLength={60}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="Seeder"
            />
            <span className="text-[12px] leading-5 text-muted">
              The brand name used across the sidebar, sign-in screen, and exports.
            </span>
          </label>
        </div>
      </section>

      {/* Appearance */}
      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            Appearance
          </p>
          <h2 className="mt-2 text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Accent color
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            One color re-tints the whole UI — sidebar, buttons, links, and focus
            rings — in both dark and light mode.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Accent color"
                value={accentValid ? accent : DEFAULT_ACCENT}
                onChange={(e) => setAccent(e.target.value)}
                className="size-10 cursor-pointer rounded-md border border-border bg-background p-1"
              />
              <input
                className={cn("ui-input max-w-40 font-mono", !accentValid && "border-danger")}
                value={accent}
                onChange={(e) => setAccent(e.target.value.trim())}
                placeholder="#10b981"
                aria-invalid={!accentValid}
              />
              {!accentValid ? (
                <span className="text-[12px] text-danger">Use #rrggbb</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PROJECT_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  aria-label={swatch.label}
                  onClick={() => setAccent(swatch.value)}
                  className={cn(
                    "size-6 rounded-md border transition",
                    accent.toLowerCase() === swatch.value.toLowerCase()
                      ? "border-foreground"
                      : "border-border hover:border-border-strong",
                  )}
                  style={{ backgroundColor: swatch.value }}
                />
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div
            style={previewStyle}
            className="grid gap-3 rounded-md border border-border bg-surface p-4"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
              Preview
            </p>
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-5 rounded-full"
                style={{ backgroundColor: accentSafe }}
              />
              <span className="text-[13px] font-medium text-foreground">
                {systemName || "Seeder"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="ui-button-primary px-3" disabled>
                Primary
              </button>
              <span
                className="inline-flex items-center rounded-md border px-2 py-1 text-[12px]"
                style={{
                  borderColor: `color-mix(in srgb, ${accentSafe} 40%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${accentSafe} 14%, transparent)`,
                  color: accentSafe,
                }}
              >
                Accent badge
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            Branding
          </p>
          <h2 className="mt-2 text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Sidebar logo
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            Separate images for dark and light mode. Leave empty to use the
            bundled logo. PNG, JPEG, or WebP up to 5 MB.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <LogoField
            label="Dark mode logo"
            kind="logo-dark"
            previewUrl={logoDarkPreview}
            fallbackSrc="/dark-logo.png"
            backdrop="dark"
            uploading={uploading === "logo-dark"}
            disabled={busy}
            onFile={handleFile}
            onClear={() => clearAsset("logo-dark")}
            cleared={!logoDarkKey}
          />
          <LogoField
            label="Light mode logo"
            kind="logo-light"
            previewUrl={logoLightPreview}
            fallbackSrc="/light-logo.png"
            backdrop="light"
            uploading={uploading === "logo-light"}
            disabled={busy}
            onFile={handleFile}
            onClear={() => clearAsset("logo-light")}
            cleared={!logoLightKey}
          />
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <span className="text-[13px] font-medium text-foreground">
            Collapsed icon
          </span>
          <p className="mb-3 mt-1 text-[12px] leading-5 text-muted">
            A square 1:1 mark shown when the sidebar is collapsed to a rail.
            Leave empty to use the bundled mark.
          </p>
          <SquareField
            kind="sidebar-mark"
            previewUrl={sidebarMarkPreview}
            fallbackSrc="/seeder-mark.svg"
            alt="Collapsed sidebar icon preview"
            uploading={uploading === "sidebar-mark"}
            disabled={busy}
            onFile={handleFile}
            onClear={() => clearAsset("sidebar-mark")}
            cleared={!sidebarMarkKey}
          />
        </div>
      </section>

      {/* Favicon */}
      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            Branding
          </p>
          <h2 className="mt-2 text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Favicon
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            A square icon for the browser tab. PNG or WebP, 32×32 or larger.
          </p>
        </header>

        <SquareField
          kind="favicon"
          previewUrl={faviconPreview}
          fallbackSrc="/favicon.ico"
          alt="Favicon preview"
          uploading={uploading === "favicon"}
          disabled={busy}
          onFile={handleFile}
          onClear={() => clearAsset("favicon")}
          cleared={!faviconKey}
        />
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={busy || !accentValid}
          className="ui-button-primary px-4 disabled:opacity-60"
        >
          {saving ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <FloppyDisk className="size-4" />
          )}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function LogoField({
  label,
  kind,
  previewUrl,
  fallbackSrc,
  backdrop,
  uploading,
  disabled,
  cleared,
  onFile,
  onClear,
}: {
  label: string;
  kind: BrandingKind;
  previewUrl: string | null;
  fallbackSrc: string;
  backdrop: "dark" | "light";
  uploading: boolean;
  disabled: boolean;
  cleared: boolean;
  onFile: (kind: BrandingKind, file: File) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const src = previewUrl ?? fallbackSrc;

  return (
    <div className="grid gap-2">
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <div
        className={cn(
          "flex min-h-20 items-center justify-center rounded-md border border-border p-4",
          backdrop === "dark" ? "bg-[#03150f]" : "bg-white",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${label} preview`} className="h-9 w-auto" />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(kind, file);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="ui-button-secondary px-3 disabled:opacity-60"
        >
          {uploading ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <UploadSimple className="size-4" />
          )}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {!cleared ? (
          <button
            type="button"
            onClick={onClear}
            className="ui-button-ghost px-2 text-[12px]"
          >
            Use default
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SquareField({
  kind,
  previewUrl,
  fallbackSrc,
  alt,
  uploading,
  disabled,
  cleared,
  onFile,
  onClear,
}: {
  kind: BrandingKind;
  previewUrl: string | null;
  fallbackSrc: string;
  alt: string;
  uploading: boolean;
  disabled: boolean;
  cleared: boolean;
  onFile: (kind: BrandingKind, file: File) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const src = previewUrl ?? fallbackSrc;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-md border border-border bg-surface p-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="size-full object-contain" />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(kind, file);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="ui-button-secondary px-3 disabled:opacity-60"
        >
          {uploading ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <UploadSimple className="size-4" />
          )}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {!cleared ? (
          <button
            type="button"
            onClick={onClear}
            className="ui-button-ghost px-2 text-[12px]"
          >
            Use default
          </button>
        ) : null}
      </div>
    </div>
  );
}
