"""Local control server for The Crypt overlays.

Run:    start-crypt-server.bat   (or: python server/server.py)
Panel:  http://localhost:8765/panel.html
OBS:    browser sources point at http://localhost:8765/layout.html, /starting-soon.html, ...

Only listens on this PC (127.0.0.1). Serves the pages in the Overlays folder.
Settings live in data/crypt-state.json; tonight's recap (for the ending screen) in data/crypt-session.json.
"""
import json
import os
import secrets
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = '127.0.0.1'
PORT = 8765
ROOT = Path(__file__).resolve().parent.parent   # the Overlays folder: pages, js/, config/
DATA_DIR = ROOT / 'data'
STATE_FILE = DATA_DIR / 'crypt-state.json'
SESSION_FILE = DATA_DIR / 'crypt-session.json'
# folders the pages never need; not served over HTTP
PRIVATE_DIRS = [ROOT / 'server', DATA_DIR, ROOT / '.git']
MAX_BODY = 1_000_000

# Mai's monitor writes her current mood here (read-only — the overlay never changes it)
# Mai is a separate chat-bot project; point this at your own bot's mood file, or leave it —
# a missing file just means Mai shows as asleep.
MAI_MOOD_FILE = Path(r'C:\path\to\MaiDaemon\jsons\data\session_mood.json')
MAI_STALE_SECONDS = 30  # same cutoff Mai's own mood engine uses
MAI_MOODS_FILE = MAI_MOOD_FILE.parent / 'moods.json'
# only twitch_bot_username is read from this file — never the tokens
MAI_KEYS_FILE = MAI_MOOD_FILE.parent.parent / 'configs' / 'keys.json'

# requests are handled on several threads; one lock keeps read-modify-write saves from colliding
FILE_LOCK = threading.Lock()


def read_json_file(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def write_json_file(path, data):
    # write to a temp file first so a crash never leaves half a JSON file behind
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, path)


def read_state():
    data = read_json_file(STATE_FILE)
    return data if isinstance(data, dict) else {}


def mai_bot_username():
    keys = read_json_file(MAI_KEYS_FILE) or {}
    return str(keys.get('twitch_bot_username') or '').strip().lower()


def read_mai_moods():
    data = read_json_file(MAI_MOODS_FILE) or {}
    moods = data.get('moods') if isinstance(data, dict) else None
    return {'moods': sorted(moods) if isinstance(moods, dict) else []}


def read_mai_mood():
    data = read_json_file(MAI_MOOD_FILE)
    if not isinstance(data, dict):
        return {'awake': False, 'mood': None, 'botUsername': mai_bot_username()}
    try:
        heartbeat = float(data.get('last_heartbeat_at') or 0)
    except (TypeError, ValueError):
        heartbeat = 0
    awake = bool(data.get('active')) and time.time() - heartbeat <= MAI_STALE_SECONDS
    # a locked mood wins over the rolled one, same as Mai
    mood = str(data.get('locked_mood') or data.get('active_mood') or 'neutral').strip().lower()
    return {'awake': awake, 'mood': mood, 'botUsername': mai_bot_username()}


# ── SESSION: tonight's tally for the ending screen ──
# The layout reports follows, subs, cheers, raids and first chatters as they happen.
# A new Twitch stream (different started_at) starts a fresh tally automatically.
MAX_SEEN_IDS = 1000   # remembered chat event ids, so a second copy of the layout can't double-count
MAX_NAMES = 50


def new_session(stream_start=None):
    return {
        'streamStart': stream_start,
        'followerStart': None,
        'followerNow': None,
        'followers': [],
        'subs': [],
        'bits': 0,
        'bitsBy': [],
        'raids': [],
        'firstChatters': [],
        'seen': [],
    }


def read_session():
    data = read_json_file(SESSION_FILE)
    if not isinstance(data, dict):
        return new_session()
    session = new_session()
    session.update(data)
    return session


def remember(names, name):
    if name and name not in names:
        names.append(name)
        del names[:-MAX_NAMES]


def apply_event(session, event):
    stream_start = event.get('streamStart')
    if stream_start and stream_start != session.get('streamStart'):
        session = new_session(stream_start)

    event_id = event.get('id')
    if event_id:
        if event_id in session['seen']:
            return session
        session['seen'].append(event_id)
        del session['seen'][:-MAX_SEEN_IDS]

    kind = event.get('type')
    name = str(event.get('name') or '').strip()[:40]
    try:
        amount = max(0, int(event.get('amount') or 0))
    except (TypeError, ValueError):
        amount = 0

    if kind == 'followerTotal':
        if session['followerStart'] is None:
            session['followerStart'] = amount
        session['followerNow'] = amount
    elif kind == 'follow':
        remember(session['followers'], name)
    elif kind == 'sub':
        session['subs'].append(name)
        del session['subs'][:-MAX_NAMES * 4]
    elif kind == 'bits':
        session['bits'] += amount
        session['bitsBy'].append(name)
        del session['bitsBy'][:-MAX_NAMES]
    elif kind == 'raid':
        session['raids'].append({'name': name, 'viewers': amount})
    elif kind == 'firstChat':
        remember(session['firstChatters'], name)
    elif kind == 'reset':
        session = new_session(session.get('streamStart'))
    return session


