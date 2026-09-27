"""The Crypt — system tray launcher.

Double-click to start. Runs server/server.py in the background (no console window) and puts a
sigil in the system tray:
  green dot = server running · amber = starting · red = stopped

Right-click menu: Open panel, Restart / Start / Stop server, Open server log,
Start with Windows, Quit. Left-click opens the panel.
Also warns (Windows notification) when the Twitch token is within a week of expiring.

Needs: pip install --user pystray pillow
"""
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
import winreg
from pathlib import Path

import pystray
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SERVER_SCRIPT = ROOT / 'server' / 'server.py'
LOG_FILE = ROOT / 'data' / 'server.log'
TWITCH_CONFIG = ROOT / 'config' / 'twitch-config.js'
ASSETS = ROOT / 'assets'

PORT = 8765
BASE_URL = f'http://127.0.0.1:{PORT}'
PANEL_URL = f'http://localhost:{PORT}/panel.html'

STATUS_POLL_S = 5
TOKEN_CHECK_S = 6 * 3600
TOKEN_WARN_DAYS = 7

RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
RUN_NAME = 'CryptControl'

DOT_COLOURS = {'running': (74, 222, 128), 'starting': (245, 158, 11), 'stopped': (220, 38, 38), 'external': (129, 140, 248)}
STATUS_TEXT = {
    'running': 'Server running',
    'starting': 'Server starting…',
    'stopped': 'Server stopped',
    'external': 'Server running (started elsewhere)',
}


# ── ICON ──
def base_icon():
    """The tray image: any png/ico in assets/, else a drawn sigil."""
    for pattern in ('tray*.png', 'tray*.ico', '*.png', '*.ico'):
        for path in sorted(ASSETS.glob(pattern)):
            try:
                return Image.open(path).convert('RGBA').resize((64, 64), Image.LANCZOS)
            except OSError:
                continue
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 2, 62, 62), fill=(15, 13, 15, 255), outline=(201, 168, 76, 255), width=3)
    # inverted dagger (⸸)
    d.line((32, 14, 32, 50), fill=(201, 168, 76, 255), width=5)
    d.line((22, 40, 42, 40), fill=(201, 168, 76, 255), width=5)
    return img


def status_icon(base, status):
    img = base.copy()
    d = ImageDraw.Draw(img)
    d.ellipse((40, 40, 63, 63), fill=DOT_COLOURS[status], outline=(8, 8, 8, 255), width=3)
    return img


# ── SERVER PROCESS ──
class ServerControl:
    def __init__(self):
        self.proc = None
        self.log = None
        self.lock = threading.Lock()

    def responding(self):
        try:
            with urllib.request.urlopen(BASE_URL + '/api/state', timeout=2) as res:
                return res.status == 200
        except OSError:
            return False

    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def start(self):
        with self.lock:
            if self.running():
                return 'running'
            if self.responding():
                return 'external'   # another copy (e.g. start-crypt-server.bat) already has the port
            LOG_FILE.parent.mkdir(exist_ok=True)
            self.log = open(LOG_FILE, 'a', encoding='utf-8')
            self.log.write(f'\n── started {time.strftime("%Y-%m-%d %H:%M:%S")} ──\n')
            self.log.flush()
            self.proc = subprocess.Popen(
                [python_exe(console=False), '-u', str(SERVER_SCRIPT)],
                cwd=str(ROOT),
                stdout=self.log, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            return 'starting'

    def stop(self):
        with self.lock:
            if self.running():
                self.proc.terminate()
                try:
                    self.proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.proc.kill()
            self.proc = None
            if self.log:
                self.log.close()
                self.log = None

    def status(self):
        if self.running():
            return 'running' if self.responding() else 'starting'
        return 'external' if self.responding() else 'stopped'


def python_exe(console):
    exe = Path(sys.executable)
    want = 'python.exe' if console else 'pythonw.exe'
    candidate = exe.with_name(want)
    return str(candidate if candidate.exists() else exe)


# ── START WITH WINDOWS ──
def autostart_command():
    return f'"{python_exe(console=False)}" "{Path(__file__).resolve()}"'


def autostart_enabled():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, RUN_NAME)
            return True
    except OSError:
        return False


def set_autostart(on):
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
        if on:
            winreg.SetValueEx(key, RUN_NAME, 0, winreg.REG_SZ, autostart_command())
        else:
            try:
                winreg.DeleteValue(key, RUN_NAME)
            except OSError:
                pass


