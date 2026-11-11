---
name: Release Manager
description: A dark, quiet front end to a home media setup, where the posters are the only bright thing.
colors:
  primary: "#abc7ff"
  on-primary: "#002f65"
  secondary-container: "#3e4759"
  on-secondary-container: "#dae2f9"
  tertiary: "#bec2ff"
  surface: "#121316"
  surface-container-lowest: "#0d0e11"
  surface-container: "#1f2022"
  surface-container-highest: "#343537"
  surface-variant: "#44474e"
  outline-variant: "#44474e"
  on-surface: "#e3e2e6"
  on-surface-variant: "#c4c6d0"
  error: "#ffb4ab"
  on-error: "#690005"
  drift-positive: "#4caf50"
  drift-positive-deep: "#2e7d32"
  drift-badge-4k: "#a78bfa"
  drift-badge-dv: "#fb923c"
  drift-badge-hdr: "#fbbf24"
  drift-badge-codec: "#9ca3af"
  drift-badge-audio: "#60a5fa"
typography:
  display:
    fontFamily: "Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 300
    letterSpacing: "0.05em"
  title:
    fontFamily: "Roboto, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 500
  body:
    fontFamily: "Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  meta:
    fontFamily: "Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
  label:
    fontFamily: "Roboto, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    letterSpacing: "0.04em"
  badge:
    fontFamily: "Roboto, sans-serif"
    fontSize: "0.6rem"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "0.05em"
  mono:
    fontFamily: "monospace"
    fontSize: "0.75rem"
rounded:
  badge: "3px"
  skeleton: "4px"
  poster: "6px"
  tile: "8px"
  panel: "12px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  page-x-desktop: "2rem"
  page-y-desktop: "1.5rem"
components:
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    height: "48px"
  button-stroked:
    textColor: "{colors.primary}"
    typography: "{typography.body}"
  button-text:
    textColor: "{colors.primary}"
    typography: "{typography.body}"
  title-row:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.panel}"
    padding: "0.5rem"
  poster-thumb:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.poster}"
    width: "56px"
    height: "84px"
  poster-tile:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.tile}"
    width: "150px"
  toolbar:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title}"
  nav-item:
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    height: "48px"
  nav-item-active:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
  media-badge:
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "1px 5px"
---

# Design System: Release Manager

## Overview

**Creative North Star: "The Projection Booth"**

The interface is a dark, quiet control room. The only saturated, bright things in it are the film posters; everything the app itself draws is near-black surface, soft grey text and one pale blue accent. Chrome never competes with artwork. A person opens it on a phone, scans a column of titles, opens one, acts, and leaves.

It is stock Angular Material 3, dark scheme, used as shipped. Controls are unfussy: no custom button shapes, no gradients, no decorative illustration, no brand flourish. The customization that exists is practical tightening for dense lists (compact expansion headers, square nav items, smaller meta text). The system is dark only; there is no light theme.

The implementation reads color from the Material system custom properties (`--mat-sys-*`), generated in `web/src/styles.scss` from `mat.$azure-palette` (primary) and `mat.$blue-palette` (tertiary). Those properties are the source of truth; the hex values in the frontmatter are the dark-scheme values they resolve to, derived from the palette, not hand-picked.

**Key Characteristics:**
- Dark only, near-black surfaces separated by tone, not by shadow.
- Posters carry all the color; the UI stays achromatic plus one pale blue.
- A single column of expandable title rows is the main pattern on every list page.
- Stock Material components, tightened for density, never restyled for personality.
- Phone layout is the design; one breakpoint at 960px adds room, not new structure.

## Colors

A cool near-black field with soft grey text, one pale azure accent and a neighbouring periwinkle for ownership state.

### Primary
- **Booth Light Azure** (`primary`): links (release names, commit hash), the filled button, the user icon, list-title icons, the unread indicator on a watchlist row, badges, and hover on the dashed "refresh" tile. It marks things you can act on or that are new.

### Tertiary
- **Shelf Periwinkle** (`tertiary`): reserved for "this is yours" information: the "In library" Jellyfin mark and the keyword summary on a watchlist row. It never appears on a control.

