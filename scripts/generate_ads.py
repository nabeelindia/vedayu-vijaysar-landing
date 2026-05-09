"""
Vedayu — Facebook / Instagram Ad Creative Generator
Produces 4 × 1080×1080 PNG images in public/ads/
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import os, math

BASE  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMGS  = os.path.join(BASE, 'public', 'images')
OUT   = os.path.join(BASE, 'public', 'ads')
os.makedirs(OUT, exist_ok=True)

# ── Fonts ─────────────────────────────────────────────────────────────────────
HN       = '/System/Library/Fonts/HelveticaNeue.ttc'
EMOJI_F  = '/System/Library/Fonts/Apple Color Emoji.ttc'

def font(size, bold=False, light=False):
    idx = 4 if bold else (1 if light else 0)
    return ImageFont.truetype(HN, size, index=idx)

_EMOJI_SIZES = [20, 32, 40, 48, 52, 64, 96]
def efont(size):
    # Apple Color Emoji only supports specific pixel sizes — snap to nearest
    nearest = min(_EMOJI_SIZES, key=lambda s: abs(s - size))
    return ImageFont.truetype(EMOJI_F, nearest)

# ── Brand colours ─────────────────────────────────────────────────────────────
BROWN      = (92,  61,  30)
DARK_BROWN = (61,  38,  16)
GOLD       = (201, 168, 76)
GOLD_LIGHT = (232, 201, 122)
GREEN      = (74,  124, 89)
CREAM      = (250, 245, 228)
WHITE      = (255, 255, 255)
TEXT_MUTED = (180, 150, 110)
CARD_BG    = (255, 255, 255)

SIZE = (1080, 1080)

# ── Helpers ───────────────────────────────────────────────────────────────────
def new_canvas(color=DARK_BROWN):
    return Image.new('RGBA', SIZE, (*color, 255))

def gradient_v(canvas, y1, y2, c_top, c_bot, x1=0, x2=1080):
    draw = ImageDraw.Draw(canvas)
    h = y2 - y1
    for i in range(h):
        t = i / max(h-1, 1)
        r = int(c_top[0] + (c_bot[0]-c_top[0])*t)
        g = int(c_top[1] + (c_bot[1]-c_top[1])*t)
        b = int(c_top[2] + (c_bot[2]-c_top[2])*t)
        draw.line([(x1, y1+i),(x2, y1+i)], fill=(r,g,b,255))

def wrap_text(draw, text, x, y, fnt, color, max_w, gap=10):
    words = text.split()
    line, lines = [], []
    for w in words:
        test = ' '.join(line+[w])
        if draw.textlength(test, font=fnt) > max_w and line:
            lines.append(' '.join(line)); line=[w]
        else:
            line.append(w)
    if line: lines.append(' '.join(line))
    for ln in lines:
        draw.text((x, y), ln, font=fnt, fill=color)
        y += draw.textbbox((0,0), ln, font=fnt)[3] + gap
    return y

def paste_product(canvas, fname, size, pos, shadow=True):
    img = Image.open(os.path.join(IMGS, fname)).convert('RGBA').resize(size, Image.LANCZOS)
    if shadow:
        sh = Image.new('RGBA', canvas.size, (0,0,0,0))
        sh.paste(img, pos, img)
        sh = sh.filter(ImageFilter.GaussianBlur(18))
        dark = Image.new('RGBA', canvas.size, (0,0,0,0))
        dark.paste(Image.new('RGBA', size, (0,0,0,80)), pos)
        canvas = Image.alpha_composite(canvas, dark.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(img, pos, img)
    return canvas

def draw_emoji(draw, emoji, x, y, size=48):
    draw.text((x, y), emoji, font=efont(size), embedded_color=True)

def rounded_rect(draw, xy, r, fill, stroke=None, sw=0):
    draw.rounded_rectangle(xy, radius=r, fill=fill,
                            outline=stroke, width=sw)

def draw_pill(draw, text, x, y, fnt, bg, fg, px=22, py=10):
    w = int(draw.textlength(text, font=fnt))
    h = draw.textbbox((0,0), text, font=fnt)[3]
    rounded_rect(draw, [x, y, x+w+px*2, y+h+py*2], r=50, fill=bg)
    draw.text((x+px, y+py), text, font=fnt, fill=fg)
    return w + px*2 + 10

# ══════════════════════════════════════════════════════════════════════════════
# AD 1 — Hero — "Your Morning Just Got Healthier"
# ══════════════════════════════════════════════════════════════════════════════
def make_ad1():
    canvas = new_canvas((38, 22, 8))
    gradient_v(canvas, 0, 1080, (52,32,12), (25,14,4))

    # Warm radial glow (right)
    glow = Image.new('RGBA', SIZE, (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    for r in range(320,0,-1):
        a = int(55*(1-r/320))
        gd.ellipse([700-r,380-r,700+r,380+r], fill=(*GOLD,a))
    canvas = Image.alpha_composite(canvas, glow)

    # Product image
    canvas = paste_product(canvas, 'product.jpg', (430,430), (616,290))

    draw = ImageDraw.Draw(canvas)

    # Top badge
    rounded_rect(draw, [52,52,438,108], r=50, fill=GOLD)
    draw_emoji(draw, '🌿', 68, 58, 40)
    draw.text((118,64), '100% NATURAL AYURVEDA', font=font(28,bold=True), fill=DARK_BROWN)

    # Sub-label
    draw.text((52,138), 'VIJAYSAR WOODEN GLASS', font=font(24,bold=True), fill=GOLD)

    # Headline
    for i, line in enumerate(['Your','Morning','Just Got','Healthier']):
        draw.text((52, 188+i*106), line, font=font(96,bold=True), fill=WHITE)

    # Body
    draw.text((52, 632), 'Fill at night. Drink healing water', font=font(30,light=True), fill=(210,185,150))
    draw.text((52, 672), 'every morning. Feel the difference.', font=font(30,light=True), fill=(210,185,150))

    # Benefit pills
    benefits = ['Blood Sugar','Digestion','Cholesterol','Immunity']
    px, py = 52, 732
    for b in benefits:
        w = draw_pill(draw, b, px, py, font(24,bold=True), (80,55,25,200), GOLD_LIGHT)
        px += w
        if px > 560: px=52; py+=54

    # CTA button
    cta_y = 858
    rounded_rect(draw, [52,cta_y,720,cta_y+74], r=12, fill=GOLD)
    draw.text((78,cta_y+16), 'Shop Now — ₹499 · Free Delivery', font=font(30,bold=True), fill=DARK_BROWN)
    draw_emoji(draw, '🛒', 668, cta_y+16, 36)

    # Bottom strip
    strip = Image.new('RGBA', (1080,68), (0,0,0,160))
    canvas.paste(strip, (0,1012), strip)
    draw2 = ImageDraw.Draw(canvas)
    draw2.text((52,1026), 'vedayulife.com', font=font(22), fill=TEXT_MUTED)
    draw2.text((370,1026), '5,000+ Happy Families', font=font(22,bold=True), fill=GOLD)
    draw_emoji(draw2, '⭐', 342, 1022, 28)
    draw2.text((730,1026), 'COD Available', font=font(22), fill=TEXT_MUTED)

    canvas.convert('RGB').save(os.path.join(OUT,'ad1-hero.jpg'), quality=95)
    print('✅  Ad 1 — Hero saved')

# ══════════════════════════════════════════════════════════════════════════════
# AD 2 — Social Proof / Testimonial
# ══════════════════════════════════════════════════════════════════════════════
def make_ad2():
    canvas = new_canvas(CREAM)
    draw = ImageDraw.Draw(canvas)

    # Header bar
    rounded_rect(draw, [0,0,1080,136], r=0, fill=BROWN)
    draw_emoji(draw, '🪵', 50, 38, 44)
    draw.text((108,42), 'Vedayu', font=font(42,bold=True), fill=GOLD)
    draw.text((108,94), 'Vijaysar Wooden Glass', font=font(24), fill=(200,175,145))
    rounded_rect(draw, [752,38,1030,98], r=50, fill=GREEN)
    draw_emoji(draw, '✅', 764, 45, 36)
    draw.text((808,50), 'Verified Purchase', font=font(26,bold=True), fill=WHITE)

    # Stars row
    draw_emoji(draw, '⭐⭐⭐⭐⭐', 270, 162, 52)
    draw.text((148,236), '5.0 out of 5  ·  Based on 5,000+ verified orders across India',
              font=font(24), fill=BROWN)

    # Quote card
    rounded_rect(draw, [52,292,1028,710], r=24, fill=WHITE, stroke=(212,184,150), sw=2)

    # Opening quote mark
    draw.text((70, 280), '“', font=font(110, bold=True), fill=GOLD)

    quote = ('My fasting sugar dropped from 148 to 112 in just 6 weeks. '
             'I fill the glass every night and drink the water first thing in the morning. '
             "It's become my daily ritual — I've already ordered 2 more for my parents.")
    wrap_text(draw, quote, 90, 342, font(34), (44,28,12), 900, gap=14)

    # Avatar circle
    av = Image.new('RGBA', (90,90), (0,0,0,0))
    av_d = ImageDraw.Draw(av)
    av_d.ellipse([0,0,90,90], fill=BROWN)
    av_d.ellipse([3,3,87,87], fill=GOLD)
    av_d.text((24,18), 'SS', font=font(34,bold=True), fill=DARK_BROWN)
    canvas.paste(av, (88, 608), av)
    draw.text((196,618), 'Sunita Sharma', font=font(30,bold=True), fill=DARK_BROWN)
    draw.text((196,660), 'Jaipur, Rajasthan  ·  Pack of 2  ·  Verified buyer', font=font(22), fill=BROWN)

    # Product + CTA row
    canvas = paste_product(canvas, 'product.jpg', (172,172), (52,750), shadow=False)
    draw2 = ImageDraw.Draw(canvas)
    draw2.text((248,758), 'Try it yourself — risk free', font=font(36,bold=True), fill=DARK_BROWN)
    draw_emoji(draw2, '✅', 900, 758, 36)
    draw2.text((248,810), '7-day replacement guarantee  ·  Free delivery all India',
               font=font(26), fill=BROWN)
    rounded_rect(draw2, [248,862,740,932], r=12, fill=BROWN)
    draw2.text((272,877), 'Order Now — Starting ₹499', font=font(30,bold=True), fill=WHITE)

    # Footer
    draw2.text((330,1040), 'vedayulife.com  ·  Cash on Delivery Available',
               font=font(22), fill=(154,124,90))

    canvas.convert('RGB').save(os.path.join(OUT,'ad2-testimonial.jpg'), quality=95)
    print('✅  Ad 2 — Testimonial saved')

# ══════════════════════════════════════════════════════════════════════════════
# AD 3 — "One Glass. Four Ancient Benefits."
# ══════════════════════════════════════════════════════════════════════════════
def make_ad3():
    canvas = new_canvas((232,245,234))
    gradient_v(canvas, 0, 1080, (235,248,238,255), (245,237,216,255))
    draw = ImageDraw.Draw(canvas)

    # Header
    draw_emoji(draw, '🪵', 50, 46, 30)
    draw.text((92,50), 'VEDAYU  ·  VIJAYSAR WOODEN GLASS',
              font=font(26,bold=True), fill=GREEN)
    draw.text((52,102), 'One Glass.', font=font(88,bold=True), fill=DARK_BROWN)
    draw.text((52,200), 'Four Ancient Benefits.', font=font(88,bold=True), fill=DARK_BROWN)
    draw.text((52,304), 'Used in Ayurveda for 3,000+ years. Backed by modern science.',
              font=font(26), fill=BROWN)

    BENEFITS = [
        ('🩸','Blood Sugar',
         'Vijaysar compounds help regulate glucose metabolism — clinically studied.'),
        ('🌿','Digestion',
         'Alkaline-infused water soothes the gut and improves nutrient absorption.'),
        ('❤️','Cholesterol',
         'Regular use shown to reduce LDL cholesterol in multiple studies.'),
        ('⚖️','Weight Balance',
         'Supports metabolism naturally and helps reduce sugar cravings over time.'),
    ]
    gx = [52, 556]; gy = [364, 700]
    for i,(em,title,desc) in enumerate(BENEFITS):
        x1=gx[i%2]; y1=gy[i//2]; x2=x1+480; y2=y1+302
        rounded_rect(draw,[x1,y1,x2,y2],r=20,fill=WHITE,stroke=(212,184,150),sw=2)
        draw_emoji(draw, em, x1+28, y1+24, 52)
        draw.text((x1+28,y1+96), title, font=font(36,bold=True), fill=DARK_BROWN)
        wrap_text(draw, desc, x1+28, y1+150, font(24), BROWN, 424, gap=8)

    # Bottom CTA bar
    rounded_rect(draw,[0,1004,1080,1080],r=0,fill=BROWN)
    draw.text((52,1020),'Starting ₹499  ·  Free Delivery  ·  Cash on Delivery  ·  7-day Guarantee',
              font=font(26,bold=True),fill=GOLD)
    rounded_rect(draw,[836,1016,1030,1068],r=10,fill=GOLD)
    draw.text((852,1027),'Order Now',font=font(26,bold=True),fill=DARK_BROWN)
    draw_emoji(draw,'🛒',990,1026,28)

    canvas.convert('RGB').save(os.path.join(OUT,'ad3-benefits.jpg'), quality=95)
    print('✅  Ad 3 — Benefits saved')

# ══════════════════════════════════════════════════════════════════════════════
# AD 4 — "How It Works" — Dark premium
# ══════════════════════════════════════════════════════════════════════════════
def make_ad4():
    canvas = new_canvas((28,16,8))
    gradient_v(canvas, 0, 1080, (40,24,10,255), (18,10,4,255))
    draw = ImageDraw.Draw(canvas)

    # Top accent line
    for x in range(1080):
        t = x/1079
        if t<0.5:
            t2=t*2; c=(int(GOLD[0]+(GREEN[0]-GOLD[0])*t2), int(GOLD[1]+(GREEN[1]-GOLD[1])*t2), int(GOLD[2]+(GREEN[2]-GOLD[2])*t2))
        else:
            t2=(t-0.5)*2; c=(int(GREEN[0]+(GOLD[0]-GREEN[0])*t2), int(GREEN[1]+(GOLD[1]-GREEN[1])*t2), int(GREEN[2]+(GOLD[2]-GREEN[2])*t2))
        draw.line([(x,0),(x,7)], fill=(*c,255))

    # Header
    draw_emoji(draw, '🪵', 50, 36, 38)
    draw.text((102,42), 'VEDAYU', font=font(30,bold=True), fill=GOLD)
    draw.text((52,92),  'How to Use Your', font=font(64,bold=True), fill=WHITE)
    draw.text((52,166), 'Vijaysar Glass', font=font(64,bold=True), fill=GOLD)

    # Product top-right
    canvas = paste_product(canvas, 'product.jpg', (210,210), (832,26), shadow=False)
    draw = ImageDraw.Draw(canvas)   # re-draw after paste

    STEPS = [
        ('01','🌙','Fill at Night',
         'Pour room temperature water into your Vijaysar glass before bed.'),
        ('02','⏳','Infuse Overnight',
         'Sleep while the wood naturally heals the water for 6–8 hours.'),
        ('03','🌅','Drink at Dawn',
         'Drink the golden water first thing every morning on empty stomach.'),
        ('04','✨','Feel the Difference',
         'In 4–6 weeks: balanced blood sugar, better digestion & more energy.'),
    ]
    sy = 272
    for num,em,title,desc in STEPS:
        # Card bg
        card = Image.new('RGBA',(976,162),(255,255,255,14))
        bd = ImageDraw.Draw(card)
        bd.rounded_rectangle([0,0,976,162],radius=16,outline=(*GOLD,50),width=1)
        canvas.paste(card,(52,sy),card)
        draw = ImageDraw.Draw(canvas)
        # Number circle
        draw.ellipse([68,sy+40,144,sy+116], fill=GOLD)
        draw.text((88 if len(num)==2 else 96, sy+52), num, font=font(32,bold=True), fill=DARK_BROWN)
        # Emoji
        draw_emoji(draw, em, 164, sy+44, 50)
        # Text
        draw.text((234,sy+38), title, font=font(34,bold=True), fill=GOLD)
        wrap_text(draw, desc, 234, sy+86, font(27), (200,175,145), 760, gap=6)
        sy += 186

    # Bottom CTA
    cta_y = sy + 12
    if cta_y + 72 > 1080: cta_y = 1080 - 84
    gradient_v(canvas, cta_y, cta_y+72, GOLD, GOLD_LIGHT, x1=52, x2=1028)
    rounded_rect(draw,[52,cta_y,1028,cta_y+72],r=14,fill=None)
    draw.text((78,cta_y+16),
              'Starting ₹499  ·  Free Delivery  ·  COD  ·  vedayulife.com  →',
              font=font(28,bold=True), fill=DARK_BROWN)

    canvas.convert('RGB').save(os.path.join(OUT,'ad4-howto.jpg'), quality=95)
    print('✅  Ad 4 — How To Use saved')

# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print('Generating Vedayu ad creatives…\n')
    make_ad1()
    make_ad2()
    make_ad3()
    make_ad4()
    sizes = {f: f'{os.path.getsize(os.path.join(OUT,f))//1024} KB'
             for f in os.listdir(OUT) if f.endswith('.jpg')}
    print(f'\n✅  All done → public/ads/\n{sizes}')
