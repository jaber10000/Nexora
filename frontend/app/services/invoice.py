"""Order invoice PDF (reportlab, built-in Helvetica - no font files needed).

Helvetica has no Bengali taka sign, so amounts print as "Tk 1,234"; characters outside Latin-1
(e.g. Bengali product names) are replaced with "?" to avoid blank boxes."""
from datetime import timedelta
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.models import Order

ORANGE = colors.HexColor("#ff6a2b")
DARK = colors.HexColor("#161a1d")
MUTED = colors.HexColor("#6b6f68")
LINE = colors.HexColor("#ddd8cc")
SHIPPING_LABEL = {"standard": "Standard delivery", "express": "Express delivery"}
PAYMENT_LABEL = {"cod": "Cash on Delivery", "bkash": "bKash", "nagad": "Nagad", "sslcommerz": "SSLCommerz"}


def _w(*mms: float) -> list[float]:
    """Column widths (points), shrunk if needed to fit inside the frame (A4 minus margins minus frame padding)."""
    usable = A4[0] - 36 * mm - 12
    k = min(1.0, usable / sum(mms))
    return [m * k for m in mms]


def tk(n: int) -> str:
    return f"Tk {n:,}"


def _t(s: str | None) -> str:
    """Latin-1 safe + XML escaped text for Paragraph."""
    s = (s or "").encode("latin-1", "replace").decode("latin-1")
    return escape(s)


def _local(dt):
    return dt + timedelta(hours=settings.store_utc_offset_hours)


