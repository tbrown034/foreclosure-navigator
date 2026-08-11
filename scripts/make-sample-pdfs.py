#!/usr/bin/env python3
"""Generate synthetic sample foreclosure notice PDFs for the Foreclosure Navigator demo.

These are FICTIONAL documents. They mimic the visual layout of a recorded Harris
County "Notice of Substitute Trustee's Sale" so the demo's upload/extract flow has
something realistic to chew on. No real person, property, loan or filing is used.

Usage:
    python scripts/make-sample-pdfs.py [output_dir]

Default output dir is public/samples/ relative to the repo root.
Requires: reportlab
"""

import sys
from pathlib import Path

from reportlab.lib.colors import Color, black
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = LETTER

BODY_FONT = "Helvetica"
BOLD_FONT = "Helvetica-Bold"
BODY_SIZE = 9
LEADING = 11.2

LEFT = 1.35 * inch
RIGHT = PAGE_W - 0.85 * inch
TEXT_W = RIGHT - LEFT
TOP = PAGE_H - 1.5 * inch

FOOTER = (
    "This is a fictional sample document generated for the Foreclosure Navigator "
    "concept demo. No real person, property, loan or filing is referenced."
)

FICTION_BAND = (
    "FICTIONAL SAMPLE — NOT A RECORDED INSTRUMENT — FOR DEMONSTRATION ONLY"
)


