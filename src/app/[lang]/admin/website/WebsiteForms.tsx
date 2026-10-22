"use client";

import { useState, type ReactNode } from "react";
import { Notice } from "@/components/admin/ui";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import {
  saveAnalyticsAction,
  saveContactAction,
  saveFeaturedAction,
  saveHomeAction,
  saveLegalAction,
  saveLogoAction,
  saveSeoAction,
  type WebsiteState,
} from "./actions";

const idle: WebsiteState = { status: "idle" };
export type ImageOption = { id: string; name: string; url: string };

function Footer({ state, pending, label }: { state: WebsiteState; pending: boolean; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : label}</Button>
      {state.message && <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>}
    </div>
  );
}

/**
 * One text box. The Urdu interface was removed (2026-10-21): its saved text is
 * kept in a hidden field so saving never erases it, but it isn't shown.
 * `placeholder` shows the current built-in text.
 */
function Pair(props: {
  state: WebsiteState;
  name: string;
  label: string;
  en?: string;
  ur?: string;
  placeholder?: string;
  rows?: number;
  max: number;
}) {
  const err = props.state.errors?.[props.name];
  const common = {
    id: props.name,
    name: props.name,
    defaultValue: props.en ?? "",
    placeholder: props.placeholder,
    maxLength: props.max,
    dir: "auto",
    className: inputClass,
    "aria-invalid": err ? true : undefined,
    "aria-describedby": describedBy(props.name, err),
  } as const;
  return (
    <>
      <Field label={props.label} name={props.name} error={err}>
        {props.rows ? <textarea rows={props.rows} {...common} /> : <input {...common} />}
      </Field>
      <input type="hidden" name={`${props.name}Ur`} value={props.ur ?? ""} />
    </>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="glass space-y-4 rounded-2xl p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="font-semibold text-charcoal-900">{title}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}

// --- Featured course (homepage hero) -------------------------------------------------

type Featured = Partial<Record<"eyebrow" | "title" | "text" | "points" | "price" | "button" | "disclaimer" | "href" | "logoId", string>> &
  Partial<Record<"eyebrowUr" | "titleUr" | "textUr" | "pointsUr" | "priceUr" | "buttonUr" | "disclaimerUr", string>> & { enabled: boolean };
type FeaturedDefaults = { eyebrow: string; title: string; text: string; price: string; button: string; disclaimer: string };

export function FeaturedForm({ value, defaults, images }: { value: Featured; defaults: FeaturedDefaults; images: ImageOption[] }) {
  const [state, onSubmit, pending] = useFormAction(saveFeaturedAction, idle);
  const e = (k: string) => state.errors?.[k];
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Group title="Featured course (top of the homepage)" hint="Shows the eBay course as the first thing visitors see. Switch it off to show the standard introduction below instead.">
        <label className="flex items-center gap-3 text-sm font-medium text-charcoal-900">
          <input type="checkbox" name="enabled" defaultChecked={value.enabled} className="h-4 w-4 accent-charcoal-900" />
          Show the featured course at the top of the homepage
        </label>
        <ImagePicker name="logoId" label="Logo (upload it in Media first as a public image; empty = the name in text)" images={images} value={value.logoId ?? ""} error={e("logoId")} />
        <Pair state={state} name="eyebrow" label="Small label" en={value.eyebrow} ur={value.eyebrowUr} placeholder={defaults.eyebrow} max={80} />
        <Pair state={state} name="title" label="Headline" en={value.title} ur={value.titleUr} placeholder={defaults.title} max={200} />
        <Pair state={state} name="text" label="Introduction" en={value.text} ur={value.textUr} placeholder={defaults.text} rows={3} max={600} />
        <Pair state={state} name="points" label="What you'll learn (one point per line, up to 8)" en={value.points} ur={value.pointsUr} placeholder="e.g. Setting up your eBay seller account" rows={5} max={1200} />
        <Pair state={state} name="price" label="Price / how to join" en={value.price} ur={value.priceUr} placeholder={defaults.price} max={160} />
        <Pair state={state} name="button" label="Button text" en={value.button} ur={value.buttonUr} placeholder={defaults.button} max={80} />
        <Field label="Button link" name="href" error={e("href")} hint="A page on this website. Default: the programs page (/courses). To open one program directly, use /courses/its-web-address. The logo card and the price line link to the same page.">
          <input id="href" name="href" dir="ltr" defaultValue={value.href ?? ""} placeholder="/courses" className={inputClass} aria-invalid={e("href") ? true : undefined} aria-describedby={describedBy("href", e("href"))} />
        </Field>
        <Pair state={state} name="disclaimer" label="Trademark note" en={value.disclaimer} ur={value.disclaimerUr} placeholder={defaults.disclaimer} rows={2} max={300} />
      </Group>
      <Footer state={state} pending={pending} label="Save featured course" />
    </form>
  );
}

// --- Homepage ---------------------------------------------------------------------

type Home = {
  heroTitle?: string; heroTitleUr?: string; heroText?: string; heroTextUr?: string;
  whyTitle?: string; whyTitleUr?: string; why: { title?: string; titleUr?: string; text?: string; textUr?: string }[];
  ctaTitle?: string; ctaTitleUr?: string; ctaText?: string; ctaTextUr?: string;
};
type HomeDefaults = { heroTitle: string; heroText: string; whyTitle: string; why: { title: string; text: string }[]; ctaTitle: string; ctaText: string };

export function HomeForm({ value, defaults }: { value: Home; defaults: HomeDefaults }) {
  const [state, onSubmit, pending] = useFormAction(saveHomeAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-muted">Leave a box empty to keep the text shown in grey.</p>
      <Group title="Top of the page (standard introduction)" hint="Shown when the featured course above is switched off.">
        <Pair state={state} name="heroTitle" label="Headline" en={value.heroTitle} ur={value.heroTitleUr} placeholder={defaults.heroTitle} max={200} />
        <Pair state={state} name="heroText" label="Introduction" en={value.heroText} ur={value.heroTextUr} placeholder={defaults.heroText} rows={3} max={600} />
      </Group>
      <Group title="Why Digitals Minds" hint="Four short points.">
        <Pair state={state} name="whyTitle" label="Section title" en={value.whyTitle} ur={value.whyTitleUr} placeholder={defaults.whyTitle} max={200} />
        {defaults.why.map((d, i) => (
          <div key={i} className="space-y-3 border-t border-charcoal-200/50 pt-4">
            <p className="text-sm font-medium text-charcoal-800">Point {i + 1}</p>
            <Pair state={state} name={`why.${i}.title`} label="Title" en={value.why[i]?.title} ur={value.why[i]?.titleUr} placeholder={d.title} max={120} />
            <Pair state={state} name={`why.${i}.text`} label="Text" en={value.why[i]?.text} ur={value.why[i]?.textUr} placeholder={d.text} rows={2} max={400} />
          </div>
        ))}
      </Group>
      <Group title="Call to action banner" hint="The yellow panel near the bottom of most pages.">
        <Pair state={state} name="ctaTitle" label="Title" en={value.ctaTitle} ur={value.ctaTitleUr} placeholder={defaults.ctaTitle} max={200} />
        <Pair state={state} name="ctaText" label="Text" en={value.ctaText} ur={value.ctaTextUr} placeholder={defaults.ctaText} rows={2} max={400} />
      </Group>
      <Footer state={state} pending={pending} label="Save homepage" />
    </form>
  );
}

// --- Contact ------------------------------------------------------------------------

export function ContactForm({ value }: { value: { email: string; address: string[]; addressUr: string[]; whatsapp?: string } }) {
  const [state, onSubmit, pending] = useFormAction(saveContactAction, idle);
  const e = (k: string) => state.errors?.[k];
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email shown on the website" name="email" error={e("email")}>
        <input id="email" name="email" type="email" dir="ltr" defaultValue={value.email} className={inputClass} aria-invalid={e("email") ? true : undefined} aria-describedby={describedBy("email", e("email"))} />
      </Field>
      <div>
        <Field label="Office address" name="address" hint="One line per row.">
          <textarea id="address" name="address" rows={4} defaultValue={value.address.join("\n")} className={inputClass} />
        </Field>
        <input type="hidden" name="addressUr" value={value.addressUr.join("\n")} />
      </div>
      <Field label="WhatsApp support number (optional)" name="whatsapp" error={e("whatsapp")} hint="With country code, e.g. +92 300 1234567. When set, a WhatsApp button appears on every public page and in the contact details. Leave empty to show no number.">
        <input id="whatsapp" name="whatsapp" type="tel" dir="ltr" defaultValue={value.whatsapp ?? ""} maxLength={24} className={inputClass} aria-invalid={e("whatsapp") ? true : undefined} aria-describedby={describedBy("whatsapp", e("whatsapp"), "hint")} />
      </Field>
      <Footer state={state} pending={pending} label="Save contact details" />
    </form>
  );
}

