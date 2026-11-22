import {firebaseConfig,adminEmailHash} from './firebase-config.js';
const ready=Boolean(firebaseConfig.apiKey&&firebaseConfig.projectId&&firebaseConfig.appId&&adminEmailHash);
let auth=null,db=null,current=null,authorized=false,busy=false,err='';
async function isAdmin(user){
 if(!user?.emailVerified||!user.email||!user.providerData.some(p=>p.providerId==='google.com'))return false;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.email));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===adminEmailHash;
}
const publicMatch=({a,b,time,court,result})=>({
 a:a??null,b:b??null,time:time??'',court:court??'',
 result:result?{a:result.a??null,b:result.b??null,winner:result.winner??null,bye:Boolean(result.bye)}:null
});
function publicTournament({id,name,date,start,categories}){
 return {id,name,date,start,categories:categories.map(({id,name,pairs,groups,rounds})=>({
  id,name,pairs:pairs.map(({id,name})=>({id,name})),
  groups:groups.map(({name,pairIds,qualify,matches})=>({name,pairIds,qualify,matches:matches.map(publicMatch)})),
  rounds:(rounds||[]).map(({name,matches})=>({name,matches:matches.map(publicMatch)}))
 }))};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(ready){
 try{
 const [{initializeApp},{getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut},{getFirestore,doc,setDoc,serverTimestamp}]=await Promise.all([
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
 import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
 const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,async u=>{current=u;authorized=false;draw();const allowed=await isAdmin(u);if(current!==u)return;authorized=allowed;draw()});
 window.cloudSignIn=async()=>{try{err='';const result=await signInWithPopup(auth,new GoogleAuthProvider());if(!await isAdmin(result.user)){await signOut(auth);err='Aquest compte no té permisos de publicació.';draw()}}catch(e){err=e.message;draw()}};
 window.cloudSignOut=async()=>{await signOut(auth);draw()};
 window.cloudPublish=async()=>{if(!authorized)return;const t=window.getTournamentForPublish();if(!t||busy)return;
 if(!confirm('Publicar els resultats actuals de «'+t.name+'» perquè els vegin els jugadors?'))return;
 busy=true;err='';draw();try{
 const clean=publicTournament(t);
 // No s'envia cap dada privada del gestor: només la fitxa del torneig seleccionat.
 await setDoc(doc(db,'publicTournaments',clean.id),{tournament:clean,updatedAt:serverTimestamp()});
 const url=new URL('./public.html',location.href);url.searchParams.set('t',clean.id);
 window.cloudPublicLink=url.href;alert('Torneig publicat correctament. Enllaç: '+url.href);
 }catch(e){err=e.message}finally{busy=false;draw()}};
 }catch(e){err=e.message}
}
function draw(){const node=document.getElementById('cloud-panel');if(!node)return;
 if(!ready){node.innerHTML='<p>⚙️ Publicació pendent de configurar. Consulta CONFIGURACIO_FIREBASE.md. La gestió local continua funcionant.</p>';return}
 if(!auth){node.textContent='Error de connexió: '+err;return}
 let h='';if(!current)h='<button class="btn primary" onclick="cloudSignIn()">Entrar amb Google (administrador)</button>';
 else if(!authorized)h='<p>Verificant els permisos del compte…</p><button class="btn" onclick="cloudSignOut()">Sortir</button>';
 else h='<div class="formrow"><button class="btn primary" '+(busy?'disabled':'')+' onclick="cloudPublish()">'+(busy?'Publicant…':'Publicar torneig actiu')+'</button><button class="btn" onclick="cloudSignOut()">Tancar sessió</button></div><p>La vista pública només canvia quan publiques. Comparteix l’enllaç de sota.</p>';
 const t=window.getTournamentForPublish();if(t){const url=new URL('./public.html',location.href);url.searchParams.set('t',t.id);h+='<p><a href="'+escape(url.href)+'" target="_blank" rel="noopener">Obrir vista pública del torneig</a></p><button class="btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.querySelector(\'a\').href)">Copiar enllaç</button>'}
 node.innerHTML=h+(err?'<p style="color:#a32">'+escape(err)+'</p>':'');
}
new MutationObserver(()=>{if(document.getElementById('cloud-panel')&&!document.getElementById('cloud-panel').dataset.cloud){document.getElementById('cloud-panel').dataset.cloud='1';draw()}}).observe(document.getElementById('view'),{childList:true,subtree:false});
draw();
