'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Review = {id:number;rating:number;title?:string|null;comment:string};
type ReviewData = {viewer:{canReview:boolean;myReview?:Review|null}};
export function OrderReview({productId,productName,delivered}:{productId:number;productName:string;delivered:boolean}) {
 const [mine,setMine]=useState<Review|null>(null); const [can,setCan]=useState(false); const [open,setOpen]=useState(false); const [rating,setRating]=useState(5); const [title,setTitle]=useState(''); const [comment,setComment]=useState(''); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
 async function load(){const d=await api<ReviewData>(`/api/products/${productId}/reviews`);setMine(d.viewer.myReview||null);setCan(d.viewer.canReview);}
 useEffect(()=>{load().catch(e=>setMsg(e.message));},[productId]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg('');try{const body={rating,title:title.trim()||null,comment:comment.trim()};if(mine)await api(`/api/reviews/${mine.id}`,{method:'PUT',body});else await api(`/api/products/${productId}/reviews`,{method:'POST',body});setOpen(false);setTitle('');setComment('');setMsg('Review saved. It will appear on the homepage reviews.');window.dispatchEvent(new Event('nexora:reviews-updated'));await load();}catch(e){setMsg(e instanceof Error?e.message:'Unable to save review.');}finally{setBusy(false);}}
 async function remove(){if(!mine||!confirm('Delete your review?'))return;setBusy(true);try{await api(`/api/reviews/${mine.id}`,{method:'DELETE'});setMine(null);setCan(true);setMsg('Your review was deleted from product and homepage reviews.');window.dispatchEvent(new Event('nexora:reviews-updated'));}catch(e){setMsg(e instanceof Error?e.message:'Delete failed.');}finally{setBusy(false);}}
 if(!delivered)return null;return <div className="order-review"><b>Review: {productName}</b>{mine?<><small>You reviewed this product ({mine.rating}★).</small><button className="oa-btn" type="button" onClick={()=>{setRating(mine.rating);setTitle(mine.title||'');setComment(mine.comment);setOpen(!open);}}>Edit review</button><button className="oa-btn" type="button" disabled={busy} onClick={remove}>Delete review</button></>:can?<button className="oa-btn primary" type="button" onClick={()=>setOpen(!open)}>Write review</button>:<small>Review eligibility checking…</small>}
 {open&&<form onSubmit={save} className="checkout-card order-review-form"><label>Rating <select value={rating} onChange={e=>setRating(+e.target.value)}>{[5,4,3,2,1].map(n=><option value={n} key={n}>{n} star{n===1?'':'s'}</option>)}</select></label><label>Title (optional)<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></label><label>Review<textarea value={comment} onChange={e=>setComment(e.target.value)} required minLength={3} maxLength={2000}/></label><button className="button button-orange" disabled={busy}>{busy?'Saving…':'Save review'}</button><button className="button" type="button" onClick={()=>setOpen(false)}>Cancel</button></form>}
 {msg&&<small role="status">{msg}</small>}</div>;
}