# ── TWITCH TOKEN ──
def token_days_left():
    """Days until the Twitch token expires; 0 if expired; None if there's no token or Twitch can't be reached."""
    try:
        text = TWITCH_CONFIG.read_text(encoding='utf-8')
    except OSError:
        return None
    match = re.search(r"token:\s*'([^']+)'", text)
    if not match:
        return None
    req = urllib.request.Request('https://id.twitch.tv/oauth2/validate',
                                 headers={'Authorization': 'OAuth ' + match.group(1)})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.load(res).get('expires_in', 0) // 86400
    except urllib.error.HTTPError as err:
        return 0 if err.code == 401 else None
    except OSError:
        return None


# ── TRAY ──
class CryptTray:
    def __init__(self):
        self.server = ServerControl()
        self.base = base_icon()
        self.state = 'stopped'
        self.warned_external = False
        self.icon = pystray.Icon('crypt-control', status_icon(self.base, 'stopped'), 'Crypt Control', self.menu())

    def menu(self):
        item = pystray.MenuItem
        return pystray.Menu(
            item(lambda _: '⸸ ' + STATUS_TEXT[self.state], None, enabled=False),
            pystray.Menu.SEPARATOR,
            item('Open panel', self.open_panel, default=True),
            item('Restart server', self.restart),
            item(lambda _: 'Stop server' if self.state in ('running', 'starting') else 'Start server', self.toggle_server),
            item('Open server log', self.open_log),
            pystray.Menu.SEPARATOR,
            item('Start with Windows', self.toggle_autostart, checked=lambda _: autostart_enabled()),
            pystray.Menu.SEPARATOR,
            item('Quit', self.quit),
        )

    def set_state(self, state):
        if state == self.state:
            return
        self.state = state
        self.icon.icon = status_icon(self.base, state)
        self.icon.title = 'Crypt Control — ' + STATUS_TEXT[state]
        self.icon.update_menu()

    def notify(self, message):
        try:
            self.icon.notify(message, 'Crypt Control')
        except Exception:
            pass

    # menu actions
    def open_panel(self, *_):
        webbrowser.open(PANEL_URL)

    def restart(self, *_):
        if self.state == 'external':
            self.notify('The server was started elsewhere (start-crypt-server.bat?). Close that window, then use Start server here.')
            return
        self.server.stop()
        self.set_state(self.server.start())

    def toggle_server(self, *_):
        if self.state in ('running', 'starting'):
            self.server.stop()
            self.set_state('stopped')
        elif self.state == 'external':
            self.notify('The server was started elsewhere. Close that window to control it from here.')
        else:
            self.set_state(self.server.start())

    def open_log(self, *_):
        LOG_FILE.parent.mkdir(exist_ok=True)
        LOG_FILE.touch(exist_ok=True)
        os.startfile(str(LOG_FILE))

    def toggle_autostart(self, *_):
        set_autostart(not autostart_enabled())
        self.icon.update_menu()

    def quit(self, *_):
        self.server.stop()
        self.icon.stop()

    # background loops
    def watch_server(self):
        while True:
            status = self.server.status()
            if status == 'stopped' and self.server.proc is not None:
                # our process died on its own
                code = self.server.proc.poll()
                self.server.stop()
                self.notify('The server stopped unexpectedly (exit code {}). Check "Open server log".'.format(code))
            if status == 'external' and not self.warned_external:
                self.warned_external = True
                self.notify('A Crypt server is already running outside the tray. The tray will just show its status.')
            self.set_state(status)
            time.sleep(STATUS_POLL_S)

    def watch_token(self):
        while True:
            days = token_days_left()
            if days == 0:
                self.notify('Twitch token has expired: the goal bars and follower stats are off. Steps are in config/twitch-config.example.js.')
            elif days is not None and days <= TOKEN_WARN_DAYS:
                self.notify('Twitch token expires in {} day{}: renew it before it cuts out mid-stream.'.format(days, '' if days == 1 else 's'))
            time.sleep(TOKEN_CHECK_S)

    def run(self):
        def setup(icon):
            icon.visible = True
            self.set_state(self.server.start())
            threading.Thread(target=self.watch_server, daemon=True).start()
            threading.Thread(target=self.watch_token, daemon=True).start()
        self.icon.run(setup)


if __name__ == '__main__':
    CryptTray().run()
