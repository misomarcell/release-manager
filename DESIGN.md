---
name: Release Manager
description: A calm, green-tinted Material 3 front end to a home media setup, built from one row, one title page and one status strip.
colors:
  surface: "#0e1514"
  surface-container-low: "#141b1a"
  surface-container: "#1a2120"
  surface-container-high: "#242b2a"
  bar: "#161d1c"
  on-surface: "#dde4e2"
  on-surface-variant: "#b4bfbc"
  outline: "#889391"
  outline-variant: "#3a4442"
  primary: "#82d5c8"
  on-primary: "#003731"
  primary-container: "#00504a"
  on-primary-container: "#a4f4e7"
  secondary-container: "#30514b"
  on-secondary-container: "#d2ede6"
  tertiary: "#f2c04e"
  on-tertiary: "#402d00"
  tertiary-container: "#574000"
  on-tertiary-container: "#ffe0a0"
  error: "#ffb4ab"
  positive: "#8bd89a"
typography:
  detail-title:
    fontFamily: "'Google Sans Flex', system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: "36px"
  page-title:
    fontFamily: "'Google Sans Flex', system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: "32px"
  row-title:
    fontFamily: "'Google Sans Flex', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "21px"
  body:
    fontFamily: "'Google Sans Flex', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  meta:
    fontFamily: "'Google Sans Flex', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  tag:
    fontFamily: "'Google Sans Flex', system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: "20px"
  mono:
    fontFamily: "'Google Sans Code', ui-monospace, monospace"
    fontSize: "12.5px"
    lineHeight: "18px"
rounded:
  seam: "6px"
  tag: "6px"
  chip: "8px"
  poster: "10px"
  poster-large: "16px"
  group: "20px"
  pane: "28px"
  pill: "9999px"
spacing:
  seam: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pane: "28px"
components:
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    height: "40px"
  title-row:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.seam}"
    padding: "8px 12px 8px 8px"
  title-row-selected:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.group}"
  poster-thumb:
    backgroundColor: "{colors.surface-container-high}"
    rounded: "{rounded.poster}"
    width: "56px"
  filter-chip:
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.chip}"
    height: "32px"
  tag:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    height: "20px"
  search-bar:
    backgroundColor: "{colors.surface-container-high}"
    rounded: "{rounded.pill}"
    height: "56px"
  nav-item-active:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
---

# Design System: Release Manager

The frontmatter lists the dark values. Light values and the role mapping are in the Colors table. The source of truth is `web/src/styles.scss`; the brief behind it is `docs/redesign-brief.md`.

## Overview

Release Manager stays inside Material 3 but does not look like stock Angular Material. Neutrals are tinted green, the accent is teal, and surfaces are separated by tone, never by shadow. Posters are the only saturated imagery.

Every feature page is built from the same three parts:

1. **One title row** (`app-title-row`): poster, title, a meta line, a line of tags and state chips, and a trailing column whose content depends on the page.
2. **One title page** (`app-title-detail`): header, plot, action bar, at most one filled button, status cells, then page-specific content.
3. **One segmented group** (`.seg-list`): items 2px apart with 6px inner corners and 20px outer corners. Lists, status cells, the action bar, key/value lists and release lists all use it.

The interface follows the device colour scheme (light and dark) and is English only.

## Colors

All colour comes from theme roles. Components never contain hexes.

| Role                     | Token                              | Dark                  | Light                 | Used for                                                 |
| ------------------------ | ---------------------------------- | --------------------- | --------------------- | -------------------------------------------------------- |
| Ground                   | `--mat-sys-surface`                | `#0e1514`             | `#edf3f0`             | Page background                                          |
| Pane                     | `--mat-sys-surface-container-low`  | `#141b1a`             | `#f7fbf9`             | Desktop detail pane, sheets                              |
| Tile                     | `--mat-sys-surface-container`      | `#1a2120`             | `#ffffff`             | Rows, cells, action bar                                  |
| Tile high                | `--mat-sys-surface-container-high` | `#242b2a`             | `#f3f8f6`             | Nested fills, rail icon shape, tags, search field (dark) |
| Bar                      | `--rm-bar`                         | `#161d1c`             | `#e4ebe8`             | Bottom navigation, rail                                  |
| On surface               | `--mat-sys-on-surface`             | `#dde4e2`             | `#161d1c`             | Titles, primary text                                     |
| On surface variant       | `--mat-sys-on-surface-variant`     | `#b4bfbc`             | `#414b49`             | Secondary text                                           |
| Outline / variant        | `--mat-sys-outline(-variant)`      | `#889391` / `#3a4442` | `#6f7977` / `#c3cdca` | Borders, dividers                                        |
| Primary / on             | `--mat-sys-primary`                | `#82d5c8` / `#003731` | `#006a60` / `#ffffff` | Filled button, links, focus ring                         |
| Primary container / on   | `--mat-sys-primary-container`      | `#00504a` / `#a4f4e7` | `#a4f4e7` / `#00201c` | "In library", active Like and Following                  |
| Secondary container / on | `--mat-sys-secondary-container`    | `#30514b` / `#d2ede6` | `#cfe9e2` / `#06201c` | Selected row, active nav, selected chip, resolution tag  |
| Tertiary / on            | `--mat-sys-tertiary`               | `#f2c04e` / `#402d00` | `#755800` / `#ffffff` | "New" count, rating star                                 |
| Tertiary container / on  | `--mat-sys-tertiary-container`     | `#574000` / `#ffe0a0` | `#ffe0a0` / `#251a00` | HDR and DV tags, "Why this pick"                         |
| Error                    | `--mat-sys-error`                  | `#ffb4ab`             | `#ba1a1a`             | Leechers, destructive actions                            |
| Positive                 | `--rm-positive`                    | `#8bd89a`             | `#1c6c35`             | Seeders, FL badge                                        |

