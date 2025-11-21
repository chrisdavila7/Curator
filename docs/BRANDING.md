# Branding header assets

This project’s page header (top of every page) is branded with Black Lab Solutions.

What was changed
- Replaced the textual “CURATOR” title with an SVG title asset.
- Replaced the previous Black Lab Solutions icon with the doghouse icon SVG.
- Kept an accessible sr-only label so screen readers and tests see “Black Lab Solutions”.

Where the assets live
- public/branding/blacklabsolutions-doghaustitle.svg
- public/branding/blacklabsolutions-doghouseicon.svg

Header component
- src/components/page-header.tsx
  - Default accessible title: “Black Lab Solutions”
  - Renders the title SVG on the left and the icon SVG on the right
  - Layout and sizing classes preserved

How to update branding
- Replace the SVG files in public/branding with new assets keeping the same filenames, or
- Update src/components/page-header.tsx to point to different files if you prefer new names
- If you want a different accessible label, pass a `title` prop to PageHeader or change its default

Notes
- App metadata (src/app/layout.tsx) still uses “CURATOR” for title/description; not changed as part of header branding. Update if desired.

Status badge/chip colors
- Single source of truth: src/lib/status-colors.ts
- Consumers:
  - src/components/status-badge.tsx (renders the pill with inline bg/text from STATUS_COLORS)
  - src/components/ui/button-group.tsx (selected option uses STATUS_COLORS)
  - src/components/checkinout/checkinout-tabs.tsx (now references STATUS_COLORS instead of hard-coded values)

Palette
- Ready to Deploy:
  - Background: #2F2F39
  - Text: #000000
- Deployed:
  - Background: #FA6E4B
  - Text: #FF5329
- Retired: DO NOT CHANGE (currently rgba(239,68,68,0.3) background, #EF4444 text)

Testing
- Tests assert these colors via computed styles:
  - tests/status-badge.spec.tsx
  - tests/inventory-columns-status.spec.tsx

Accessibility note
- The specified combinations may not meet WCAG contrast thresholds in all contexts. If accessibility compliance is a requirement, review contrast ratios and adjust or document an exception/sign-off as needed.
