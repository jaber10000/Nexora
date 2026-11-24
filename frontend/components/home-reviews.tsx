'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {Rating} from '@/components/rating';
type Item={id:number;productId:number;productName?:string;rating:number;title?:string|null;comment:string;author:string;createdAt?:string|null};
export function HomeReviews(){
 const [items,setItems]=useState<Item[]>([]);
 const load=useCallback(async()=>{try{const r=await api<{items:Item[]}>('/api/reviews/recent?limit=12');setItems((r.items||[]).slice().sort((a,b)=>{const ta=a.createdAt?Date.parse(a.createdAt):0;const tb=b.createdAt?Date.parse(b.createdAt):0;return tb-ta||b.id-a.id;}));}catch{/* Keep the last successful feed visible during transient errors. */}},[]);
 useEffect(()=>{void load();const onUpdate=()=>void load();const onVisible=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('nexora:reviews-updated',onUpdate);window.addEventListener('focus',onUpdate);document.addEventListener('visibilitychange',onVisible);const timer=window.setInterval(()=>void load(),30000);return()=>{window.removeEventListener('nexora:reviews-updated',onUpdate);window.removeEventListener('focus',onUpdate);document.removeEventListener('visibilitychange',onVisible);window.clearInterval(timer);};},[load]);
 if(!items.length)return null;
 return <section className="section"><div className="section-heading"><div><h2>What customers say</h2><p className="muted">Reviews from verified buyers after delivery.</p></div></div><div className="testi-grid">{items.map(r=><article className="testi" key={r.id}><Rating value={r.rating}/>{r.title&&<strong>{r.title}</strong>}<blockquote>“{r.comment}”</blockquote><small><b>{r.author}</b> · {r.productName||'Product'}{r.createdAt?` · ${new Date(r.createdAt).toLocaleDateString()}`:''}</small></article>)}</div></section>
}
