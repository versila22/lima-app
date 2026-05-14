"""Launch WebKit (Safari engine) pointed at lima-app for manual Safari testing on Windows."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://limaimpro.duckdns.org"
USER_DATA_DIR = Path.home() / ".playwright-webkit-lima"
USER_DATA_DIR.mkdir(exist_ok=True)

print(f"Lancement de WebKit -> {URL}")
print(f"Profil persistant : {USER_DATA_DIR}")
print("Ferme la fenêtre pour quitter.\n")

with sync_playwright() as p:
    context = p.webkit.launch_persistent_context(
        user_data_dir=str(USER_DATA_DIR),
        headless=False,
        viewport={"width": 1280, "height": 800},
        # Spoof a real Safari UA so any UA sniffing on the backend behaves like Safari
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) "
            "Version/17.5 Safari/605.1.15"
        ),
        # Real Safari ITP behavior — block third-party cookies
        # WebKit in Playwright is closer to Safari than Chrome, but this enforces ITP-like cookie blocking
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(URL)
    # Wait until the user closes the window
    try:
        page.wait_for_event("close", timeout=0)
    except Exception:
        pass
    context.close()

print("\nFenêtre fermée.")
