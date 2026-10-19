# Official brand assets

Place the **official** Digitals Minds logo files here. Do not substitute a
recreated or AI-generated logo.

Suggested files:

| File | Use |
| --- | --- |
| `logo.svg` (or `.png`) | Header logo on light backgrounds |
| `logo-inverse.svg` | Footer logo on dark backgrounds (optional) |
| `og-image.png` (1200×630) | Social sharing preview (optional) |

Then enable the logo in `src/config/site.ts`:

```ts
logo: { src: "/brand/logo.svg", alt: "Digitals Minds", width: 180, height: 48 },
```

Use the file's real pixel dimensions (or its aspect ratio) for `width`/`height`.
For a favicon, add `src/app/icon.png` (or `icon.svg`); Next.js picks it up automatically.
Brand colours live in `src/app/globals.css` under `@theme`.
