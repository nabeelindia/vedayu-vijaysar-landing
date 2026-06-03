"""
Vedayu — Minimalist Facebook Page Assets v3
Light cream palette, lots of whitespace, clean Bodoni typography
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import os

OUT  = "/Users/nabeel/Downloads/vedayu-vercel/public/ads"
IMGS = "/Users/nabeel/Downloads/vedayu-vercel/public/images"
os.makedirs(OUT, exist_ok=True)

# ── Palette ────────────────────────────────────────────────────────────────
CREAM       = (252, 248, 240)
WARM_WHITE  = (255, 253, 248)
DARK_BROWN  = (58,  34,  12)
MID_BROWN   = (110, 70,  28)
GOLD        = (185, 145, 60)
GOLD_LIGHT  = (210, 175, 95)
WARM_GREY   = (160, 140, 115)
LIGHT_LINE  = (220, 205, 180)

BODONI_BOLD = "/Library/Fonts/Bodoni Bd BT Bold.ttf"
BODONI_BOOK = "/Library/Fonts/Bodoni Bk BT Book.ttf"
HELVETICA   = "/System/Library/Fonts/HelveticaNeue.ttc"
PALATINO    = "/System/Library/Fonts/Palatino.ttc"

def F(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.truetype(PALATINO, size)

def cx(draw, text, font, W):
    bb = draw.textbbox((0, 0), text, font=font)
    return (W - (bb[2] - bb[0])) // 2


# ═══════════════════════════════════════════════════════════════════════════
# PROFILE PHOTO  400 × 400
# Cream background · product centred · "VEDAYU" in dark brown below
# ═══════════════════════════════════════════════════════════════════════════
def make_profile():
    W, H = 400, 400
    img  = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # ── Single thin gold circle border ────────────────────────────────────
    draw.ellipse([12, 12, W-12, H-12], outline=GOLD, width=1)

    # ── Product image, clean circle, no vignette ──────────────────────────
    product = Image.open(f"{IMGS}/product.jpg").convert("RGBA")
    ps      = 200
    product = product.resize((ps, ps), Image.LANCZOS)

    # Clean circular crop
    mask = Image.new("L", (ps, ps), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, ps, ps], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    product.putalpha(mask)

    px_off = (W - ps) // 2
    py_off = 70
    img.paste(product, (px_off, py_off), product)

    # ── Thin gold hairline ─────────────────────────────────────────────────
    line_y = py_off + ps + 22
    lw     = 80
    lx     = (W - lw) // 2
    draw.line([(lx, line_y), (lx + lw, line_y)], fill=GOLD, width=1)

    # ── VEDAYU wordmark ───────────────────────────────────────────────────
    f_brand = F(BODONI_BOLD, 40)
    by      = line_y + 16
    bx      = cx(draw, "VEDAYU", f_brand, W)
    draw.text((bx, by), "VEDAYU", font=f_brand, fill=DARK_BROWN)

    # ── Tagline ────────────────────────────────────────────────────────────
    f_tag  = F(HELVETICA, 11)
    tag    = "A Y U R V E D I C   W E L L N E S S"
    draw.text((cx(draw, tag, f_tag, W), by + 48), tag, font=f_tag, fill=WARM_GREY)

    img.save(f"{OUT}/profile_photo.png", "PNG")
    print("✓ profile_photo.png")


# ═══════════════════════════════════════════════════════════════════════════
# COVER PHOTO  820 × 312
# Cream background · product right · minimal left text · gold accents only
# ═══════════════════════════════════════════════════════════════════════════
def make_cover():
    W, H = 820, 312
    img  = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # ── Very subtle warm gradient — barely visible ─────────────────────────
    for x in range(W):
        t   = x / W
        col = tuple(int(CREAM[i] + (WARM_WHITE[i] - CREAM[i]) * t) for i in range(3))
        draw.line([(x, 0), (x, H)], fill=col)

    # ── Thin top & bottom gold rule ────────────────────────────────────────
    draw.rectangle([0, 0,  W, 2], fill=GOLD)
    draw.rectangle([0, H-2, W, H], fill=GOLD)

    # ── Product image — right side, clean, slightly oversized ─────────────
    product = Image.open(f"{IMGS}/product.jpg").convert("RGBA")
    ps      = 290
    product = product.resize((ps, ps), Image.LANCZOS)

    # Soft fade on left edge only
    fade = Image.new("L", (ps, ps), 255)
    fw   = 90
    for fx in range(fw):
        alpha = int(255 * (fx / fw) ** 2.2)
        ImageDraw.Draw(fade).line([(fx, 0), (fx, ps)], fill=alpha)
    product.putalpha(fade)

    px = W - ps - 30
    py = (H - ps) // 2 + 4
    img.paste(product, (px, py), product)

    # ── Thin vertical divider ──────────────────────────────────────────────
    div_x = W // 2 + 20
    draw.line([(div_x, 36), (div_x, H - 36)], fill=LIGHT_LINE, width=1)

    # ── Left text block ────────────────────────────────────────────────────
    pad = 52

    # Eyebrow — small spaced caps
    f_eye = F(HELVETICA, 10)
    eye   = "A Y U R V E D I C   W E L L N E S S"
    draw.text((pad, 46), eye, font=f_eye, fill=WARM_GREY)

    # VEDAYU — large, dark brown
    f_main = F(BODONI_BOLD, 72)
    draw.text((pad, 62), "VEDAYU", font=f_main, fill=DARK_BROWN)

    # Gold underline — short, refined
    bb  = draw.textbbox((pad, 62), "VEDAYU", font=f_main)
    draw.line([(pad, bb[3] + 6), (pad + 100, bb[3] + 6)], fill=GOLD, width=1)

    # Product name
    f_prod = F(BODONI_BOOK, 18)
    prod_y = bb[3] + 20
    draw.text((pad, prod_y), "Vijaysar Wooden Glass", font=f_prod, fill=MID_BROWN)

    # Three USPs — clean, spaced
    f_usp  = F(HELVETICA, 11)
    usps   = ["Free Delivery  ·  COD Available  ·  From ₹499"]
    usp_y  = prod_y + 34
    draw.text((pad, usp_y), usps[0], font=f_usp, fill=WARM_GREY)

    # Website — very light, bottom left
    f_url = F(HELVETICA, 10)
    draw.text((pad, H - 26), "vedayulife.com", font=f_url, fill=GOLD)

    img.save(f"{OUT}/cover_photo.jpg", "JPEG", quality=96)
    print("✓ cover_photo.jpg")


if __name__ == "__main__":
    make_profile()
    make_cover()
    print("\nDone → public/ads/")
