#!/usr/bin/env python3
"""Diagnostic test for Dutch Tutor app components."""
import sys, time, urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).parent
PASS = "  ✓"
FAIL = "  ✗"

print("=" * 50)
print("Dutch Tutor — Diagnostic Test")
print("=" * 50)

# 1. Imports
print("\n[1] Testing imports...")
try:
    import objc;                                    print(f"{PASS} objc")
    from AppKit import NSApplication, NSWindow, NSStatusBar, NSObject;   print(f"{PASS} AppKit")
    from WebKit import WKWebView, WKWebViewConfiguration;   print(f"{PASS} WebKit")
    from Foundation import NSURL, NSURLRequest, NSTimer;    print(f"{PASS} Foundation")
except ImportError as e:
    print(f"{FAIL} Import error: {e}"); sys.exit(1)

# 2. Server
print("\n[2] Testing server...")
try:
    urllib.request.urlopen("http://127.0.0.1:8765/api/map", timeout=2)
    print(f"{PASS} Server running on :8765")
except Exception as e:
    print(f"{FAIL} Server not reachable: {e}")
    print("     → Start the server first: python -m uvicorn server:app --host 127.0.0.1 --port 8765")

# 3. WKWebView window — opens for 3 seconds then closes
print("\n[3] Testing WKWebView window (will open for 3s)...")
try:
    from AppKit import (
        NSWindow, NSBackingStoreBuffered, NSMakeRect,
        NSWindowStyleMaskTitled, NSWindowStyleMaskClosable,
        NSWindowStyleMaskMiniaturizable, NSWindowStyleMaskResizable,
        NSApplicationActivationPolicyAccessory,
    )

    class TestDelegate(NSObject):
        def applicationDidFinishLaunching_(self, notif):
            from AppKit import NSApp
            style = (NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                     NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable)
            self._win = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
                NSMakeRect(200, 200, 800, 600), style, NSBackingStoreBuffered, False
            )
            self._win.setTitle_("Dutch Tutor TEST — close me in 3s")
            cfg = WKWebViewConfiguration.alloc().init()
            wv  = WKWebView.alloc().initWithFrame_configuration_(
                NSMakeRect(0, 0, 800, 600), cfg
            )
            wv.setAutoresizingMask_(18)
            wv.loadRequest_(NSURLRequest.requestWithURL_(
                NSURL.URLWithString_("http://127.0.0.1:8765")
            ))
            self._wv  = wv
            self._cfg = cfg
            self._win.setContentView_(wv)
            self._win.center()
            self._win.makeKeyAndOrderFront_(None)
            NSApp.activateIgnoringOtherApps_(True)
            print(f"{PASS} WKWebView window created and shown!")
            # Schedule close
            from Foundation import NSTimer
            self._t = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
                3.0, self, "closeTest:", None, False
            )

        def closeTest_(self, _):
            from AppKit import NSApp
            print(f"{PASS} Window visible: {self._win.isVisible()}")
            NSApp.stop_(None)

    nsa = NSApplication.sharedApplication()
    nsa.setActivationPolicy_(NSApplicationActivationPolicyAccessory)
    d = TestDelegate.alloc().init()
    nsa.setDelegate_(d)
    nsa.run()
    print(f"{PASS} NSApplication event loop ran OK")

except Exception as e:
    import traceback
    print(f"{FAIL} Window test failed: {e}")
    traceback.print_exc()

# 4. Status bar
print("\n[4] Testing status bar item...")
try:
    sb   = NSStatusBar.systemStatusBar()
    from AppKit import NSVariableStatusItemLength
    item = sb.statusItemWithLength_(NSVariableStatusItemLength)
    item.button().setTitle_("🇳🇱 TEST")
    print(f"{PASS} Status bar item created")
    time.sleep(1)
    sb.removeStatusItem_(item)
    print(f"{PASS} Status bar item removed")
except Exception as e:
    print(f"{FAIL} Status bar failed: {e}")

print("\n" + "=" * 50)
print("Done. If [3] showed a window → app.py will work.")
print("Run: python app.py")
print("=" * 50)
