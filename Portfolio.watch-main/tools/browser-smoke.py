#!/usr/bin/env python3
"""Optional real-browser smoke tests. Requires Python Playwright and a working Chromium executable."""
from __future__ import annotations

import os
import shutil
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def report_skip(message: str) -> None:
    print(f"SKIP / BLOCKED: {message}", flush=True)
    raise SystemExit(2)


try:
    from playwright.sync_api import sync_playwright
except Exception as error:
    report_skip(f"Python Playwright is not installed ({error}). Install Playwright and Chromium to run browser smoke tests.")

browser_path = os.environ.get("CHROMIUM") or shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
if not browser_path:
    report_skip("No Chromium executable was found. Set CHROMIUM=/path/to/chromium to enable this test.")

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
base = f"http://127.0.0.1:{server.server_address[1]}"

passed = []
errors = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=browser_path,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--enable-unsafe-swiftshader"],
            timeout=12000,
        )
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page_errors = []
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            try:
                page.goto(f"{base}/tests/browser-harness.html", wait_until="domcontentloaded", timeout=12000)
            except Exception as error:
                message = str(error)
                if "ERR_BLOCKED_BY_ADMINISTRATOR" in message:
                    report_skip("The browser policy blocked even local HTTP navigation (ERR_BLOCKED_BY_ADMINISTRATOR); interactive browser and Doom initialization are unverified.")
                raise
            page.wait_for_function("document.querySelector('#browser-test-result')?.dataset.result === 'pass' || document.querySelector('#browser-test-result')?.dataset.result === 'fail'", timeout=12000)
            result_text = page.locator("#browser-test-result").inner_text()
            if page.locator("#browser-test-result").get_attribute("data-result") != "pass":
                errors.append(f"Portfolio interaction harness failed:\n{result_text}")
            elif page_errors:
                errors.append("JavaScript page errors during portfolio interactions: " + "; ".join(page_errors))
            else:
                passed.append(result_text)

            doom_page = browser.new_page(viewport={"width": 1280, "height": 900})
            doom_errors = []
            doom_page.on("pageerror", lambda error: doom_errors.append(str(error)))
            try:
                doom_page.goto(f"{base}/tests/doom-harness.html", wait_until="domcontentloaded", timeout=12000)
            except Exception as error:
                if "ERR_BLOCKED_BY_ADMINISTRATOR" in str(error):
                    report_skip("The browser policy blocked local Doom harness navigation (ERR_BLOCKED_BY_ADMINISTRATOR); Doom initialization and gameplay are unverified.")
                raise
            doom_page.wait_for_function("document.querySelector('#doom-test-result')?.dataset.result === 'pass' || document.querySelector('#doom-test-result')?.dataset.result === 'fail'", timeout=28000)
            doom_result = doom_page.locator("#doom-test-result").inner_text()
            if doom_page.locator("#doom-test-result").get_attribute("data-result") != "pass":
                errors.append(f"Doom runtime smoke test failed:\n{doom_result}")
            elif doom_errors:
                errors.append("JavaScript errors during Doom initialization: " + "; ".join(doom_errors))
            else:
                passed.append(doom_result)
            browser.close()
        finally:
            if browser.is_connected():
                browser.close()
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=1)

for result in passed:
    print(f"PASS\n{result}", flush=True)
for error in errors:
    print(f"FAIL\n{error}", file=sys.stderr, flush=True)
if errors:
    raise SystemExit(1)
if len(passed) == 2:
    print("PASS: interactive portfolio and Doom runtime browser checks", flush=True)
else:
    report_skip("Browser tests did not complete.")
