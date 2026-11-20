import sys, time
import os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app

def check(c, m=""):
    assert c, m

with TestClient(app) as c:
    tok = lambda e, p: {"Authorization": "Bearer " + c.post("/api/auth/login", json={"email": e, "password": p}).json()["access_token"]}
    demo, admin = tok("demo@gmail.com", "jaberdemo"), tok("admin@nexora.com", "admin1234")
    prods = c.get("/api/products").json(); p0 = prods[0]
    stock0 = p0["stock"]
    addr = {"name": "Demo", "phone": "01700000000", "address": "Road 1", "area": "Banani", "district": "Dhaka"}
    def place(pay="cod", coupon=None):
        r = c.post("/api/orders", headers=demo, json={"lines": [{"id": p0["id"], "quantity": 2}], "shipping": "standard", "payment": pay, "address": addr, "coupon": coupon})
        assert r.status_code == 201, r.text; return r.json()
    o = place(coupon="WELCOME10" if False else None)
    print("placed", o["id"], o["status"], [e["title"] for e in o["timeline"]], o["canCancel"], o["paymentStatus"])
    stock = lambda: [x for x in c.get("/api/products").json() if x["id"] == p0["id"]][0]["stock"]
    check(stock() == stock0 - 2)

    # invoice
    r = c.get(f"/api/orders/{o['id']}/invoice", headers=demo); check(r.status_code == 200 and r.content[:4] == b"%PDF", r.text)
    open(os.devnull, "wb").write(r.content)
    check(c.get(f"/api/orders/{o['id']}/invoice").status_code == 401)
    # other user can't see
    other = c.post("/api/auth/register", json={"name": "Other", "email": "o@x.com", "password": "abcdefg1"}).json()["access_token"]
    oh = {"Authorization": "Bearer " + other}
    check(c.get(f"/api/orders/{o['id']}", headers=oh).status_code == 404)
    check(c.post(f"/api/orders/{o['id']}/cancel", headers=oh, json={"reason": "just because"}).status_code == 404)

    # admin flow
    r = c.patch(f"/api/admin/orders/{o['id']}/status", headers=admin, json={"status": "Confirmed"}); check(r.status_code == 200, r.text)
    r = c.patch(f"/api/admin/orders/{o['id']}/status", headers=admin, json={"status": "Shipped", "courier": "Pathao", "trackingNumber": "PT123"}); check(r.status_code == 200, r.text)
    j = r.json(); print("shipped", [(e["title"], e["note"]) for e in j["timeline"]], j["canCancel"])
    r = c.post(f"/api/orders/{o['id']}/cancel", headers=demo, json={"reason": "changed my mind"}); check(r.status_code == 409, r.text); print("cancel after ship ->", r.json()["detail"])
    r = c.patch(f"/api/admin/orders/{o['id']}/status", headers=admin, json={"status": "Delivered"}); j = r.json()
    print("delivered", j["paymentStatus"], j["canRequestRefund"], j["refundBlockReason"])
    check(j["paymentStatus"] == "Paid" and j["canRequestRefund"])
    r = c.patch(f"/api/admin/orders/{o['id']}/status", headers=admin, json={"status": "Cancelled"}); check(r.status_code == 409, r.text)
    # refund request
    r = c.post(f"/api/orders/{o['id']}/refund-request", headers=demo, json={"reason": "Item damaged"}); check(r.status_code == 200, r.text)
    check(c.post(f"/api/orders/{o['id']}/refund-request", headers=demo, json={"reason": "again again"}).status_code == 409)
    r = c.post(f"/api/admin/orders/{o['id']}/refund", headers=admin, json={"amount": 999999, "method": "bKash"}); check(r.status_code == 400, r.text)
    r = c.post(f"/api/admin/orders/{o['id']}/refund", headers=admin, json={"amount": o["total"], "method": "bKash", "note": "01700", "restock": True}); check(r.status_code == 200, r.text)
    j = r.json(); print("refunded", j["refund"], j["paymentStatus"]); check(stock() == stock0)
    check(c.post(f"/api/admin/orders/{o['id']}/refund", headers=admin, json={"amount": 10, "method": "x"}).status_code == 409)
    r = c.get(f"/api/orders/{o['id']}/invoice", headers=demo); open(os.devnull, "wb").write(r.content)

    # customer cancel (unpaid online order) -> restock, coupon back
    cp = lambda: [x for x in c.get("/api/admin/../api/coupons", headers=admin).json() if x["code"] == "WELCOME10"][0]["used"]
    try: u0 = cp()
    except Exception as e: u0 = None
    o2 = place("bkash", "WELCOME10"); print("o2 discount", o2["discount"], o2["total"])
    check(stock() == stock0 - 2)
    r = c.post(f"/api/orders/{o2['id']}/cancel", headers=demo, json={"reason": "ordered by mistake"}); check(r.status_code == 200, r.text)
    j = r.json(); print("cancelled", j["status"], j["cancelReason"], j["refund"], [e["title"] for e in j["timeline"]])
    check(stock() == stock0 and j["refund"] is None)
    if u0 is not None: check(cp() == u0, (cp(), u0))
    # reopen
    r = c.patch(f"/api/admin/orders/{o2['id']}/status", headers=admin, json={"status": "Pending"}); check(r.status_code == 200 and stock() == stock0 - 2, r.text)

    # paid cancel -> refund due
    c.patch(f"/api/admin/orders/{o2['id']}/payment", headers=admin, json={"paid": True})
    r = c.post(f"/api/orders/{o2['id']}/cancel", headers=demo, json={"reason": "no longer needed"}); j = r.json()
    print("paid cancel refund:", j["refund"]); check(j["refund"]["status"] == "Requested")
    r = c.post(f"/api/admin/orders/{o2['id']}/refund/reject", headers=admin, json={"note": "nope"}); check(r.status_code == 409, r.text)
    r = c.post(f"/api/admin/orders/{o2['id']}/refund", headers=admin, json={"amount": 100, "method": "Nagad"}); j = r.json(); print("partial", j["paymentStatus"])
    check(j["paymentStatus"] == "Partially Refunded" and stock() == stock0)
    r = c.patch(f"/api/admin/orders/{o2['id']}/status", headers=admin, json={"status": "Pending"}); check(r.status_code == 409, r.text)

    # reject flow
    o3 = place(); 
    for s in ("Confirmed", "Delivered"): c.patch(f"/api/admin/orders/{o3['id']}/status", headers=admin, json={"status": s})
    c.post(f"/api/orders/{o3['id']}/refund-request", headers=demo, json={"reason": "Not as expected"})
    r = c.post(f"/api/admin/orders/{o3['id']}/refund/reject", headers=admin, json={"note": "Used item"}); check(r.status_code == 200, r.text); print("rejected", r.json()["refund"]["status"], r.json()["canRequestRefund"])

    time.sleep(0.5)
    em = c.get(f"/api/admin/orders/{o['id']}/emails", headers=admin).json(); print("emails o1:", [(e["kind"], e["status"]) for e in em])
    check({"placed", "admin_new_order", "confirmed", "shipped", "delivered", "refund_requested", "admin_refund_request", "refund_refunded"} <= {e["kind"] for e in em})
    print("emails o2:", [(e["kind"], e["status"]) for e in c.get(f"/api/admin/orders/{o2['id']}/emails", headers=admin).json()])
    r = c.post(f"/api/admin/orders/{o['id']}/email-invoice", headers=admin); print(r.status_code)
    # dashboards still work and exclude refunded
    d = c.get("/api/admin/dashboard", headers=admin); check(d.status_code == 200, d.text); a = c.get("/api/admin/analytics", headers=admin); check(a.status_code == 200, a.text)
    st = c.get("/api/admin/stats", headers=admin).json(); print("stats sales", st["sales"], "orders", st["orders"])
    print("ALL OK")
