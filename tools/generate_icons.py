"""
PWA 아이콘 생성기 (icon-192.png, icon-512.png).
브랜드 그라데이션 + "A" 글자 + 동심원 디테일.
실행:
    python3 tools/generate_icons.py
결과:
    icons/icon-192.png, icons/icon-512.png
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

ICON_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(ICON_DIR, exist_ok=True)


def make_icon(size):
    img = Image.new("RGB", (size, size), (8, 6, 26))
    draw = ImageDraw.Draw(img)

    # 그라데이션 배경 (방사형 흉내 — 동심원 페인트)
    cx = size * 0.32
    cy = size * 0.28
    max_r = size * 0.95
    for r in range(int(max_r), 0, -2):
        t = 1 - r / max_r
        # 보라 → 파랑 → 다크
        if t < 0.4:
            color = blend((124, 77, 255), (59, 130, 246), t / 0.4)
        else:
            color = blend((59, 130, 246), (8, 6, 26), (t - 0.4) / 0.6)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    # 동심원 디테일
    inner_cx, inner_cy = size / 2, size / 2
    for i in range(4):
        rr = size * (0.30 + i * 0.05)
        draw.ellipse(
            [inner_cx - rr, inner_cy - rr, inner_cx + rr, inner_cy + rr],
            outline=(255, 255, 255, 60), width=max(1, size // 256)
        )

    # 큰 "A"
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if os.path.exists(font_path):
        font = ImageFont.truetype(font_path, int(size * 0.55))
    else:
        font = ImageFont.load_default()
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.04),
        text, font=font, fill=(245, 240, 255)
    )

    return img


def blend(c1, c2, t):
    return tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))


for s in (192, 512):
    img = make_icon(s)
    out = os.path.join(ICON_DIR, f"icon-{s}.png")
    img.save(out, "PNG", optimize=True)
    print(f"Generated: {out} ({os.path.getsize(out) / 1024:.1f} KB, {s}x{s})")
