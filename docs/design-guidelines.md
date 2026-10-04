# Design Guidelines – PrepPilot (PM / AI PM Practice)

This document defines the basic UI / UX style and layout of the frontend, so every screen produced or modified by AI stays consistent.

Goal: the interface is about "focusing on practice and reading feedback". The visual language is clean, flat, hand-drawn line art, closer to the friendly but restrained tone of a Notion-like indie SaaS product than to the cold feel of a traditional enterprise tool.

> **Version history:**
> - 2026-07-04: first version, a scrapbook aesthetic (burgundy / chartreuse, wax seal, paper texture, stickers).
> - 2026-07-04 (several tweaks the same day): fonts, background gradient, and sticker cut-outs were adjusted along the way.
> - 2026-07-04 (**latest, full redesign**): the whole scrapbook direction (burgundy / chartreuse palette, gradient background, wax seal, stickers) **was retired**. It was replaced with the flat black / cream / green hand-drawn line style described here. The old paper texture, card rotation, wax seal, and stickers were all removed; do not reapply any of them from the old description.

---

## 1. Overall look and feel

- Keywords: clean, hand-drawn line feel, flat, restrained playfulness. **Not** a scrapbook look.
- Color (a fixed three-color system):
  - **Cream** (off-white background): around `#F0EEE9`, the base color of the whole page. Solid: **no gradient and no grain texture**.
  - **Ink** (black / dark ink): around `#1A1A1A`, for text, card borders, and doodle lines.
  - **Green** (the accent, the only emphasis color): around `#8FD9A8` (`#4F9B63` for hover / darker states), for buttons, tags, and the active page tab (dropdowns are no longer filled green; see §6.3).
  - Cards: white (`#FFFFFF`) with a thin black border (about 1.5px). **No shadow to fake a paper lift, and no rotation.**
- Fonts:
  - Headings (`h1/h2/h3`, the logo wordmark): `"Fraunces"` (a serif with some personality, echoing the warmth of hand-drawn illustration)
  - Body text, buttons, labels, form controls: `"Inter"` (a clean sans-serif for readability)
  - Both load through Google Fonts (free, so the $0 principle is unaffected)
- Language: the whole site is English only, a single language, with no mixed languages (placeholders, button text, and loading states included). No part of the UI, for any audience, shows Chinese.
- The UI shows no debug / internal-state text (for example the Neon connection state); that kind of information stays in the console or the development environment and is never shown to users.

---

## 2. Layout and information architecture

### 2.1 The main practice page (single-question practice)

- Page top: logo (see §6.4) plus the title
- Content area split into two columns (desktop):
  - Left (about 40% wide): question type tag, question title, question description, in a white card with a black border. **The card stays level and does not rotate.**
  - Right (about 60% wide): the answer input plus the submit button; the AI feedback appears below after submitting
- Mobile: a single vertical column (question → answer → feedback)

### 2.2 AI feedback presentation

The structure is overview → one card per subdimension → a collapsible example-answer block, with the black / cream / green palette and the Fraunces / Inter fonts from §1. Cards are again white with a black border and do not rotate.

---

## 3. Hand-drawn decorative elements (doodles)

The hand-drawn feel is kept for decoration, but in single-color (black) line work instead of a colorful scrapbook, echoing the simple sketch style of the reference images:

- **Hand-drawn SVGs (stars, underlines, spirals, and so on)**: lines use `var(--ink)` (black), never color; lines may be deliberately imperfect, with a slightly shaky hand.
- **Shimmy animation**: decorative doodles keep their shimmy animation (see §4).
- Retired decorations that **must not be added back**:
  - Paper texture / grain filter (the page background is a solid cream)
  - Card rotation angles and soft shadows
  - Wax seal
  - Scattered stickers

---

## 4. Animation

- **Shimmying doodles**: decorative doodle SVGs use a CSS `@keyframes` rotation back and forth by a small angle (for example ±3–5 degrees), looping forever, slowly (one cycle every 3–5 seconds) so it never dazzles the eye.
- **Appear / disappear on scroll**: cards and sections use `IntersectionObserver` to detect entering the viewport and fade in with a slight `translateY` (no rotation is layered on anymore, since the cards no longer rotate).
- **Feedback on interactive elements**: a button on hover moves up and to the left and its shadow turns solid (for example `transform: translate(-1px, -1px)` with `box-shadow` going from 0 to `3px 3px 0`), instead of rotating. This flat shift plus hard shadow suits the flat line-art tone.

Animation restraint:

