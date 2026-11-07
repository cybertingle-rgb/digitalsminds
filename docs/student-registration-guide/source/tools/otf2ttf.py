"""Convert the CFF-based Inter .otf files to TrueType (.ttf), so Chromium embeds them as
TrueType in the PDF instead of Type 3 glyphs. Usage: python3 tools/otf2ttf.py fonts/*.otf
(based on the fontTools otf2ttf snippet)."""
import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

def convert(path):
    font = TTFont(path)
    glyph_order = font.getGlyphOrder()
    glyf = newTable("glyf"); glyf.glyphOrder = glyph_order; glyf.glyphs = {}
    glyph_set = font.getGlyphSet()
    for name in glyph_order:
        pen = TTGlyphPen(glyph_set)
        glyph_set[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyf[name] = pen.glyph()
    font["glyf"] = glyf
    font["loca"] = newTable("loca")
    maxp = font["maxp"]; maxp.tableVersion = 0x00010000
    for attr in ("maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs", "maxStackElements", "maxSizeOfInstructions", "maxComponentElements"):
        setattr(maxp, attr, 0)
    maxp.maxZones = 1
    font["head"].glyphDataFormat = 0
    post = font["post"]; post.formatType = 2.0; post.extraNames = []; post.mapping = {}; post.glyphOrder = glyph_order
    for tag in ("CFF ", "VORG"):
        if tag in font: del font[tag]
    font.sfntVersion = "\x00\x01\x00\x00"
    out = path[:-4] + ".ttf"
    font.save(out)
    print("wrote", out)

for p in sys.argv[1:]:
    convert(p)
