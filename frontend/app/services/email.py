"""Order notification e-mails.

Sent in the background (never blocks or fails an API request). With SMTP_HOST unset nothing leaves the
server: the e-mail is only written to the `email_logs` table (admin -> order -> Email log) and the app log.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from html import escape

from sqlalchemy import select

from app.core.config import settings
from app.database.session import SessionLocal
from app.models import EmailLog, Order, StoreSetting
from app.services.invoice import PAYMENT_LABEL, SHIPPING_LABEL, build_invoice_pdf, tk

log = logging.getLogger("nexora.email")

DEFAULT_STORE = {"storeName": "NEXORA", "email": "hello@nexora.com", "phone": "", "address": "", "hours": ""}


def store_info(db) -> dict:
    row = db.get(StoreSetting, "store")
    return {**DEFAULT_STORE, **(row.value if row else {})}


# ---------------------------------------------------------------- content
def _customer_copy(kind: str, o: Order) -> tuple[str, str, list[str]] | None:
    """(subject, heading, paragraphs) for customer e-mails."""
    track = " · ".join(x for x in (o.courier, f"Tracking no. {o.tracking_number}" if o.tracking_number else None) if x)
    return {
        "placed": (f"Order #{o.id} received", "Thank you for your order!",
                   ["We have received your order and will confirm it shortly. Your invoice is attached.",
                    "You can follow every step of your delivery from <b>My orders</b> on our website."]),
        "confirmed": (f"Order #{o.id} confirmed", "Your order is confirmed",
                      ["Good news - we have confirmed your order and will start preparing it."]),
        "processing": (f"Order #{o.id} is being packed", "We're packing your order",
                       ["Your items are being packed and will be handed to the courier soon."]),
        "shipped": (f"Order #{o.id} has shipped", "Your order is on its way",
                    ["Your parcel has been handed to the courier." + (f"<br><b>{escape(track)}</b>" if track else "")]),
        "delivered": (f"Order #{o.id} delivered", "Your order has been delivered",
                      [f"We hope you love it! Your invoice is attached. If something isn't right you can request a refund within "
                       f"{settings.refund_window_days} days from <b>My orders</b>."]),
        "cancelled": (f"Order #{o.id} cancelled", "Your order was cancelled",
                      [f"Your order has been cancelled" + (f" ({escape(o.cancel_reason)})" if o.cancel_reason else "") + "."
                       + (" Because you had already paid, a refund is now being processed - we'll email you once it's sent." if o.refund_status == "Requested" else "")]),
        "refund_requested": (f"Refund request received for #{o.id}", "We received your refund request",
                             ["Our team will review it and email you the decision soon."]),
        "refund_refunded": (f"Refund processed for #{o.id}", "Your refund is on its way",
                            [f"We refunded <b>{tk(o.refund_amount)}</b> via <b>{escape(o.refund_method or '')}</b>."
                             + (f"<br>{escape(o.refund_note)}" if o.refund_note else "")
                             + "<br>Depending on your bank or wallet it can take a few working days to show up."]),
        "refund_rejected": (f"Update on your refund request for #{o.id}", "About your refund request",
                            ["We reviewed your request and are unable to refund this order." + (f"<br><b>Reason:</b> {escape(o.refund_note)}" if o.refund_note else "")
                             + "<br>Reply to this email if you'd like to talk about it."]),
        "invoice": (f"Invoice for order #{o.id}", "Here is your invoice", ["Your invoice is attached to this email."]),
    }.get(kind)


def _admin_copy(kind: str, o: Order) -> tuple[str, str, list[str]] | None:
    who = f"{escape(o.name)} ({escape(o.phone)})"
    return {
        "admin_new_order": (f"New order #{o.id} - {tk(o.total)}", "New order received",
                            [f"{who} placed order <b>#{o.id}</b> for <b>{tk(o.total)}</b> ({escape(PAYMENT_LABEL.get(o.payment, o.payment))})."]),
        "admin_cancelled": (f"Order #{o.id} cancelled by customer", "Customer cancelled an order",
                            [f"{who} cancelled order <b>#{o.id}</b>." + (f"<br><b>Reason:</b> {escape(o.cancel_reason)}" if o.cancel_reason else "")
                             + ("<br><b>A refund is due</b> - the order was paid." if o.refund_status == "Requested" else "")]),
        "admin_refund_request": (f"Refund request for order #{o.id}", "Refund requested",
                                 [f"{who} asked for a refund on order <b>#{o.id}</b> ({tk(o.total)}).<br><b>Reason:</b> {escape(o.refund_reason or '')}"]),
    }.get(kind)


def _render(store: dict, heading: str, paras: list[str], o: Order, admin: bool) -> tuple[str, str]:
    name = escape(store["storeName"])
    rows = "".join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid #eee">{escape(i.name)} × {i.quantity}</td>'
        f'<td align="right" style="padding:6px 0;border-bottom:1px solid #eee">{tk(i.price * i.quantity)}</td></tr>' for i in o.items)
    totals = f'<tr><td style="padding:8px 0"><b>Total</b></td><td align="right" style="padding:8px 0"><b>{tk(o.total)}</b></td></tr>'
    body = "".join(f'<p style="margin:0 0 12px;line-height:1.55">{p}</p>' for p in paras)
    html = f"""<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#161a1d">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#161a1d;color:#fff;font-size:20px;font-weight:700">{name}<span style="color:#ff6a2b">.</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:22px">{escape(heading)}</h1>{body}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;font-size:14px">