// --- SEO ------------------------------------------------------------------------------

type SeoRow = { key: string; label: string; title?: string; titleUr?: string; description?: string; descriptionUr?: string; imageId?: string; defaultTitle: string; defaultDescription: string };

export function SeoForm({ pages, images }: { pages: SeoRow[]; images: ImageOption[] }) {
  const [state, onSubmit, pending] = useFormAction(saveSeoAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        What Google and social media show for each page. Titles: up to about 60 characters. Descriptions: about 150. Empty boxes keep the
        built-in text (in grey).
      </p>
      {pages.map((p) => (
        <details key={p.key} className="glass rounded-2xl p-5" open={Object.keys(state.errors ?? {}).some((k) => k.startsWith(`${p.key}.`)) || undefined}>
          <summary className="cursor-pointer font-semibold text-charcoal-900">{p.label}</summary>
          <div className="mt-4 space-y-4">
            <Pair state={state} name={`${p.key}.title`} label="Search title" en={p.title} ur={p.titleUr} placeholder={p.defaultTitle} max={70} />
            <Pair state={state} name={`${p.key}.description`} label="Search description" en={p.description} ur={p.descriptionUr} placeholder={p.defaultDescription} rows={2} max={170} />
            <ImagePicker name={`${p.key}.imageId`} label="Share image (optional, 1200×630 works best)" images={images} value={p.imageId ?? ""} error={state.errors?.[`${p.key}.imageId`]} />
          </div>
        </details>
      ))}
      <Footer state={state} pending={pending} label="Save search settings" />
    </form>
  );
}