def session_summary(session):
    start, now = session.get('followerStart'), session.get('followerNow')
    return {
        'streamStart': session.get('streamStart'),
        'newFollowers': max(0, (now or 0) - (start or 0)) if start is not None else len(session['followers']),
        'followerNames': session['followers'][-5:],
        'subs': len(session['subs']),
        'subNames': list(dict.fromkeys(reversed(session['subs'])))[:5],
        'bits': session['bits'],
        'raids': session['raids'][-5:],
        'firstChatters': len(session['firstChatters']),
    }


# ── TEST MODE: fake events fired from the panel's Test page ──
# Kept in memory only, never saved, never counted in the recap. The layout polls /api/test.
TEST_TYPES = {'raid', 'follow', 'familiar', 'firstChat', 'god', 'mai', 'numbers'}
TEST_BOOT = secrets.token_hex(4)   # changes on restart, so the layout knows ids started over
TEST_EVENTS = []
TEST_LOCK = threading.Lock()
test_next_id = 0


def add_test_event(kind):
    global test_next_id
    with TEST_LOCK:
        test_next_id += 1
        TEST_EVENTS.append({'id': test_next_id, 'type': kind, 'at': time.time()})
        del TEST_EVENTS[:-20]
        return test_next_id


def test_events():
    with TEST_LOCK:
        return {'boot': TEST_BOOT, 'last': test_next_id, 'events': list(TEST_EVENTS)}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        # checked on the real file path, so tricks like /%64ata/ or /js/../data/ can't reach private folders
        target = os.path.normcase(os.path.realpath(super().translate_path(path)))
        for private in PRIVATE_DIRS:
            base = os.path.normcase(os.path.realpath(private))
            if target == base or target.startswith(base + os.sep):
                return os.path.join(str(ROOT), '__not_served__')
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def blocked_cross_site(self):
        # stops other websites open in your browser from reading twitch-config.js
        # or rewriting what's on stream
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.send_error(403)
            return True
        return False

    def do_GET(self):
        if self.blocked_cross_site():
            return
        if self.path in ('/', '/panel'):
            self.send_response(302)
            self.send_header('Location', '/panel.html')
            self.end_headers()
            return
        if self.path == '/api/state':
            self.send_json(200, read_state())
            return
        if self.path == '/api/session':
            self.send_json(200, session_summary(read_session()))
            return
        if self.path == '/api/mai':
            self.send_json(200, read_mai_mood())
            return
        if self.path == '/api/test':
            self.send_json(200, test_events())
            return
        if self.path == '/api/mai/moods':
            self.send_json(200, read_mai_moods())
            return
        super().do_GET()

    def read_json_body(self):
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.send_error(415)
            return None
        length = int(self.headers.get('Content-Length', 0))
        if length > MAX_BODY:
            self.send_error(413)
            return None
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            self.send_error(400, 'Invalid JSON')
            return None
        if not isinstance(body, dict):
            self.send_error(400, 'Expected a JSON object')
            return None
        return body

    def do_POST(self):
        if self.blocked_cross_site():
            return
        if self.path == '/api/state':
            update = self.read_json_body()
            if update is None:
                return
            # each top-level section (rotator, startingSoon, ...) is replaced independently
            with FILE_LOCK:
                state = read_state()
                state.update(update)
                write_json_file(STATE_FILE, state)
            self.send_json(200, state)
            return
        if self.path == '/api/test':
            body = self.read_json_body()
            if body is None:
                return
            if body.get('type') not in TEST_TYPES:
                self.send_error(400, 'Unknown test event')
                return
            self.send_json(200, {'id': add_test_event(body['type'])})
            return
        if self.path == '/api/counter':
            # {"delta": 1} / {"delta": -1} / {"set": 0} — done here in one step so fast clicking never loses a count
            change = self.read_json_body()
            if change is None:
                return
            with FILE_LOCK:
                state = read_state()
                counter = dict(state.get('fanslyCounter') or {})
                try:
                    value = int(counter.get('value') or 0)
                    if 'set' in change:
                        value = int(change['set'])
                    else:
                        value += int(change.get('delta') or 0)
                except (TypeError, ValueError):
                    self.send_error(400, 'Expected a number')
                    return
                counter['value'] = value
                state['fanslyCounter'] = counter
                write_json_file(STATE_FILE, state)
            self.send_json(200, counter)
            return
        if self.path == '/api/session/event':
            event = self.read_json_body()
            if event is None:
                return
            with FILE_LOCK:
                session = apply_event(read_session(), event)
                write_json_file(SESSION_FILE, session)
            self.send_json(200, session_summary(session))
            return
        self.send_error(404)

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # overlays poll and report every few seconds; don't flood the console with it
        if self.path in ('/api/state', '/api/mai', '/api/session', '/api/session/event', '/api/counter', '/api/test'):
            return
        super().log_message(fmt, *args)


class CryptServer(ThreadingHTTPServer):
    # on Windows, address reuse lets a second copy share the port and serve stale code
    allow_reuse_address = os.name != 'nt'


if __name__ == '__main__':
    try:
        server = CryptServer((HOST, PORT), Handler)
    except OSError:
        print(f'Port {PORT} is already in use: the Crypt server is probably already running.')
        print('Close the other server window first, then start this one again.')
        raise SystemExit(1)
    print('The Crypt control server running')
    print(f'  Panel:   http://localhost:{PORT}/panel.html')
    print(f'  Layout:  http://localhost:{PORT}/layout.html')
    print(f'  Starting soon: http://localhost:{PORT}/starting-soon.html')
    print(f'  Ending:  http://localhost:{PORT}/ending.html')
    print('  Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
