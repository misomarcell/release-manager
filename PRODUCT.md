# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** the owner, who self-hosts the app next to their own qBittorrent and Jellyfin, administers it, and uses it daily.
- **Secondary:** a few trusted people (family, friends) whom the owner enables by hand. They browse, download and keep their own watchlists; they do not administer anything.
- It is not a product for strangers. There is no public sign-up path: a new passkey registration stays inactive until the admin enables it.
- Typical situation: on a phone, deciding what to watch or checking whether something new has come out. Desktop is secondary and is where admin work tends to happen.

## Product Purpose

Release Manager is a private front end to a home media setup. It shows what is new on nCore as recognizable titles (poster, rating, genres, plot from TMDB) instead of raw release names, tells the user whether they already have a title in Jellyfin, and sends a chosen release to qBittorrent with the right save path in a few taps.

Success is: from "is there anything new worth watching?" to "it is downloading into the right folder" without opening nCore, qBittorrent or Jellyfin.

## Positioning

One screen that joins four systems the owner already runs or uses: nCore (source), TMDB (meaning), qBittorrent (download), Jellyfin (what is already owned). Each of those has its own UI; none of them knows about the others. The value is the join, not any single feature.

## Operating Context

- Self-hosted with Docker Compose on the owner's server, on the same Docker network as qBittorrent.
- Login is passkey only (WebAuthn), no passwords.
- Main workflows:
  - **Releases:** browse or search nCore by category or keyword, see enriched cards, read the NFO, download.
  - **Download:** the app suggests a save path (movies vs. TV), the user may edit it, the torrent goes to qBittorrent.
  - **Library:** browse what is in Jellyfin, including per-season episode counts and media stream details.
  - **Watchlist:** follow a title, optionally with keywords; a daily check flags new nCore releases as unread badges until marked as read.
  - **Recommendations:** trending/top-rated from TMDB and AI-personalized picks, with like/dislike feedback.
  - **Admin (owner only):** manage users, change schedules and service connections on the Settings page, trigger syncs, read logs.
- List pages keep search, filters and page in the URL so the browser back button steps through them.

## Capabilities and Constraints

- Angular SSR with Angular Material 3; standalone, mobile-first components.
- Installed as a PWA (web manifest and service worker are present).
- UI copy is English. Release names are scene-style strings (long, dotted, unbreakable), and titles or metadata coming from nCore and TMDB can contain Hungarian characters, which must render correctly.
- Release names, NFO text, user agents and paths are long machine strings that must stay readable on a narrow screen.
- Roles: regular user and admin. Admin-only pages are Manage Users, Settings, Administration and Logs.
- AI recommendations are optional and absent when no OpenAI key is configured.
- **Several trackers.** nCore is the primary tracker (it supplies the top list) and The Pirate Bay is a secondary one; more can be added as plugins. Design and copy must not assume a single source: say "trackers", and let a release name its tracker.
- **Planned: search all titles.** Search today covers releases and the library only. A search across every title (via TMDB) is wanted so that a title can be followed on the watchlist before any release exists. The scoped release and library searches stay.
- There is no ruleset yet for which release is "best". Do not rank or label a release as best.
- The interface is English only. `index.html` still declares `lang="hu"`, which is a leftover to correct.

## Brand Commitments

- Name: **Release Manager**. "MovieReleases" in the README and folder name is a leftover, not the product name.
- No logo, tagline, voice guide or other brand assets have been made binding.

## Evidence on Hand

- Real content comes from live integrations (nCore results, TMDB posters and metadata, Jellyfin library). The app needs a configured backend to show any of it.
- There are no testimonials, usage numbers, marketing copy or screenshots in the repository. Future work must not invent them.

## Product Principles

1. **The phone is the main screen.** Every core task (find, judge, download, check the watchlist) must be comfortable one-handed on a narrow viewport; desktop gets the same thing with more room.
2. **Titles, not torrents.** Lead with what a person recognizes (poster, title, year, rating) and keep the technical release details available but secondary.
3. **Answer "do I already have this?" before it is asked.** Library and watchlist state belong on the item wherever it appears.
4. **Few taps to a download, none of them a surprise.** Defaults should be right, and the save path stays visible and editable.
5. **Built for people who are trusted.** No onboarding funnel, no persuasion, no growth mechanics; admin tooling is plain and stays out of regular users' way.
