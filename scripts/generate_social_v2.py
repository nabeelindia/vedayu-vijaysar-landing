"""
Vedayu — Premium Facebook Page Assets v2
  profile_photo.png  400×400
  cover_photo.jpg    820×312
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import os, math

OUT  = "/Users/nabeel/Downloads/vedayu-vercel/public/ads"
IMGS = "/Users/nabeel/Downloads/vedayu-vercel/public/images"
os.makedirs(OUT, exist_ok=True)

# ── Palette ────────────────────────────────────────────────────────────────
OBSIDIAN    = (18,  12,  6)
DARK_BROWN  = (40,  24,  10)
RICH_BROWN  = (72,  45,  18)
GOLD        = (212, 175, 90)
GOLD_LIGHT  = (240, 210, 130)
GOLD_DARK   = (160, 120, 40)
CREAM       = (255, 248, 228)
WARM_WHITE  = (250, 244, 232)
WARM_GREY   = (180, 160, 130)

BODONI_BOLD = "/Library/Fonts/Bodoni Bd BT Bold.ttf"
BODONI_BOOK = "/Library/Fonts/Bodoni Bk BT Book.ttf"
HELVETICA   = "/System/Library/Fonts/HelveticaNeue.ttc"
PALATINO    = "/System/Library/Fonts/Palatino.ttc"

def F(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.truetype(PALATINO, size)

def centered_x(draw, text, font, canvas_w, offset=0):
    bb = draw.textbbox((0, 0), text, font=font)
    return (canvas_w - (bb[2] - bb[0])) // 2 + offset

def add_noise(img, strength=6):
    """Subtle grain for premium texture"""
    import random
    px = img.load()
    w, h = img.size
    for _ in range(w * h // 12):
        x, y = random.randint(0, w-1), random.randint(0, h-1)
        r, g, b = px[x, y]
        n = random.randint(-strength, strength)
        px[x, y] = (max(0,min(255,r+n)), max(0,min(255,g+n)), max(0,min(255,b+n)))
    return img

def draw_gold_text(draw, pos, text, font, shadow=True):
    """Multi-layer gold text with depth"""
    x, y = pos
    if shadow:
        draw.text((x+3, y+3), text, font=font, fill=(60, 38, 8))
        draw.text((x+1, y+1), text, font=font, fill=GOLD_DARK)
    draw.text((x, y), text, font=font, fill=GOLD)
    # Highlight pass — simulate foil
    draw.text((x-1, y-1), text, font=font, fill=GOLD_LIGHT)

def thin_ellipse(draw, box, color, gap=2):
    """Draw stacked thin ellipses for a refined ring"""
    x0, y0, x1, y1 = box
    draw.ellipse([x0,    y0,    x1,    y1   ], outline=color, width=1)
    draw.ellipse([x0+gap, y0+gap, x1-gap, y1-gap], outline=(*color, 80), width=1)


# ═══════════════════════════════════════════════════════════════════════════
# PROFILE PHOTO  400 × 400
# Concept: Obsidian circle, centred "V" monogram in Bodoni gold,
#          fine double-ring border, discreet "VEDAYU" wordmark below
# ═══════════════════════════════════════════════════════════════════════════
def make_profile():
    W, H = 400, 400
    img  = Image.new("RGB", (W, H), OBSIDIAN)
    draw = ImageDraw.Draw(img)

    # ── Radial warm vignette from centre ──────────────────────────────────
    cx, cy = W // 2, H // 2
    for r in range(min(W, H) // 2, 0, -1):
        t = r / (min(W, H) // 2)
        # warm centre, dark edges
        col = tuple(int(OBSIDIAN[i] + (RICH_BROWN[i] - OBSIDIAN[i]) * (1 - t) ** 2) for i in range(3))
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=col)

    # ── Outer double-ring ──────────────────────────────────────────────────
    thin_ellipse(draw, [14, 14, W-14, H-14], GOLD, gap=5)

    # ── Subtle inner circle (lighter) ─────────────────────────────────────
    draw.ellipse([28, 28, W-28, H-28], outline=(*GOLD_DARK, 60), width=1)

    # ── Product image in upper half, soft vignetted circle ────────────────
    product = Image.open(f"{IMGS}/product.jpg").convert("RGBA")
    ps = 190
    product = product.resize((ps, ps), Image.LANCZOS)

    # Build soft circular mask
    mask = Image.new("L", (ps, ps), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse([0, 0, ps, ps], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))

    # Vignette the product edges further
    vign = Image.new("L", (ps, ps), 0)
    for rad in range(ps // 2, 0, -1):
        t   = rad / (ps // 2)
        val = int(255 * min(1, t * 1.3))
        ImageDraw.Draw(vign).ellipse([ps//2 - rad, ps//2 - rad,
                                      ps//2 + rad, ps//2 + rad], fill=val)
    # combine masks
    import PIL.ImageChops as IC
    combined = IC.multiply(mask, vign)
    product.putalpha(combined)

    px_off = (W - ps) // 2
    py_off = 68
    img.paste(product, (px_off, py_off), product)

    # ── Thin gold separator line ───────────────────────────────────────────
    line_y = py_off + ps + 18
    lx0    = (W - 120) // 2
    draw.line([(lx0, line_y), (lx0 + 120, line_y)], fill=GOLD, width=1)
    # dots at ends
    for dot_x in [lx0 - 6, lx0 + 126]:
        draw.ellipse([dot_x-2, line_y-2, dot_x+2, line_y+2], fill=GOLD)

    # ── VEDAYU monogram ────────────────────────────────────────────────────
    f_brand = F(BODONI_BOLD, 44)
    brand   = "VEDAYU"
    bx      = centered_x(draw, brand, f_brand, W)
    by      = line_y + 14
    draw_gold_text(draw, (bx, by), brand, f_brand)

    # ── Tagline ───────────────────────────────────────────────────────────
    f_tag  = F(HELVETICA, 13)
    tag    = "AYURVEDIC  WELLNESS"
    tx     = centered_x(draw, tag, f_tag, W)
    draw.text((tx, by + 52), tag, font=f_tag, fill=WARM_GREY)

    img = add_noise(img, 5)
    img.save(f"{OUT}/profile_photo.png", "PNG")
    print("✓ profile_photo.png")


# ═══════════════════════════════════════════════════════════════════════════
# COVER PHOTO  820 × 312
# Concept: Full-bleed lifestyle photo, dark gradient overlay on left 55%,
#          elegant left-aligned typography, minimal gold accents
# ═══════════════════════════════════════════════════════════════════════════
def make_cover():
    W, H = 820, 312

    # ── Base: lifestyle photo, cropped & positioned right ─────────────────
    bg = Image.open(f"{IMGS}/lifestyle.jpg").convert("RGB")
    # Crop to cover ratio (landscape) — use centre-right crop
    bw, bh   = bg.size
    target_r = W / H
    if bw / bh > target_r:
        new_w = int(bh * target_r)
        left  = (bw - new_w) // 2 + new_w // 6   # shift slightly right
        bg    = bg.crop((left, 0, left + new_w, bh))
    else:
        new_h = int(bw / target_r)
        top   = (bh - new_h) // 4
        bg    = bg.crop((0, top, bw, top + new_h))

    bg = bg.resize((W, H), Image.LANCZOS)

    # Darken slightly for legibility
    bg = ImageEnhance.Brightness(bg).enhance(0.65)
    bg = ImageEnhance.Contrast(bg).enhance(1.1)

    img  = bg.copy()
    draw = ImageDraw.Draw(img)

    # ── Gradient overlay: dark on left, transparent on right ──────────────
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ovd     = ImageDraw.Draw(overlay)
    fade_w  = int(W * 0.72)
    for x in range(fade_w):
        t     = x / fade_w
        # cubic ease-out: strong dark on left, fully transparent by 72%
        alpha = int(235 * (1 - t ** 1.7))
        ovd.line([(x, 0), (x, H)], fill=(DARK_BROWN[0], DARK_BROWN[1], DARK_BROWN[2], alpha))

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # ── Gold top & bottom rule ─────────────────────────────────────────────
    draw.rectangle([0, 0,  W, 3],    fill=GOLD)
    draw.rectangle([0, H-3, W, H],   fill=GOLD)

    # ── Left text block ────────────────────────────────────────────────────
    pad = 52

    # "VEDAYU" — large Bodoni
    f_main = F(BODONI_BOLD, 68)
    my     = 38
    draw_gold_text(draw, (pad, my), "VEDAYU", f_main)

    # Underline below brand
    bb  = draw.textbbox((pad, my), "VEDAYU", font=f_main)
    lx1 = pad
    lx2 = pad + 220
    ly  = bb[3] + 8
    draw.line([(lx1, ly), (lx2, ly)], fill=GOLD, width=1)
    # end dot
    draw.ellipse([lx2+4, ly-3, lx2+10, ly+3], fill=GOLD)

    # Product subtitle
    f_sub1 = F(BODONI_BOOK, 19)
    draw.text((pad, ly + 14), "Vijaysar Wooden Glass", font=f_sub1, fill=CREAM)

    # Descriptor
    f_desc = F(HELVETICA, 12)
    draw.text((pad, ly + 44), "Natural · Ayurvedic · Handcrafted", font=f_desc, fill=WARM_GREY)

    # 3 USP pills
    f_pill = F(HELVETICA, 11)
    pills  = ["Free Delivery", "COD Available", "From ₹499"]
    pill_x = pad
    pill_y = ly + 76
    for pill in pills:
        bb2  = draw.textbbox((0, 0), pill, font=f_pill)
        pw   = (bb2[2] - bb2[0]) + 22
        ph   = 22
        draw.rounded_rectangle([pill_x, pill_y, pill_x+pw, pill_y+ph],
                                radius=11, outline=GOLD, width=1)
        draw.text((pill_x + 11, pill_y + 4), pill, font=f_pill, fill=GOLD)
        pill_x += pw + 10

    # Website
    f_url = F(HELVETICA, 11)
    draw.text((pad, H - 26), "vedayulife.com", font=f_url, fill=(*GOLD, ))

    img = add_noise(img, 4)
    img.save(f"{OUT}/cover_photo.jpg", "JPEG", quality=96)
    print("✓ cover_photo.jpg")


if __name__ == "__main__":
    make_profile()
    make_cover()
    print("\nDone → public/ads/")