export function ImagePicker({ name, label, images, value, error }: { name: string; label: string; images: ImageOption[]; value: string; error?: string }) {
  const [current, setCurrent] = useState(value);
  const url = images.find((i) => i.id === current)?.url;
  return (
    <div>
      <Field label={label} name={name} error={error}>
        <select id={name} name={name} value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} aria-invalid={error ? true : undefined}>
          <option value="">{images.length ? "None" : "No public images yet: upload in Media"}</option>
          {images.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </Field>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 h-24 w-auto max-w-full rounded-lg object-contain ring-1 ring-white" />
      )}
    </div>
  );
}

// --- Logo -------------------------------------------------------------------------------

export function LogoForm({ value, images, official }: { value: { lightId: string; darkId: string }; images: ImageOption[]; official: { light: string; dark: string } }) {
  const [state, onSubmit, pending] = useFormAction(saveLogoAction, idle);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="glass space-y-3 rounded-2xl p-5">
          <p className="font-semibold text-charcoal-900">Logo for light backgrounds</p>
          <p className="text-sm text-muted">Header, footer, admin, certificates, preloader. A transparent PNG works best.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={official.light} alt="Official logo" className="h-12 w-auto" />
          <ImagePicker name="lightId" label="Replacement (empty = official logo)" images={images} value={value.lightId} error={state.errors?.lightId} />
        </div>
        <div className="space-y-3 rounded-2xl bg-charcoal-900 p-5 text-white">
          <p className="font-semibold">Logo for dark backgrounds</p>
          <p className="text-sm text-charcoal-200">Used on dark panels.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={official.dark} alt="Official dark logo" className="h-12 w-auto" />
          <div className="rounded-xl bg-white/95 p-3 text-charcoal-900">
            <ImagePicker name="darkId" label="Replacement (empty = official logo)" images={images} value={value.darkId} error={state.errors?.darkId} />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">Upload the new logo in Media first (public image). The browser tab icon and app icon are separate files and stay as they are.</p>
      <Footer state={state} pending={pending} label="Save logo" />
    </form>
  );
}

