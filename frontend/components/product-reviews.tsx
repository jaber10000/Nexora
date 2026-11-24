'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Rating } from '@/components/rating';

type Review = { id: number; rating: number; title?: string | null; comment: string; author: string; createdAt?: string | null; edited?: boolean };
type ReviewsResponse = { average: number; count: number; distribution: Record<string, number>; items: Review[]; viewer: { signedIn: boolean; canReview: boolean; myReview?: Review | null } };
export function ProductReviews({ productId }: { productId: number }) {
 const [data,setData]=useState<ReviewsResponse|null>(null); const [rating,setRating]=useState(5); const [title,setTitle]=useState(''); const [comment,setComment]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 async function load(){setData(await api<ReviewsResponse>(`/api/products/${productId}/reviews`));}
 useEffect(()=>{load().catch(e=>setMessage(e.message||'Unable to load reviews.'));},[productId]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await api(`/api/products/${productId}/reviews`,{method:'POST',body:{rating,title:title.trim()||null,comment}});setTitle('');setComment('');setMessage('Review submitted. Thank you!');await load();}catch(e){setMessage(e instanceof Error?e.message:'Could not submit review.');}finally{setBusy(false);}}
 return <section id="reviews" className="pd-reviews" style={{marginTop:28}}><div className="eyebrow">CUSTOMER REVIEWS</div><h2>Customer <em>feedback.</em></h2>
 {data&&<div style={{display:'flex',gap:20,alignItems:'center',margin:'16px 0'}}><div><strong style={{fontSize:32}}>{data.average.toFixed(1)}</strong><Rating value={data.average} count={data.count}/></div><div style={{flex:1,maxWidth:360}}>{[5,4,3,2,1].map(n=><div key={n} style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}><span>{n}★</span><div style={{height:7,background:'var(--border)',borderRadius:9,flex:1,overflow:'hidden'}}><i style={{display:'block',height:'100%',background:'var(--chart-5)',width:`${data.count?data.distribution[String(n)]/data.count*100:0}%`}}/></div><span>{data.distribution[String(n)]||0}</span></div>)}</div></div>}
 {data?.viewer.myReview&&<div className="checkout-card" style={{margin:'16px 0'}}><h3>Your review</h3><p>{data.viewer.myReview.rating}★ — {data.viewer.myReview.comment}</p><button type="button" className="button" onClick={async()=>{if(!confirm('Delete your review?'))return;try{await api(`/api/reviews/${data.viewer.myReview!.id}`,{method:'DELETE'});setMessage('Your review was deleted.');await load();}catch(e){setMessage(e instanceof Error?e.message:'Delete failed.')}}}>Delete my review</button></div>}
 {data?.viewer.canReview&&<form onSubmit={submit} className="checkout-card" style={{margin:'16px 0'}}><h3>Write a review</h3><label>Rating <select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} star{n!==1?'s':''}</option>)}</select></label><label>Title (optional)<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></label><label>Your review<textarea value={comment} onChange={e=>setComment(e.target.value)} required minLength={3} maxLength={2000} rows={4}/></label><button className="button button-orange" disabled={busy}>{busy?'Submitting…':'Submit review'}</button></form>}
 {data&&!data.viewer.signedIn&&<p className="muted-note">Sign in and purchase this product to leave a verified review.</p>}
 {data&&data.viewer.signedIn&&!data.viewer.canReview&&!data.viewer.myReview&&<p className="muted-note">A delivered order is required to review this product.</p>}
 {message&&<p className="muted-note" role="status">{message}</p>}
 <div className="testi-grid">{data?.items.map(r=><article className="testi" key={r.id}><Rating value={r.rating}/>{r.title&&<strong>{r.title}</strong>}<blockquote>{r.comment}</blockquote><small>{r.author} · {r.createdAt?new Date(r.createdAt).toLocaleDateString():''}{r.edited?' · edited':''}</small></article>)}</div>
 {data&&data.count===0&&<p className="muted-note">No reviews yet. Be the first verified buyer to review this product.</p>}
 </section>;
}