def build_invoice_pdf(o: Order, store: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Invoice INV-{o.id}", author=store.get("storeName", "NEXORA"))
    S = lambda name, **kw: ParagraphStyle(name, fontName=kw.pop("font", "Helvetica"), **kw)
    body = S("body", fontSize=9.5, leading=13, textColor=DARK)
    small = S("small", fontSize=8.5, leading=12, textColor=MUTED)
    label = S("label", fontSize=7.5, leading=10, textColor=MUTED, font="Helvetica-Bold")
    right = S("right", fontSize=9.5, leading=13, textColor=DARK, alignment=2)
    brand = S("brand", fontSize=24, leading=28, textColor=DARK, font="Helvetica-Bold")
    title = S("title", fontSize=20, leading=24, textColor=DARK, font="Helvetica-Bold", alignment=2)

    paid = (o.payment_status or "Unpaid")
    if o.status == "Cancelled":
        stamp, stamp_color = "CANCELLED", colors.HexColor("#c0392b")
    elif o.payment_status == "Refunded":
        stamp, stamp_color = "REFUNDED", colors.HexColor("#6b45a8")
    elif paid == "Paid":
        stamp, stamp_color = "PAID", colors.HexColor("#2c7a4b")
    else:
        stamp, stamp_color = "PAYMENT DUE", colors.HexColor("#b86a14")

    el = []
    name = (store.get("storeName") or "NEXORA").upper()
    head = Table([[Paragraph(f'{_t(name)}<font color="#ff6a2b">.</font>', brand),
                   [Paragraph("INVOICE", title), Paragraph(f'<font color="{stamp_color.hexval().replace("0x", "#")}"><b>{stamp}</b></font>', right)]]],
                 colWidths=_w(95 * mm, 79 * mm))
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    el += [head, Spacer(1, 3 * mm)]
    store_lines = [store.get("address"), store.get("email"), store.get("phone")]
    el += [Paragraph("<br/>".join(_t(x) for x in store_lines if x), small), Spacer(1, 6 * mm)]

    placed = _local(o.created_at).strftime("%d %b %Y, %I:%M %p")
    meta = Table([[Paragraph("INVOICE NO.", label), Paragraph("ORDER DATE", label), Paragraph("PAYMENT", label), Paragraph("ORDER STATUS", label)],
                  [Paragraph(f"<b>INV-{o.id}</b>", body), Paragraph(placed, body),
                   Paragraph(f"{_t(PAYMENT_LABEL.get(o.payment, o.payment))}<br/>{_t(paid)}", body), Paragraph(_t(o.status), body)]],
                 colWidths=_w(44 * mm, 46 * mm, 44 * mm, 40 * mm))
    meta.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#faf8f3")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, 1), (-1, 1), 8)]))
    el += [meta, Spacer(1, 6 * mm)]

    addr = f"<b>{_t(o.name)}</b><br/>{_t(o.address)}<br/>{_t(o.area)}, {_t(o.district)}<br/>Phone: {_t(o.phone)}"
    if o.email:
        addr += f"<br/>{_t(o.email)}"
    ship = f"{_t(SHIPPING_LABEL.get(o.shipping, o.shipping))}"
    if o.courier or o.tracking_number:
        ship += "<br/>" + _t(" · ".join(x for x in (o.courier, f"Tracking {o.tracking_number}" if o.tracking_number else None) if x))
    two = Table([[Paragraph("BILL TO / SHIP TO", label), Paragraph("DELIVERY", label)], [Paragraph(addr, body), Paragraph(ship, body)]],
                colWidths=_w(104 * mm, 70 * mm))
    two.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, 0), 3)]))
    el += [two, Spacer(1, 7 * mm)]

    rows = [[Paragraph("ITEM", label), Paragraph("PRICE", S("r1", fontSize=7.5, textColor=MUTED, font="Helvetica-Bold", alignment=2)),
             Paragraph("QTY", S("r2", fontSize=7.5, textColor=MUTED, font="Helvetica-Bold", alignment=2)),
             Paragraph("AMOUNT", S("r3", fontSize=7.5, textColor=MUTED, font="Helvetica-Bold", alignment=2))]]
    for it in o.items:
        rows.append([Paragraph(_t(it.name), body), Paragraph(tk(it.price), right), Paragraph(str(it.quantity), right), Paragraph(tk(it.price * it.quantity), right)])
    items = Table(rows, colWidths=_w(86 * mm, 30 * mm, 16 * mm, 42 * mm), repeatRows=1)
    items.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 1, DARK), ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
                               ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                               ("LEFTPADDING", (0, 0), (0, -1), 0), ("RIGHTPADDING", (-1, 0), (-1, -1), 0)]))
    el += [items, Spacer(1, 4 * mm)]

    tot = [["Subtotal", tk(o.subtotal)]]
    if o.discount:
        tot.append([f"Discount ({_t(o.coupon or 'coupon')})", "-" + tk(o.discount)])
    tot.append(["Delivery", tk(o.delivery) if o.delivery else "Free"])
    tot.append(["Total", tk(o.total)])
    grand_row = len(tot) - 1
    if o.refund_status == "Refunded":
        tot.append(["Refunded", "-" + tk(o.refund_amount)])
        tot.append(["Net amount", tk(o.total - o.refund_amount)])
    bold = lambda t, i: f"<b>{t}</b>" if i == grand_row else t
    tb = Table([[Paragraph(bold(a, i), body), Paragraph(bold(b, i), right)] for i, (a, b) in enumerate(tot)], colWidths=_w(40 * mm, 38 * mm), hAlign="RIGHT")
    tb.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3), ("LINEABOVE", (0, grand_row), (-1, grand_row), 1, DARK),
                            ("RIGHTPADDING", (-1, 0), (-1, -1), 0)] ))
    el += [tb, Spacer(1, 10 * mm)]
    if o.status == "Cancelled" and o.cancel_reason:
        el += [Paragraph(f"<b>Cancelled:</b> {_t(o.cancel_reason)}", small), Spacer(1, 2 * mm)]
    el += [Paragraph(f"Thank you for shopping with {_t(store.get('storeName') or 'NEXORA')}. This is a computer-generated invoice and needs no signature.", small)]
    if store.get("hours"):
        el += [Paragraph(f"Support hours: {_t(store['hours'])}", small)]
    doc.build(el)
    return buf.getvalue()
