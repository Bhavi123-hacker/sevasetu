# Wireframe Spec — 6 Screens

This is a build spec for Figma, not a substitute for it — Figma files can't be generated here. Each screen below maps to one of the assignment's suggested screen types.

## 1. Service selection & document upload (Form/input screen)

**Who:** Citizen. **Maps to user stories:** US-01, US-02, US-03, US-14.

- Dropdown or card-grid to choose the service (e.g. "Income certificate", "Domicile certificate")
- Once selected, a checklist of required documents appears above the upload area (US-02) — each item shows as "needed" until a file is attached
- Drag-and-drop or tap-to-upload area, one slot per required document type
- Inline warning state for a blurry/low-quality upload (US-14) — a yellow banner under the affected slot, not a blocking error
- Primary button: "Check my application" — disabled until all required slots have a file

## 2. Readiness result (Results/report screen — the flagship screen)

**Who:** Citizen. **Maps to user stories:** US-05, US-06, US-07, US-08, US-09, US-10, US-11, US-12.

- Large readiness score at the top (e.g. "82%"), with a short status line ("Almost ready" / "Needs attention")
- Checklist below it, one row per field: `✓ Aadhaar name` / `✓ Date of birth` / `✗ Address mismatch` — pass rows collapsed/muted, fail rows expanded with the plain-language explanation inline
- If a duplicate is suspected (US-11): a distinct banner above the score, not mixed into the field checklist
- "Estimated delay" line (e.g. "3–5 days") directly under the score
- Recommendation box: one specific instruction ("Upload an updated Aadhaar or a matching residence proof")
- "Re-upload this document" button attached to each failed row (US-10), not a single generic retry button
- Language selector in the top corner (US-12)

## 3. Officer login (Login screen)

**Who:** Officer. **Maps to user stories:** US-15.

- Minimal: department/staff ID field, password field, "Log in" button
- No citizen-facing branding here — this is an internal tool, keep it plain

## 4. Officer queue (Dashboard)

**Who:** Officer. **Maps to user stories:** US-16, US-18, US-21, US-22, US-24.

- Table or card list, one row per application: citizen name, service type, readiness score (with a color cue — not color alone, pair it with a ✓/✗-style icon), submitted date
- Sort default: lowest readiness score first (riskiest first)
- Duplicate-suspected applications get a distinct badge and sit in their own section or are visually separated, not just an icon buried in a row (US-18)
- Filter control by service type (US-21) and a search box by name/ID (US-22)
- A small summary strip at the top: "X clean · Y flagged" (US-24) — a count, not a chart or trend line

## 5. Application detail (Detail view)

**Who:** Officer. **Maps to user stories:** US-17, US-19.

- Header: citizen name, service type, readiness score
- Field-by-field mismatch table (same shape as screen 2, officer-facing version): field name, status, the two conflicting values side by side, which two documents they came from
- Missing-documents list, if any (US-19)
- Thumbnail previews of each uploaded document, so the officer can eyeball the original without leaving the screen
- "Mark as reviewed" button at the bottom (US-20, Could-have — include the button in the wireframe even though it's lower priority to build first)

## 6. Required-documents settings (Settings screen)

**Who:** Officer/admin. **Maps to user stories:** US-25 (Won't-have this iteration — wireframe it anyway; it documents the intended shape even though it isn't built yet).

- List of service types, each expandable to show its required-document checklist
- "Add document requirement" control per service type
- This screen can be wireframed simply and left unbuilt — the checklist itself ships hardcoded in the MVP; this screen is what makes it editable later

## 7. Ask a Question (citizen, new)

**Who:** Citizen. **Maps to user stories:** US-26, US-27.

- Single text input, placeholder like "e.g. How long does processing take?"
- Below it, the matched regulation passage displayed as-is, with a confidence label (High / Moderate / Low) rather than a raw number — a citizen doesn't need to know what "0.31 relevance" means, they need to know whether to trust it
- If confidence is low, a visible note suggesting rephrasing or contacting an officer directly — this screen should never look more confident than the underlying match actually is

## 8. Submit Feedback (citizen, new)

**Who:** Citizen. **Maps to user stories:** US-28, US-29.

- Name field (optional), application ID field (optional — only relevant if the feedback is about a specific submission), feedback text area
- No sentiment shown back to the citizen on this screen — sentiment is an officer-facing signal, not something to expose to the person who wrote it

## 9. Officer Dashboard (officer, new)

**Who:** Officer. **Maps to user stories:** US-30, US-31, US-32, US-33.

- Two sections on one screen: Productivity (total / resolved / pending / average readiness as summary numbers, a bar chart of resolutions per officer, a bar chart of applications by service type) and Feedback Insights (positive/neutral/negative counts, a scrollable list of recent feedback with sentiment tags)
- Deliberately combines what the architecture diagram draws as two separate boxes (Officer Productivity Dashboard, Feedback Insights) into one screen — they're both "officer-facing analytics over the same data," and splitting them into separate screens would just mean the same numbers rendered twice

## On screen count

That's 9 screens, not 6. The assignment's "6" reads as illustrative (it's introduced with "e.g."), not a hard cap — but if a strict 6 is required, the safest cut is folding screen 9 (Officer Dashboard) into a simpler single-number summary bolted onto the existing Officer Queue screen. Merging screens 7 and 8 isn't recommended — a citizen asking a question and a citizen filing a complaint are different enough intents to keep visually separate.
