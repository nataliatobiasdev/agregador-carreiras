"""Gera os ícones do app a partir de build/icon-source/app-icon-source.png.

Ferramenta de desenvolvimento, fora do build e do app: só precisa rodar de novo
quando a arte-fonte mudar. Requer Python 3 com Pillow e NumPy.

    python scripts/icons/generate_icons.py

A arte-fonte (gerada por IA) é RGB sem canal alfa e traz um tabuleiro xadrez
pintado nos pixels no lugar da transparência. O script:
  1. recorta o squircle: tudo que não é alcançável a partir das bordas da imagem
     passando por pixels claros (fundo xadrez e sombra cinza);
  2. descarta o fundo e a sombra pintados e desenha uma sombra suave sintética,
     de verdade em alfa;
  3. exporta PNGs de 16 a 1024 px e um .ico multi-tamanho para o Windows.
     Até 48 px o squircle ocupa quase todo o quadro e fica sem sombra, para
     render bem na barra de título, na bandeja e no Explorer.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "build" / "icon-source" / "app-icon-source.png"
BUILD = ROOT / "build"
PNG_DIR = BUILD / "icons"

ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
SMALL_MAX = 48  # até este tamanho: sem sombra, margem mínima
TINY_MAX = 32  # até este tamanho: variante simplificada, com o símbolo ampliado
NAVY = (8, 10, 32)
SPARKLE_BOX = (718, 212, 810, 306)  # brilho pequeno no canto superior direito da arte
GLYPH_CROP = (205, 205, 825, 825)  # quadrado em torno da estrela e da escada


def extract_squircle(src: Image.Image) -> Image.Image:
    rgb = np.asarray(src.convert("RGB")).astype(np.float32)
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    # Fundo xadrez (227 a 255) e sombra cinza (> 100) são claros; o squircle e sua borda são escuros (< 70).
    light = Image.fromarray(np.where(lum >= 90, 255, 0).astype(np.uint8), "L").copy()
    w, h = light.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(light, corner, 128)
    outside = np.asarray(light) == 128
    mask = Image.fromarray(np.where(outside, 0, 255).astype(np.uint8), "L")
    # Tira 1 px da borda (contaminada pelo cinza da sombra) e suaviza o serrilhado.
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.9))
    rgba = src.convert("RGBA")
    rgba.putalpha(mask)
    return rgba.crop(mask.getbbox())


def tiny_variant(src: Image.Image, squircle: Image.Image) -> Image.Image:
    """Squircle com o símbolo ampliado e sem o brilho do canto, para 16 a 32 px.

    No tamanho original o símbolo ocupa 70% do squircle e vira um borrão em 16 px;
    aqui ele ocupa quase todo o quadro, e o brilho (que viraria um pixel solto) sai.
    """
    art = src.convert("RGB").copy()
    patch = Image.new("L", art.size, 0)
    ImageDraw.Draw(patch).rectangle(SPARKLE_BOX, fill=255)
    art.paste(Image.new("RGB", art.size, NAVY), (0, 0), patch.filter(ImageFilter.GaussianBlur(4)))
    glyph = art.crop(GLYPH_CROP).resize(squircle.size, Image.LANCZOS).convert("RGBA")
    glyph.putalpha(squircle.getchannel("A"))
    return glyph


def compose(squircle: Image.Image, size: int) -> Image.Image:
    scale = 4  # desenha grande e reduz, para bordas e sombra limpas
    canvas_px = size * scale
    small = size <= SMALL_MAX
    fill = 0.94 if small else 0.84
    side = round(canvas_px * fill)
    body = squircle.resize((side, side), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    x = (canvas_px - side) // 2
    y = x - (0 if small else round(canvas_px * 0.015))
    if not small:
        alpha = Image.new("L", (canvas_px, canvas_px), 0)
        alpha.paste(body.getchannel("A"), (x, y + round(canvas_px * 0.025)))
        alpha = alpha.filter(ImageFilter.GaussianBlur(canvas_px * 0.025))
        alpha = alpha.point(lambda v: round(v * 0.45))
        shadow = Image.new("RGBA", (canvas_px, canvas_px), (4, 6, 20, 0))
        shadow.putalpha(alpha)
        canvas = Image.alpha_composite(canvas, shadow)
    layer = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    layer.paste(body, (x, y))
    canvas = Image.alpha_composite(canvas, layer)
    out = canvas.resize((size, size), Image.LANCZOS)
    if small:
        # Recupera nitidez perdida na redução sem mexer no alfa.
        sharp = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=1))
        sharp.putalpha(out.getchannel("A"))
        out = sharp
    # Zera o resíduo quase invisível do filtro de redução nos cantos.
    out.putalpha(out.getchannel("A").point(lambda v: 0 if v < 6 else v))
    return out


def main() -> None:
    src = Image.open(SOURCE)
    squircle = extract_squircle(src)
    tiny = tiny_variant(src, squircle)
    PNG_DIR.mkdir(parents=True, exist_ok=True)
    rendered = {
        s: compose(tiny if s <= TINY_MAX else squircle, s) for s in sorted(set(ICO_SIZES + PNG_SIZES))
    }
    for s in PNG_SIZES:
        rendered[s].save(PNG_DIR / f"{s}x{s}.png", optimize=True)
    rendered[1024].save(BUILD / "icon.png", optimize=True)
    ico_frames = [rendered[s] for s in ICO_SIZES]
    ico_frames[-1].save(
        BUILD / "icon.ico",
        format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=ico_frames[:-1],
    )
    # Garantia: nenhum pixel do tabuleiro sobreviveu (cantos totalmente transparentes).
    for s, im in rendered.items():
        corners = [im.getpixel(p)[3] for p in [(0, 0), (s - 1, 0), (0, s - 1), (s - 1, s - 1)]]
        assert max(corners) == 0, f"canto opaco em {s}px: {corners}"
    print("ok:", ", ".join(str(s) for s in ICO_SIZES), "->", BUILD / "icon.ico")


if __name__ == "__main__":
    main()
