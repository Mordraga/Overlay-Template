"""Render stinger.html to transparent .webm files for OBS's Stinger transition.

    python stinger/render.py            # every style
    python stinger/render.py breach     # just one

Writes stinger/out/<style>.webm and prints the transition point to type into OBS.
Needs once:  pip install --user playwright imageio-ffmpeg pillow
             python -m playwright install chromium
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
FPS = 60


def check_covered(png, style, cover):
    """The frame OBS cuts on must be fully opaque, or the scene swap shows through."""
    try:
        from PIL import Image
    except ImportError:
        return
    img = Image.open(png)
    if 'A' not in img.getbands():
        return  # Chromium drops the alpha channel when nothing is see-through
    lowest = img.getchannel('A').getextrema()[0]
    if lowest < 255:
        print(f'  WARNING: {style} is not fully covered at {cover} ms (min alpha {lowest}) - the cut will show')


def render(page, style, ffmpeg):
    page.goto((HERE / 'stinger.html').as_uri() + f'?style={style}&render')
    info = page.evaluate('stinger.ready')
    frames = round(info['duration'] * FPS / 1000)
    cover_frame = round(info['cover'] * FPS / 1000)
    out = OUT / f'{style}.webm'
    print(f'{style}: {frames} frames...', flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        for i in range(frames):
            page.evaluate('t => stinger.seek(t)', i * 1000 / FPS)
            png = f'{tmp}/f{i:04d}.png'
            page.screenshot(path=png, omit_background=True)
            if i == cover_frame:
                check_covered(png, style, info['cover'])

        # VP9 + yuva420p keeps the alpha channel; OBS plays it as-is
        subprocess.run([
            ffmpeg, '-y', '-loglevel', 'error',
            '-framerate', str(FPS), '-i', f'{tmp}/f%04d.png',
            '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
            '-b:v', '0', '-crf', '18', '-row-mt', '1', '-auto-alt-ref', '0',
            str(out),
        ], check=True)

    print(f'  -> {out}  (OBS transition point: {info["cover"]} ms)')


def main():
    OUT.mkdir(exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        page.goto((HERE / 'stinger.html').as_uri() + '?render')
        styles = sys.argv[1:] or page.evaluate('stinger.styles')
        for style in styles:
            render(page, style, ffmpeg)
        browser.close()


if __name__ == '__main__':
    main()