def wrap(c, text, font, size, width):
    """Greedy word wrap against the canvas's own string metrics."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if c.stringWidth(trial, font, size) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_justified(c, lines, x, y, width, font, size, leading):
    """Draw wrapped lines justified, leaving the last line of the block ragged.

    Justification stretches the inter-word gap via the PDF word-spacing operator
    rather than positioning each word separately, so text extractors still read
    one whole line at a time.
    """
    for i, line in enumerate(lines):
        last = i == len(lines) - 1
        words = line.split()
        to = c.beginText(x, y)
        to.setFont(font, size)
        if not last and len(words) > 1:
            slack = width - c.stringWidth(line, font, size)
            to.setWordSpace(slack / (len(words) - 1))
        to.textLine(line)
        c.drawText(to)
        y -= leading
    return y


def para(c, text, y, *, bold_lead=None, gap=6):
    """Render one justified paragraph, optionally with a bold lead-in word."""
    if bold_lead:
        c.setFont(BOLD_FONT, BODY_SIZE)
        c.drawString(LEFT, y, bold_lead)
        indent = c.stringWidth(bold_lead + " ", BOLD_FONT, BODY_SIZE)
        first = wrap(c, text, BODY_FONT, BODY_SIZE, TEXT_W - indent)[:1]
        if first:
            c.setFont(BODY_FONT, BODY_SIZE)
            c.drawString(LEFT + indent, y, first[0])
            rest = text[len(first[0]) :].strip()
        else:
            rest = text
        y -= LEADING
        lines = wrap(c, rest, BODY_FONT, BODY_SIZE, TEXT_W) if rest else []
    else:
        lines = wrap(c, text, BODY_FONT, BODY_SIZE, TEXT_W)
    y = draw_justified(c, lines, LEFT, y, TEXT_W, BODY_FONT, BODY_SIZE, LEADING)
    return y - gap


def draw_margin_bands(c, stamp):
    """Two rotated bands reading bottom-to-top down the left margin."""
    c.saveState()
    c.setFillColor(black)
    c.translate(0.42 * inch, 1.0 * inch)
    c.rotate(90)
    c.setFont(BOLD_FONT, 8)
    c.drawString(0, 0, stamp)
    c.restoreState()

    c.saveState()
    c.setFillColor(Color(0.25, 0.25, 0.25))
    c.translate(0.72 * inch, 1.0 * inch)
    c.rotate(90)
    c.setFont(BOLD_FONT, 7.5)
    c.drawString(0, 0, FICTION_BAND)
    c.restoreState()


def draw_watermark(c):
    c.saveState()
    c.setFillColor(Color(0.6, 0.6, 0.6, alpha=0.28))
    c.translate(PAGE_W / 2, PAGE_H / 2)
    c.rotate(38)
    c.setFont(BOLD_FONT, 48)
    c.drawCentredString(0, 0, "SAMPLE — FICTIONAL")
    c.restoreState()


def build(path, *, stamp, ts_no, sale_sentence):
    c = canvas.Canvas(str(path), pagesize=LETTER)
    c.setTitle("Notice of Substitute Trustee's Sale (Fictional Sample)")
    c.setAuthor("Foreclosure Navigator concept demo")
    c.setSubject(FICTION_BAND)

    draw_watermark(c)
    draw_margin_bands(c, stamp)

    y = TOP
    c.setFillColor(black)
    c.setFont(BOLD_FONT, 8.5)
    c.drawString(LEFT, y, "RECORDING REQUESTED BY:")
    y -= 11
    c.setFont(BODY_FONT, 8.5)
    for line in ["Example Trustee Services, Inc. (fictional)", "P.O. Box 0000", "Houston, TX 00000"]:
        c.drawString(LEFT, y, line)
        y -= 10

    y -= 8
    c.setFont(BOLD_FONT, 8.5)
    c.drawString(LEFT, y, "WHEN RECORDED MAIL TO:")
    y -= 11
    c.setFont(BODY_FONT, 8.5)
    for line in [
        "Example Loan Servicing, LLC (fictional)",
        "1 Sample Plaza, Suite 000",
        "Houston, TX 00000",
    ]:
        c.drawString(LEFT, y, line)
        y -= 10

    y -= 10
    c.setLineWidth(0.6)
    c.line(LEFT, y, RIGHT, y)
    y -= 12
    c.setFont(BODY_FONT, 7.5)
    c.drawString(LEFT, y, f"TS No: {ts_no}")
    c.drawCentredString((LEFT + RIGHT) / 2, y, "APN: 000-000-000-0000")
    c.drawRightString(RIGHT, y, "TO No: 0000000")
    y -= 6
    c.line(LEFT, y, RIGHT, y)

    y -= 28
    c.setFont(BOLD_FONT, 12.5)
    c.drawCentredString(PAGE_W / 2, y, "NOTICE OF SUBSTITUTE TRUSTEE'S SALE")
    y -= 24

    paragraphs = [
        (
            "JOHN SMITH, A SINGLE PERSON, as Grantor and Borrower, executed and delivered "
            "that certain Deed of Trust dated January 15, 2020, conveying the hereinafter "
            "described real property to the trustee named therein to secure the payment of "
            "one certain promissory note in the original principal amount of $200,000.00, "
            "which Deed of Trust was recorded as Document No. RP-0000-000000 in the Official "
            "Public Records of Real Property of Harris County, Texas;",
            "WHEREAS,",
        ),
        (
            "the real property encumbered by said Deed of Trust is situated in Harris County, "
            "Texas, and is commonly known as 123 Sample Street, Houston, TX 00000, and is more "
            "particularly described as LOT 1, BLOCK 1, SAMPLE ADDITION, an addition in Harris "
            "County, Texas, according to the map or plat thereof of record in the Map Records "
            "of Harris County, Texas, together with all improvements thereon;",
            "WHEREAS,",
        ),
        (
            "Example Loan Servicing, LLC is the current owner and holder of the indebtedness "
            "secured by said Deed of Trust and is the current beneficiary thereunder, and is "
            "the mortgage servicer authorized to administer the loan and to represent the "
            "current beneficiary in connection with the foreclosure of said Deed of Trust;",
            "WHEREAS,",
        ),
        (
            "default has occurred in the payment of the indebtedness secured by said Deed of "
            "Trust, the same is now wholly due, and the current beneficiary has requested the "
            "undersigned to sell said property to satisfy said indebtedness in accordance with "
            "the terms of said Deed of Trust and Section 51.002 of the Texas Property Code;",
            "WHEREAS,",
        ),
        (
            "the undersigned, JANE DOE, has been appointed Substitute Trustee in the place and "
            "stead of the original trustee under said Deed of Trust, in the manner authorized "
            "by said Deed of Trust and by law;",
            "WHEREAS,",
        ),
    ]

    for text, lead in paragraphs:
        y = para(c, text, y, bold_lead=lead)

    y -= 4
    c.setFont(BOLD_FONT, 9.5)
    c.drawString(LEFT, y, "NOTICE OF SALE")
    y -= 13

    y = para(c, sale_sentence, y)
    y = para(
        c,
        "Notice is further given that the sale will be conducted as a public auction to the "
        "highest bidder for cash, and that the property will be sold AS IS, WHERE IS, without "
        "any express or implied warranties, except as to warranties of title, and subject to "
        "all prior liens and encumbrances of record, if any. Assert and protect your rights as "
        "a member of the armed forces of the United States. If you are or your spouse is "
        "serving on active military duty, please send written notice of the active duty "
        "military service to the sender of this notice immediately.",
        y,
    )

    y -= 16
    c.setFont(BODY_FONT, 8.5)
    c.drawString(LEFT, y, "Dated this day, in Harris County, Texas.")
    y -= 26
    c.line(LEFT, y, LEFT + 2.4 * inch, y)
    y -= 11
    c.setFont(BOLD_FONT, 8.5)
    c.drawString(LEFT, y, "JANE DOE, SUBSTITUTE TRUSTEE")
    y -= 10
    c.setFont(BODY_FONT, 8)
    c.drawString(LEFT, y, "c/o Example Trustee Services, Inc. (fictional)")
    y -= 9.5
    c.drawString(LEFT, y, "P.O. Box 0000, Houston, TX 00000")

    c.setFont(BODY_FONT, 7)
    c.setFillColor(Color(0.3, 0.3, 0.3))
    footer_lines = wrap(c, FOOTER, BODY_FONT, 7, TEXT_W)
    fy = 0.62 * inch
    for line in footer_lines:
        c.drawString(LEFT, fy, line)
        fy -= 8.5

    c.showPage()
    c.save()


SALE_TEMPLATE = (
    "Notice is hereby given that on {day}, {date}, the Substitute Trustee will sell the "
    "above-described property at public venue at the Bayou City Event Center, 9401 Knight "
    "Road, Houston, Texas, being the area designated by the Commissioners Court of Harris "
    "County, Texas, for the conduct of such sales. The earliest time at which the sale will "
    "begin is 10:00 AM, and the sale will begin within three hours of that time."
)

SAMPLES = {
    "sample-notice-a.pdf": dict(
        stamp="SAMPLE-2026-A   FILED 8/4/2026 9:00:00 AM",
        ts_no="SAMPLE-A-0001",
        sale_sentence=SALE_TEMPLATE.format(day="Tuesday", date="October 6, 2026"),
    ),
    "sample-notice-b.pdf": dict(
        stamp="SAMPLE-2026-B   FILED 8/5/2026 10:30:00 AM",
        ts_no="SAMPLE-B-0001",
        sale_sentence=SALE_TEMPLATE.format(day="Tuesday", date="September 1, 2026"),
    ),
}


def main():
    if len(sys.argv) > 1:
        out_dir = Path(sys.argv[1])
    else:
        out_dir = Path(__file__).resolve().parent.parent / "public" / "samples"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, kwargs in SAMPLES.items():
        path = out_dir / name
        build(path, **kwargs)
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
