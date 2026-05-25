#!/usr/bin/env python3
"""
Dutch Tutor — native macOS menu bar app.
Single WKWebView window. Click 🇳🇱 to open/minimize.
"""
import sys, time, urllib.request
from pathlib import Path

import objc
from AppKit import (
    NSApplication, NSApplicationActivationPolicyAccessory,
    NSBackingStoreBuffered, NSMakeRect, NSObject,
    NSStatusBar, NSVariableStatusItemLength, NSWindow,
    NSWindowStyleMaskClosable, NSWindowStyleMaskMiniaturizable,
    NSWindowStyleMaskResizable, NSWindowStyleMaskTitled,
    NSApp,
)
from Foundation import NSURL, NSURLRequest, NSTimer
from WebKit import WKWebView, WKWebViewConfiguration

BASE_DIR = Path(__file__).parent
PORT     = 8765
URL      = f"http://127.0.0.1:{PORT}"

# ── strong global refs so Python GC never collects ObjC objects ─
_delegate = None
_win      = None
_webview  = None
_cfg      = None
_status   = None
_item     = None


def is_server_up():
    try:
        urllib.request.urlopen(f"{URL}/api/map", timeout=1)
        return True
    except Exception:
        return False


def start_server():
    import subprocess
    py = BASE_DIR / ".venv" / "bin" / "python"
    if not py.exists():
        py = Path(sys.executable)
    return subprocess.Popen(
        [str(py), "-m", "uvicorn", "server:app",
         "--host", "127.0.0.1", "--port", str(PORT), "--log-level", "error"],
        cwd=str(BASE_DIR),
    )


def make_window():
    global _win, _webview, _cfg
    style = (NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
             NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable)
    _win = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(
        NSMakeRect(0, 0, 1440, 900), style, NSBackingStoreBuffered, False
    )
    _win.setTitle_("Dutch Tutor 🇳🇱")
    _win.setMinSize_((800, 500))

    _cfg     = WKWebViewConfiguration.alloc().init()
    _webview = WKWebView.alloc().initWithFrame_configuration_(
        NSMakeRect(0, 0, 1440, 900), _cfg
    )
    _webview.setAutoresizingMask_(18)
    _webview.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(URL)))

    _win.setContentView_(_webview)
    _win.center()
    _win.orderFrontRegardless()   # forces window to front regardless of app focus
    NSApp.activateIgnoringOtherApps_(True)
    print("  ✓ Window opened")


def set_icon(open_state: bool):
    _item.button().setTitle_("🇳🇱 ●" if open_state else "🇳🇱 ○")


class AppDelegate(NSObject):

    def applicationDidFinishLaunching_(self, notification):
        global _item, _status
        _status = NSStatusBar.systemStatusBar()
        _item   = _status.statusItemWithLength_(NSVariableStatusItemLength)
        _item.button().setTitle_("🇳🇱 ○")
        _item.button().setTarget_(self)
        _item.button().setAction_("handleClick:")

        self._timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
            0.5, self, "pollServer:", None, True
        )
        print("  ✓ Menu bar ready")

    def pollServer_(self, timer):
        if is_server_up():
            timer.invalidate()
            self._timer = None
            print("  ✓ Server ready — opening window")
            make_window()
            set_icon(True)

    def handleClick_(self, sender):
        if _win is None:
            if is_server_up():
                make_window()
                set_icon(True)
            return
        if _win.isMiniaturized():
            _win.deminiaturize_(None)
            _win.makeKeyAndOrderFront_(None)
            NSApp.activateIgnoringOtherApps_(True)
            set_icon(True)
        elif _win.isVisible():
            _win.miniaturize_(None)
            set_icon(False)
        else:
            _win.orderFrontRegardless()
            NSApp.activateIgnoringOtherApps_(True)
            set_icon(True)


if __name__ == "__main__":
    print("🇳🇱 Dutch Tutor starting...")
    server_proc = None
    if not is_server_up():
        print(f"  → Starting server on :{PORT}...")
        server_proc = start_server()
    else:
        print(f"  ✓ Server already running")

    app = NSApplication.sharedApplication()
    # Prohibited = no Dock icon, but windows CAN appear (unlike Accessory)
    app.setActivationPolicy_(NSApplicationActivationPolicyAccessory)

    _delegate = AppDelegate.alloc().init()
    app.setDelegate_(_delegate)

    print("  → Running (Ctrl+C to quit)")
    try:
        app.run()
    except KeyboardInterrupt:
        pass
    finally:
        if server_proc:
            server_proc.terminate()
        print("Bye!")
