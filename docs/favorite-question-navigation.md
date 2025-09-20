# Favorite Question Review Navigation

This document explains how the application routes a user from the favorites list to the questions interface after the addition of the `favorite_question` URL parameter.

## Same-tab navigation

1. Click **Ir para a questão** within the favorites list.
2. The click handler intercepts an unmodified left click, serialises the favorite question payload into `sessionStorage` under the `medquiz.favoriteReviewTarget` key, and then redirects to `/questions/` with the `favorite_question=<id>` query string appended.
3. On the questions page load, the bootstrap logic reads the query parameter, falls back to the `sessionStorage` payload if the URL parameter is absent, and calls `actionOrchestrator.reviewFavoriteQuestion` with the resolved identifier.
4. After consumption, the query string is stripped via `history.replaceState` to avoid repeat loads when navigating within the same tab.

## New-tab navigation

1. Open **Ir para a questão** in a new tab or window (e.g. via context menu or modifier click).
2. Because modified clicks bypass the in-tab handler, the browser follows the link directly to `/questions/?favorite_question=<id>` without relying on `sessionStorage`.
3. The questions page bootstrap detects the query parameter, requests the favorite question review, and cleans the query string. Since `sessionStorage` is per-tab, this ensures the favorite question loads even in a fresh browsing context.

Both flows now result in a reliable favorite review experience.