<tr><td colspan="2" style="padding-bottom:6px;font-size:11px;letter-spacing:1.5px;color:#6b6f68">ORDER #{o.id}</td></tr>{rows}{totals}</table>
<p style="margin:18px 0 0;font-size:13px;color:#6b6f68">{escape(SHIPPING_LABEL.get(o.shipping, o.shipping))} to {escape(o.address)}, {escape(o.area)}, {escape(o.district)}<br>
Payment: {escape(PAYMENT_LABEL.get(o.payment, o.payment))} · {escape(o.payment_status or 'Unpaid')}</p>
</td></tr>
<tr><td style="padding:18px 28px;background:#faf8f3;font-size:12px;color:#6b6f68">{'' if admin else f"Questions? Reply to this email or contact {escape(store.get('email') or '')} {escape(store.get('phone') or '')}"}</td></tr>
</table></td></tr></table></body></html>"""
    import re
    text = re.sub(r"<br\s*/?>", "\n", " ".join(paras))
    text = re.sub(r"<[^>]+>", "", text)
    text = f"{heading}\n\n{text}\n\nOrder #{o.id} - total {tk(o.total)}\n"
    return html, text


# ---------------------------------------------------------------- sending
def _smtp_send(msg: EmailMessage) -> None:
    if settings.smtp_security == "ssl":
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20, context=ssl.create_default_context()) as s:
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as s:
        if settings.smtp_security == "starttls":
            s.starttls(context=ssl.create_default_context())
        if settings.smtp_user:
            s.login(settings.smtp_user, settings.smtp_password)
        s.send_message(msg)


def send_order_email(order_id: str, kind: str) -> None:
    """Background task: builds and sends one e-mail about an order. Never raises."""
    try:
        with SessionLocal() as db:
            o = db.get(Order, order_id)
            if not o:
                return
            store = store_info(db)
            admin = kind.startswith("admin_")
            copy = _admin_copy(kind, o) if admin else _customer_copy(kind, o)
            if not copy:
                return
            subject, heading, paras = copy
            to = (settings.notify_email or settings.admin_email) if admin else o.email
            if not to:
                return
            html, text = _render(store, heading, paras, o, admin)
            msg = EmailMessage()
            msg["Subject"] = f"[{store['storeName']}] {subject}"
            msg["From"] = settings.mail_from
            msg["To"] = to
            if not admin and store.get("email"):
                msg["Reply-To"] = store["email"]
            msg.set_content(text)
            msg.add_alternative(html, subtype="html")
            if kind in ("placed", "delivered", "invoice"):
                msg.add_attachment(build_invoice_pdf(o, store), maintype="application", subtype="pdf", filename=f"invoice-{o.id}.pdf")

            status, error = "logged", None
            if settings.smtp_host:
                try:
                    _smtp_send(msg)
                    status = "sent"
                except Exception as e:  # noqa: BLE001 - recorded, never fatal
                    status, error = "failed", f"{type(e).__name__}: {e}"[:400]
                    log.warning("Email %s for %s failed: %s", kind, order_id, error)
            else:
                log.info("[email not sent - SMTP_HOST empty] to=%s subject=%s", to, msg["Subject"])
            db.add(EmailLog(order_id=order_id, kind=kind, to_email=to, subject=msg["Subject"], status=status, error=error))
            db.commit()
    except Exception:  # noqa: BLE001
        log.exception("Could not build e-mail %s for order %s", kind, order_id)
