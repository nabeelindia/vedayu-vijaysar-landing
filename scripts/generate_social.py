"""
Generate Vedayu Facebook Page assets:
  - profile_photo.png  400×400  (displays as circle)
  - cover_photo.jpg    820×312  (Facebook cover)
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

OUT = "/Users/nabeel/Downloads/vedayu-vercel/public/ads"
IMGS = "/Users/nabeel/Downloads/vedayu-vercel/public/images"
os.makedirs(OUT, exist_ok=True)

# ── Brand colours ──────────────────────────────────────────────────────────
DARK_BROWN  = (92,  61, 30)
MID_BROWN   = (139, 90, 43)
GOLD        = (201, 168, 76)
CREAM       = (255, 248, 235)
WHITE       = (255, 255, 255)
LIGHT_BROWN = (212, 184, 150)

# ── Fonts ───────────────────────────────────────────────────────────────────
def font(path, size):
    return ImageFont.truetype(path, size)

HELVETICA     = "/System/Library/Fonts/Helvetica.ttc"
HELVETICA_NEW = "/System/Library/Fonts/HelveticaNeue.ttc"
PALATINO      = "/System/Library/Fonts/Palatino.ttc"
BODONI_BOLD   = "/Library/Fonts/Bodoni Bd BT Bold.ttf"
BODONI_BOOK   = "/Library/Fonts/Bodoni Bk BT Book.ttf"

# ═══════════════════════════════════════════════════════════════════════════
# PROFILE PHOTO  400 × 400
# ═══════════════════════════════════════════════════════════════════════════
def make_profile():
    W, H = 400, 400
    img  = Image.new("RGB", (W, H), DARK_BROWN)
    draw = ImageDraw.Draw(img)

    # ── Gold ring border ──────────────────────────────────────────────────
    for r in range(3):
        draw.ellipse([10+r, 10+r, W-10-r, H-10-r], outline=GOLD, width=1)

    # ── Paste product image (circular crop) in centre ─────────────────────
    product = Image.open(f"{IMGS}/product.jpg").convert("RGBA")
    # crop to circle, then resize
    p_size  = 220
    product = product.resize((p_size, p_size), Image.LANCZOS)
    mask    = Image.new("L", (p_size, p_size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, p_size, p_size], fill=255)

    # Soften edges
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    product.putalpha(mask)

    offset = ((W - p_size) // 2, (H - p_size) // 2 - 28)
    img.paste(product, offset, product)

    # ── "VEDAYU" wordmark ─────────────────────────────────────────────────
    try:
        f_brand = font(BODONI_BOLD, 52)
    except:
        f_brand = font(PALATINO, 52)

    brand_text = "VEDAYU"
    bb = draw.textbbox((0, 0), brand_text, font=f_brand)
    tw = bb[2] - bb[0]
    tx = (W - tw) // 2
    ty = offset[1] + p_size + 14

    # Gold shadow
    draw.text((tx+2, ty+2), brand_text, font=f_brand, fill=(150, 120, 40))
    draw.text((tx, ty), brand_text, font=f_brand, fill=GOLD)

    # ── Tagline ───────────────────────────────────────────────────────────
    try:
        f_tag = font(HELVETICA_NEW, 15)
    except:
        f_tag = font(HELVETICA, 15)

    tag = "Ayurvedic Wellness"
    bb2 = draw.textbbox((0, 0), tag, font=f_tag)
    draw.text(((W - (bb2[2]-bb2[0])) // 2, ty + 56), tag, font=f_tag, fill=LIGHT_BROWN)

    # ── Thin gold line above brand name ───────────────────────────────────
    lx = (W - 160) // 2
    draw.line([(lx, ty - 10), (lx + 160, ty - 10)], fill=GOLD, width=1)

    out_path = f"{OUT}/profile_photo.png"
    img.save(out_path, "PNG")
    print(f"✓ Profile photo saved → {out_path}")


# ═══════════════════════════════════════════════════════════════════════════
# COVER PHOTO  820 × 312
# ═══════════════════════════════════════════════════════════════════════════
def make_cover():
    W, H = 820, 312
    img  = Image.new("RGB", (W, H), DARK_BROWN)
    draw = ImageDraw.Draw(img)

    # ── Left: warm gradient panel ─────────────────────────────────────────
    for x in range(W // 2):
        t = x / (W // 2)
        r = int(DARK_BROWN[0] + (MID_BROWN[0] - DARK_BROWN[0]) * t * 0.4)
        g = int(DARK_BROWN[1] + (MID_BROWN[1] - DARK_BROWN[1]) * t * 0.4)
        b = int(DARK_BROWN[2] + (MID_BROWN[2] - DARK_BROWN[2]) * t * 0.4)
        draw.line([(x, 0), (x, H)], fill=(r, g, b))

    # ── Gold top & bottom border lines ────────────────────────────────────
    for y_line, thickness in [(0, 4), (H-4, 4)]:
        draw.rectangle([0, y_line, W, y_line + thickness], fill=GOLD)

    # ── Right side: product image ─────────────────────────────────────────
    product = Image.open(f"{IMGS}/product.jpg").convert("RGBA")
    ph = int(H * 1.05)   # slightly taller than cover
    pw = ph
    product = product.resize((pw, ph), Image.LANCZOS)

    # Fade left edge of product image into background
    fade_mask = Image.new("L", (pw, ph), 255)
    fade_draw = ImageDraw.Draw(fade_mask)
    fade_w    = pw // 3
    for fx in range(fade_w):
        alpha = int(255 * (fx / fade_w) ** 1.6)
        fade_draw.line([(fx, 0), (fx, ph)], fill=alpha)
    product.putalpha(fade_mask)

    px = W - pw + 40
    py = (H - ph) // 2
    img.paste(product, (px, py), product)

    # ── Vertical gold divider ─────────────────────────────────────────────
    div_x = W // 2 - 10
    draw.line([(div_x, 24), (div_x, H - 24)], fill=GOLD, width=1)

    # ── Left text block ───────────────────────────────────────────────────
    pad = 48

    # Brand name
    try:
        f_brand = font(BODONI_BOLD, 58)
    except:
        f_brand = font(PALATINO, 58)

    brand_y = 46
    draw.text((pad + 2, brand_y + 2), "VEDAYU", font=f_brand, fill=(80, 50, 10))
    draw.text((pad, brand_y), "VEDAYU", font=f_brand, fill=WHITE)

    # Gold underline under brand name
    bb = draw.textbbox((pad, brand_y), "VEDAYU", font=f_brand)
    draw.line([(pad, bb[3] + 6), (pad + 180, bb[3] + 6)], fill=GOLD, width=2)

    # Tagline
    try:
        f_tag = font(HELVETICA_NEW, 17)
    except:
        f_tag = font(HELVETICA, 17)

    tag_y = brand_y + 80
    draw.text((pad, tag_y), "Vijaysar Wooden Glass", font=f_tag, fill=GOLD)

    # Sub-tagline
    try:
        f_sub = font(HELVETICA_NEW, 13)
    except:
        f_sub = font(HELVETICA, 13)

    draw.text((pad, tag_y + 28), "Natural Ayurvedic Wellness", font=f_sub, fill=LIGHT_BROWN)

    # Bullet points
    bullets = ["✦  Free Delivery All India", "✦  COD Available", "✦  Starting ₹499"]
    bul_y   = tag_y + 62
    try:
        f_bul = font(HELVETICA_NEW, 13)
    except:
        f_bul = font(HELVETICA, 13)

    for b in bullets:
        draw.text((pad, bul_y), b, font=f_bul, fill=CREAM)
        bul_y += 22

    # Website URL at bottom
    try:
        f_url = font(HELVETICA_NEW, 12)
    except:
        f_url = font(HELVETICA, 12)

    draw.text((pad, H - 30), "vedayulife.com", font=f_url, fill=GOLD)

    out_path = f"{OUT}/cover_photo.jpg"
    img.save(out_path, "JPEG", quality=95)
    print(f"✓ Cover photo saved  → {out_path}")


if __name__ == "__main__":
    make_profile()
    make_cover()
    print("\nDone! Files in public/ads/")
