"""
SMOKE UI lima — pages publiques (boite noire).

lima est une SPA Vite/React : on attend le rendu client avant d'asserter. On ne
verifie que ce que voit un visiteur non connecte (HTTP, texte stable, <title>),
aucun acces au code ni a la base.

Sert de baseline / re-verif au skill deploy-guard (avant ET apres un deploiement prod).
`/donnees-personnelles` est une route LAZY publique : elle exerce le chemin d'import
dynamique durci le 2026-06-28 (recuperation gracieuse des chunks perimes).

Lancer (depuis le skill blackbox-e2e) :
    py -3 <skill>/scripts/run_blackbox.py e2e/ui_smoke.py --base-url https://limaimpro.duckdns.org --browser chromium
"""

import time
import unicodedata

from playwright.sync_api import Page

# (route publique, fragment de texte stable attendu apres rendu client)
PAGES = [
    ("/login",                "Gestion"),               # "Gestion & Spectacles"
    ("/forgot-password",      "Mot de passe oublie"),
    ("/donnees-personnelles", "Donnees personnelles"),  # route LAZY → import dynamique
]

EXPECTED_TITLE_FRAGMENT = "LIMA"


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _wait_for_text(page: Page, fragment: str, timeout_ms: int = 15_000) -> bool:
    """Poll le texte du body (SPA : rendu client async) jusqu'a trouver le fragment."""
    needle = _strip_accents(fragment).lower()
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        body = _strip_accents(page.locator("body").inner_text() or "").lower()
        if needle in body:
            return True
        page.wait_for_timeout(300)
    return False


def test(page: Page, ctx) -> None:
    failures = []

    for path, fragment in PAGES:
        url = ctx.base_url.rstrip("/") + path

        resp = page.goto(url, wait_until="domcontentloaded", timeout=25_000)
        if resp is None:
            failures.append(f"{path} : aucune reponse HTTP")
            continue
        if resp.status >= 400:
            failures.append(f"{path} : HTTP {resp.status}")
            continue

        # SPA : le rendu client est async. On attend que le texte stable attendu
        # apparaisse dans le body (poll jusqu'a 15 s). Si rien n'apparait, on distingue
        # "SPA non montee" (root vide) de "texte attendu absent" pour un diagnostic clair.
        if not _wait_for_text(page, fragment):
            root_len = page.evaluate("(document.getElementById('root')||{}).innerHTML?.length || 0")
            if not root_len:
                failures.append(f"{path} : #root vide (SPA non montee)")
            else:
                failures.append(f"{path} : texte attendu introuvable ('{fragment}')")
            continue

        if EXPECTED_TITLE_FRAGMENT.lower() not in (page.title() or "").lower():
            failures.append(f"{path} : <title> inattendu ('{page.title()}')")

    # PWA : service worker servi en JavaScript (installabilite).
    base = ctx.base_url.rstrip("/")
    try:
        r = page.request.get(base + "/sw.js")
        if r.status >= 400:
            failures.append(f"/sw.js : HTTP {r.status}")
        elif "javascript" not in (r.headers.get("content-type", "").lower()):
            failures.append(f"/sw.js : pas servi en JavaScript ({r.headers.get('content-type')})")
    except Exception as e:
        failures.append(f"/sw.js : erreur requete ({e})")

    if failures:
        page.screenshot(path=str(ctx.screenshot_dir / f"{ctx.browser_name}-lima-smoke-FAIL.png"))
        raise AssertionError(
            f"Smoke UI lima : {len(failures)} page(s) cassee(s) :\n  - " + "\n  - ".join(failures)
        )