### Neutral
- **Booth Black** (`surface`): the page.
- **Console Grey** (`surface-container`): every raised thing: title rows, poster tiles, toolbar, skeleton rows.
- **Slate Fill** (`surface-variant`): missing-poster placeholders and skeleton blocks.
- **Hairline Slate** (`outline-variant`): 1px dividers under the toolbar and user block, the dashed refresh tile, the scrollbar thumb.
- **Screen White** (`on-surface`): titles and primary text.
- **Dim Grey** (`on-surface-variant`): the workhorse. Meta lines, sizes, counts, section labels, empty states. It is the most used color in the stylesheets.
- **Selected Slate** (`secondary-container` with `on-secondary-container`): the active navigation item only.

### Error
- **Soft Red** (`error`): error messages, leecher counts, the dislike control.

### Tolerated drift
These are hard-coded outside the theme. They are recorded as they are and are candidates to fold into theme tokens later. Reuse them where they already appear; do not add a sixth badge hue or a second green.
- **Seeder Green** (`drift-positive`): seeder count and the freeleech "FL" mark.
- **Like Green** (`drift-positive-deep`): the like control, at 8% and 18% tint when idle and hovered, solid when selected.
- **Media badge tints** (`drift-badge-4k`, `-dv`, `-hdr`, `-codec`, `-audio`): text color of the quality badges on library rows, each on an 18% tint of its own hue.

### Named Rules
**The Poster Rule.** Posters are the only saturated imagery on a screen. The interface does not introduce color that competes with them.

**The Theme Token Rule.** New color comes from `--mat-sys-*`. A hard-coded hex needs a reason, and the existing hard-coded ones are drift, not precedent.

## Typography

**Font:** Roboto (300, 400, 500 loaded), via the Material theme.
**Mono:** the platform `monospace`, for machine text only.

**Character:** One sans family doing every job by size and weight. Sizes are small and close together because the content is dense lists on a narrow screen.

### Hierarchy
- **Display** (300, 1.75rem, 0.05em tracking): the app name on the login screen. Nowhere else.
- **Title** (500, 1.1rem): toolbar page title, list titles, and row titles from 960px up. On phones a row title is body size at weight 500.
- **Body** (400, 0.875rem / 1.25rem): Material `body-medium`, the default for everything.
- **Meta** (400, 0.8rem to 0.85rem, 0.9rem from 960px): year, rating, genre, file size, counts, release names. Always Dim Grey except release names, which are links.
- **Label** (600, 0.85rem, 0.04em, uppercase): section headings inside an opened row ("Releases on this page").
- **Badge** (700, 0.6rem, 0.05em, uppercase): media quality badges.
- **Mono** (0.75rem): NFO text, log lines, the commit hash.

### Named Rules
**The Long String Rule.** Release names are unbreakable scene strings. Inside an opened row they wrap with `word-break: break-all`; in a collapsed row a title truncates to one line with an ellipsis. Never let either cause horizontal scroll.

## Layout

- **Shell:** a full-height column: toolbar on top, then a side navigation (256px) beside the scrolling content. Below 960px the navigation is an overlay drawer opened from a menu button; from 960px it is permanently open and the menu button disappears.
- **Page container:** one centered column, 960px wide at most with 1rem padding, growing to 1000px with 1.5rem / 2rem padding from 960px. Children stack with a 1rem gap.
- **Lists:** rows stack with 0.5rem between them. There is no multi-column grid of rows at any width.
- **Row anatomy:** poster thumb (56 by 84px, 90 by 135px from 960px), then a text block with 2px between its lines, 0.75rem gap (1.25rem from 960px).
- **Ribbons:** horizontal scroll-snap strips of poster tiles (150px wide, 190px from 960px, poster at 2:3) with 0.75rem gaps, used for recommendations.
- **Breakpoint:** one, at 960px, in both CSS and the shell. Everything is authored for the phone first and widened there.
- **Rhythm:** 0.25, 0.5, 0.75, 1 and 1.25rem cover nearly all gaps and padding.

## Elevation & Depth

Flat. No component stylesheet declares a shadow; the three `box-shadow` declarations in the codebase all set `none`. Depth comes from tone: Console Grey panels on the Booth Black page, with Hairline Slate 1px lines where two same-tone regions meet (toolbar edge, user block). Overlays (dialogs, menus, the drawer) keep whatever elevation Material gives them by default.

### Named Rules
**The Tone-Not-Shadow Rule.** A surface is raised by moving one step up the surface-container scale, never by adding a shadow.

## Shapes