### Named Rules

- **One job per colour.** Amber means "new since you last looked", plus rating stars, and nothing else.
- **Theme roles only.** A new colour is a new role in `styles.scss`, defined for both schemes with `light-dark()`.

## Typography

- **Google Sans Flex** for all interface text. **Google Sans Code** (`.mono`) only for release names, file paths and NFO text.
- Weights: 650 page and detail titles and section headings, 600 row titles, 500 to 550 buttons and labels, 450 to 500 chips and tags, 400 body.
- Sizes: detail title 30px (23px on phones), page title 26px, row title 16px, section heading 16px, body 14 to 14.5px, meta 13px, tags 11.5px, release names 12.5px.
- Numbers that line up in columns use `.num` (tabular figures).
- Chips and tags must stay light: small, medium weight, no uppercase.

## Layout

- **Phone (default):** a bottom navigation bar with Releases, Library, Watchlist and Discover. Opening a title is a full-screen page that slides over the list.
- **Desktop (from 960px):** an 88px navigation rail, a list column up to 432px wide and a detail pane. The first row is shown in the pane until another is selected.
- The top bar is always 56px tall: a search field (`app-filter-search`), a page title (`app-page-title`) or back button and label (title page on phones).
- Manage Users, Settings, Administration, Logs and Sign out are behind the account avatar: in the top bar on phones, at the bottom of the rail on desktop.
- Fixed bars pad by the safe-area insets.

## Elevation & Depth

No shadows on content. Depth is tone: ground, pane, tile, tile high. Menus keep Material's own elevation.

## Shapes

- Segmented groups: 2px seams, 6px inner corners, 18 to 20px outer corners. A selected row rounds fully to 20px.
- Posters 10px in rows, 14 to 16px on title pages and tiles.
- Buttons are pills (40px, 34px small). Filter chips 8px. Tags 6px. Detail pane, dialogs and sheets 28px.

## Components

### Title row

Poster (56px), title on one line, a meta line (year, star rating, one more fact), then tags and state chips. The trailing column changes per page: top seeder count and release count (Releases), size on disk (Library), new or known count (Watchlist), a Follow button (title search). The whole row is one link.

### Title page

1. Header: poster, title, a facts line (type, year, runtime, rating, star score), genres.
2. Plot, always under a "Plot" heading. On wide panes it sits beside the poster.
3. Action bar: equal cells with the icon above the label. Follow (becomes Following), Trailer, IMDb, and More on desktop; then a gap; then Like and Dislike. Active cells fill with the primary container.
4. At most one filled button: Open in Jellyfin (Library), Mark as read (Watchlist), Search releases (Discover). Releases has none.
5. Status: Trackers, Library, Watchlist. Three columns on wide panes, three full-width rows on phones.
6. Page content: release list, seasons and media info, new releases and filter, or the AI reason.

### Releases

Each release shows parsed tags first, then the raw name in mono, breaking at the dots. It names its tracker; freeleech is a compact **FL** badge next to the tracker and never sits among the quality tags. Seeders are green with an up arrow, leechers red with a down arrow. A release is never labelled "best".

### Tags and state chips

`.tag` is neutral; `.tag.res` (resolution) and `.tag.hdr` (HDR, DV) are the only two emphases. `.state.own` is "In library", `.state.following` is "Following", `.state.new` is the amber new count.

### Search and filters

A 56px pill with the search icon, the field, a clear button and optional trailing content (the tracker picker on Releases, the account avatar on phones). Filters are visible chips under it; the selected chip fills and gains a check.

### Navigation

Rail items sit on a 56×48 shape with a 14px radius; the active one fills with the secondary container and its icon becomes filled. The bottom bar uses a 60×32 pill for the active item. The watchlist count is an amber badge on the icon.

### Sheets

Download ("Send to qBittorrent"), the watchlist editor, the NFO viewer and the settings editors are bottom sheets on phones and centred dialogs otherwise. In the download sheet the save path is the focused field. In the watchlist sheet Remove is kept apart from Save.

### Settings

A single column (up to 720px) of segmented groups under a page title. Schedules come first: each is a pressable row with the job, its schedule in words and the next run. Then one group per service: a heading with a one-line description, an optional text "Test" button and a tonal "Edit" button, and key/value rows that are read-only. URLs and paths are mono; a secret only ever shows a lock and "Set"; a value saved from the UI carries a neutral "Edited" tag.

Editing happens in a sheet, where Save is the one filled button and Reset is kept apart from it. The schedule sheet has no cron text: chips pick the repeat (every day, certain days, every few hours), a row of equal cells picks weekdays or the hour step, and a tile states the result in a sentence.

### Loading

Skeletons in the shape of what is loading: `app-row-skeletons` for lists, poster-shaped blocks for ribbons, two lines for the plot.

## Motion and feedback

- Hand-built controls share `.pressable`: hover tints, press scales to 0.97, keyboard focus draws a 2px primary outline.
- Route changes cross-fade in 160ms. On phones the title page slides in from the right and back out. Filter and page changes do not animate.
- Sheets slide up on phones.
- All of it is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- Build new lists from `app-title-row` inside `.seg-list`, and new title content inside `app-title-detail`.
- Say "trackers", and let each release name its tracker.
- Show library and watchlist state on the title wherever it appears.
- Keep long machine strings in `.mono` and let them wrap.

### Don't:

- Don't add a colour that is not a theme role, or reuse amber for anything but "new" and rating stars.
- Don't add a second filled button to a page.
- Don't put shadows on content or expand rows in place.
- Don't rank releases or call one "best".

## Not designed yet

Login, Manage Users, Administration and Logs use the theme but have not been redesigned.