- Animation is only for decorative elements and interaction feedback. **Never** on the textarea where the user is typing an answer, so typing is not distracting.
- **Static rotation (`rotate`) must not be applied to any interactive element (textarea, button, select, and so on) or to its direct container.** A rotated container makes the visual position of the element disagree with the clickable hit region the browser computes (`getBoundingClientRect()` returns the axis-aligned bounding box after rotation, not the shape the eye sees). In practice this made automated tests miss the button, and it also affects a real person clicking precisely with a mouse. It is one of the reasons card rotation was removed entirely.
- Respect `prefers-reduced-motion`: when the user has turned reduced motion on, disable or greatly weaken the animations above.

---

## 5. The Resume Coach page

The layout is unchanged in spirit (inputs on top, AI result cards below), with the palette and animation rules from §1, §3, and §4.

The resume and target job description are saved permanently and used together with the user's stories for every generation. The resume input offers two ways, either one:

- **Upload a file** (`.txt` or `.pdf`): parsed purely in the frontend (`frontend/src/resumeParsing.ts`); the file is never sent to any server. The extracted text is filled into the textarea below, which the user can keep editing before saving.
- **Paste text directly**: the textarea as before.

Stories are added and managed in a single "Add a new story" block (company, title, content); after a story is saved the AI result is generated automatically. A picker for individual Leadership Principles was removed on 2026-07-18; the model chooses the best-fitting principles itself.

---

## 6. Component style

### 6.1 Buttons

- Primary button: green background, black text and border; on hover it shifts with a hard shadow (see §4); lower opacity when disabled.
- Secondary button: white background, black border and text.
- Text-link buttons (for example "Use a different email" or "Sign in as a viewer instead?" on the sign-in card): muted underlined text with real vertical spacing above, never a stacked second button. If such a link is a child of a container that also styles its buttons as primary buttons, it must be explicitly excluded from that generic button hover rule (and given a base rule of equal or higher specificity), or it flashes a solid green block on hover.

### 6.2 Cards

- White background, thin black border (about 1.5px), square or lightly rounded corners, **no rotation and no soft shadow**.
- Generous padding, with clear whitespace between paragraphs.

### 6.3 Dropdown

- **Always use a custom component (a styled listbox), never the native `<select>`.** The option list of a native `<select>` is drawn by the operating system and CSS cannot style it; a custom component keeps the options white with a black border and the selected item in bold.
- Dropdowns are quiet filters: a muted label next to a white outlined trigger, with no green fill, so they never read as a second row of tabs. Page navigation is a real tab strip (a baseline rule with the active tab in green, joined to the line).
- The custom dropdown itself (the container wrapping the trigger button) must not rotate, for the same reason as §4: it wraps an interactive element.

### 6.4 Brand identity / logo

- This is a personal practice tool. **It does not use any real company's name, trademark, or registered graphic as its own brand identity.** Even though the practice content itself simulates a specific company's interview style (see `docs/rubrics-*.json` and `worker/src/prompts.ts`), the name, domain, page title, and logo the product presents must be neutral and unrelated to any real company (the project codename is PrepPilot). This is not only trademark courtesy: once, using a real company name in the domain caused Cloudflare to automatically flag the site as suspected phishing and block it outright (2026-07-06), after which a neutral name was adopted.
- The header currently has no logo icon, just the plain text title "PM Interview Practice", with no wax seal or other decorative container.

---

## 7. Usability and accessibility

- Content is mostly text, so it must be roughly readable even without styles (no CSS).
- Controls (buttons, inputs) should have clear labels and states (loading / disabled).
- Keep keyboard operability (no mouse-only UI).
- Decorative animation and doodles must never hurt text contrast or readability; body-text contrast must meet basic readability standards.
- Honor `prefers-reduced-motion` (see §4).

---

## 8. Anti-patterns

- Do not bring back the old paper texture, page gradient background, card rotation, soft shadows, wax seal, or scattered stickers.
- Do not let decorative elements cover or interfere with body text, question text, or user input.
- Do not add animation or tilt to the user input area (the textarea) itself, which would hurt the typing experience.
- Do not introduce heavy animation libraries; native CSS `@keyframes` / `transition` and a little native `IntersectionObserver` are enough, keeping the project at $0 cost and performant.
- Do not use any real company's name or registered trademark graphic in the product's own brand identity (name, domain, logo, page title); see §6.4.

---

## 9. How AI should be used during development

- When modifying or adding UI, an AI should:
  - Read this file and `master-plan.md` first
  - Before replying, explain the intended UI change and its reasons in 3–5 sentences
  - Produce React components with a clear structure (avoid deep nesting) and short comments where things are not obvious
- For a large UI refactor proposal: first give a wireframe-level text description, then implement the code.

- Focus states are green (a green-dark border and soft halo on text fields, a green-dark outline on other controls); never leave the browser's default blue ring.