// --- Analytics & Search Console ----------------------------------------------------------

export function AnalyticsForm({ value }: { value: { gaId: string; googleVerification: string } }) {
  const [state, onSubmit, pending] = useFormAction(saveAnalyticsAction, idle);
  const e = (k: string) => state.errors?.[k];
  return (
    <form onSubmit={onSubmit} className="glass space-y-5 rounded-2xl p-6" noValidate>
      <Field label="Google Analytics 4 Measurement ID" name="gaId" error={e("gaId")} hint="Google Analytics → Admin → Data streams → your website. Looks like G-XXXXXXXXXX. Leave empty to turn analytics off.">
        <input id="gaId" name="gaId" dir="ltr" autoComplete="off" placeholder="G-XXXXXXXXXX" defaultValue={value.gaId} className={inputClass} aria-invalid={e("gaId") ? true : undefined} aria-describedby={describedBy("gaId", e("gaId"))} />
      </Field>
      <p className="text-sm text-muted">
        Analytics runs only for visitors who press &quot;Accept&quot; in the cookie banner (Consent Mode, nothing loads before). It records page views and
        three events without personal details: <code>generate_lead</code> (inquiry sent), <code>sign_up</code> (newsletter) and{" "}
        <code>enrollment_request</code> (course access requested).
      </p>
      <Field label="Google Search Console verification code" name="googleVerification" error={e("googleVerification")} hint='Search Console → Add property → URL prefix → "HTML tag". Paste the whole tag or just the code.'>
        <input id="googleVerification" name="googleVerification" dir="ltr" autoComplete="off" defaultValue={value.googleVerification} className={inputClass} aria-invalid={e("googleVerification") ? true : undefined} aria-describedby={describedBy("googleVerification", e("googleVerification"))} />
      </Field>
      <p className="text-sm text-muted">After verifying, submit the sitemap in Search Console: <code dir="ltr">/sitemap.xml</code></p>
      <Footer state={state} pending={pending} label="Save" />
    </form>
  );
}

// --- Legal pages --------------------------------------------------------------------------

export function LegalForm({ page, value, url }: { page: "privacy" | "terms" | "refund"; value: { title: string; titleUr?: string; body: string; bodyUr?: string; published: boolean }; url: string }) {
  const [state, onSubmit, pending] = useFormAction(saveLegalAction.bind(null, page), idle);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Pair state={state} name="title" label="Title" en={value.title} ur={value.titleUr} max={200} />
      <Pair state={state} name="body" label="Text" en={value.body} ur={value.bodyUr} rows={14} max={100000} />
      <p className="text-xs text-muted">Blank line = new paragraph · “## ” = heading · “- ” = bullet · links are clickable.</p>
      <label className="flex items-center gap-3 text-sm text-charcoal-900">
        <input type="checkbox" name="published" defaultChecked={value.published} className="h-5 w-5 accent-charcoal-900" />
        Published (shown at <span dir="ltr" className="font-mono text-xs">{url}</span> and linked in the footer)
      </label>
      <Footer state={state} pending={pending} label="Save page" />
    </form>
  );
}