Soft but not round. Radius grows with the size of the object: 3px on badges, 4px on skeleton text bars, 6px on poster thumbs, 8px on poster tiles and the like/dislike bar, 12px on panels and dialogs. Buttons and form fields keep their stock Material 3 shapes. Navigation items are deliberately square (radius 0) and span the full drawer width. Borders are rare and always 1px Hairline Slate; the one exception is the 2px dashed outline of the "refresh" tile.

## Components

### Buttons
Stock Material buttons, chosen by weight of the action.
- **Filled** (`mat-flat-button`): the one primary action on a screen, such as "Sign in with Passkey" (48px tall, full width up to 360px).
- **Stroked** (`mat-stroked-button`): secondary actions with a label, such as "Register" or enabling a user.
- **Text** (`mat-button`): low-emphasis inline actions, such as searching for a title.
- **Icon** (`mat-icon-button`): per-row actions (download, show NFO, filters), each with an `aria-label`.
- Hover, focus and pressed states are Material's own state layers; none are overridden.

### Title Row (signature)
The expandable row used for releases, library items and watchlist items. A `mat-expansion-panel` on Console Grey with an auto-height header.
- **Collapsed:** poster thumb, title (one line, ellipsis), meta line (year, rating, genre), then an optional state line: "In library" in Shelf Periwinkle, quality badges, or the keyword summary.
- **Opened:** a divider, the media details, an uppercase section label, then a list of releases separated by dividers. Each release is its name as a link, and a line with size, seeders, leechers and icon actions pushed to the right.
- **Loading:** a skeleton row of the same dimensions (12px radius) with a shimmer sweep (1.5s linear, infinite).

### Poster Tile
A vertical tile for recommendation ribbons: 2:3 poster on top, two-line clamped title, meta and genre below, on Console Grey with 8px corners. The last tile of a ribbon can be a dashed "refresh" tile that turns Booth Light Azure on hover (0.15s).

### Chips and Badges
- **Media badge:** tiny uppercase tag (3px radius, 1px 5px padding) in a drift hue on its own 18% tint.
- **Keyword chips:** stock `mat-chip-grid` in the watchlist dialog.
- **Count badge:** stock `matBadge` for unread watchlist releases and active filter count; hidden at zero.

### Inputs / Fields
Stock outlined `mat-form-field` with `subscriptSizing="dynamic"` so no space is reserved for hints. The search field has a leading search icon and a trailing clear button that appears only when there is text. Filters live in a `mat-menu` behind a tune icon, with a check icon marking the selected option.

### Navigation
- **Toolbar:** Console Grey with a Hairline Slate bottom line, showing only the current page title (and the menu button on phones).
- **Drawer:** user block on top, 48px square list items with a leading icon, a divider before the admin-only items, and a footer with the commit hash (mono, linked) and "Sign out".
- **Active item:** Selected Slate background with matching text and icon.

### Feedback Bar
Two equal halves, like and dislike, in one 8px-rounded bar. Idle halves are an 8% tint, hovered 18%, selected solid. Disabled is 40% opacity.

### Dialogs
Stock Material dialogs with a 12px container. The poster dialog is the exception: a transparent, shadowless surface so the enlarged poster floats alone.

## Do's and Don'ts

### Do:
- **Do** read color from `--mat-sys-*` custom properties so the theme stays the single source.
- **Do** use Dim Grey (`on-surface-variant`) for anything secondary and keep Screen White for titles.
- **Do** build list pages as one centered column of Title Rows (max 960px, 1000px from the breakpoint).
- **Do** raise a surface by tone (Console Grey on Booth Black) and separate same-tone regions with a 1px Hairline Slate line.
- **Do** keep Shelf Periwinkle for ownership and watch state, and Booth Light Azure for links and actions.
- **Do** truncate collapsed titles to one line and let opened release names break anywhere.
- **Do** match a skeleton's size and radius to the thing it stands in for.
- **Do** author for the phone first and widen at 960px only.

### Don't:
- **Don't** add shadows to cards, rows or tiles.
- **Don't** restyle Material buttons, fields or chips for looks; override only for density or layout.
- **Don't** add a light theme variant or assume one exists.
- **Don't** introduce new hard-coded colors. The seeder green and the five badge tints are tolerated drift, not a palette to extend.
- **Don't** add a second breakpoint or a multi-column grid of rows.
- **Don't** let the interface draw saturated color next to posters.
