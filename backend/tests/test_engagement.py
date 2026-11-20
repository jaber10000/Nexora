"""Smoke test for wishlist + reviews. Run: cd backend && python tests/test_engagement.py  (delete nexora_dev.db afterwards)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app

def check(c, m=""):
    assert c, m

with TestClient(app) as c:
    h = lambda e, p: {"Authorization": "Bearer " + c.post("/api/auth/login", json={"email": e, "password": p}).json()["access_token"]}
    demo, admin = h("demo@gmail.com", "jaberdemo"), h("admin@nexora.com", "admin1234")
    p0, p1 = c.get("/api/products").json()[:2]

    # ---- wishlist: auth required, idempotent, per user
    check(c.get("/api/wishlist").status_code == 401)
    check(c.post(f"/api/wishlist/{p0['id']}").status_code == 401)
    check(c.post(f"/api/wishlist/{p0['id']}", headers=demo).json()["ids"] == [p0["id"]])
    check(c.post(f"/api/wishlist/{p0['id']}", headers=demo).json()["ids"] == [p0["id"]])      # duplicate = no-op
    check(c.post("/api/wishlist/99999", headers=demo).status_code == 404)
    check(c.get("/api/wishlist", headers=admin).json()["ids"] == [])                           # not shared between users
    check(set(c.post("/api/wishlist/merge", headers=demo, json={"ids": [p1["id"], 99999]}).json()["ids"]) == {p0["id"], p1["id"]})
    check(c.delete(f"/api/wishlist/{p0['id']}", headers=demo).json()["ids"] == [p1["id"]])

    # ---- reviews: must have a delivered order
    body = {"rating": 5, "title": "Great", "comment": "Really happy with this one."}
    check(c.post(f"/api/products/{p0['id']}/reviews", json=body).status_code == 401)
    r = c.post(f"/api/products/{p0['id']}/reviews", headers=demo, json=body); check(r.status_code == 403, r.text)
    addr = {"name": "Demo", "phone": "01700000000", "address": "Road 1", "area": "Banani", "district": "Dhaka"}
    o = c.post("/api/orders", headers=demo, json={"lines": [{"id": p0["id"], "quantity": 1}], "shipping": "standard", "payment": "cod", "address": addr}).json()
    check(c.get(f"/api/products/{p0['id']}/reviews", headers=demo).json()["viewer"]["canReview"] is False)   # not delivered yet
    for st in ("Confirmed", "Processing", "Shipped"):
        c.patch(f"/api/admin/orders/{o['id']}/status", headers=admin, json={"status": st, "courier": "Pathao", "trackingNumber": "T1"})
    c.patch(f"/api/admin/orders/{o['id']}/status", headers=admin, json={"status": "Delivered"})
    check(c.get(f"/api/products/{p0['id']}/reviews", headers=demo).json()["viewer"]["canReview"] is True)
    check(c.post(f"/api/products/{p0['id']}/reviews", headers=demo, json={**body, "rating": 6}).status_code == 422)
    r = c.post(f"/api/products/{p0['id']}/reviews", headers=demo, json=body); check(r.status_code == 201, r.text)
    rid = r.json()["id"]
    check(c.post(f"/api/products/{p0['id']}/reviews", headers=demo, json=body).status_code == 409)          # one per product
    check(c.post(f"/api/products/{p1['id']}/reviews", headers=demo, json=body).status_code == 403)          # never bought p1

    # ---- aggregates
    d = c.get(f"/api/products/{p0['id']}/reviews").json()
    check(d["average"] == 5.0 and d["count"] == 1 and d["distribution"]["5"] == 1 and d["items"][0]["author"] == "Demo")
    prod = [x for x in c.get("/api/products").json() if x["id"] == p0["id"]][0]
    check(prod["ratingAvg"] == 5.0 and prod["reviewCount"] == 1)
    check(c.put(f"/api/reviews/{rid}", headers=demo, json={**body, "rating": 3}).json()["rating"] == 3)
    check(c.get(f"/api/products/{p0['id']}").json()["ratingAvg"] == 3.0)

    # ---- moderation
    check(c.get("/api/admin/reviews", headers=demo).status_code == 403)
    check(c.get("/api/admin/reviews", headers=admin).json()["total"] == 1)
    check(c.delete(f"/api/reviews/{rid}").status_code == 401)
    check(c.delete(f"/api/reviews/{rid}", headers=admin).status_code == 204)
    check(c.get(f"/api/products/{p0['id']}/reviews").json()["count"] == 0)
print("engagement OK")
