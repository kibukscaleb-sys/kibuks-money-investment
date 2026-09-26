const root=document.documentElement;
let currentAction="deposit";

function showNotice(message){
  const toast=document.getElementById("toast");
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>toast.classList.remove("show"),2600);
}

function toggleMenu(){
  document.getElementById("sidebar").classList.toggle("open");
}

function toggleBalance(){
  const amount=document.getElementById("amount");
  const hidden=amount.dataset.hidden==="true";
  amount.textContent=hidden?"UGX 0":"UGX •••••••";
  amount.dataset.hidden=hidden?"false":"true";
}

function applyTheme(theme){
  root.setAttribute("data-theme",theme);
  localStorage.setItem("hut10pro-theme",theme);
  const icon=document.getElementById("themeIcon");
  if(icon) icon.textContent=theme==="dark"?"☾":"☀";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#070a12":"#f4f7fb");
}

function toggleTheme(){
  applyTheme(root.getAttribute("data-theme")==="dark"?"light":"dark");
}

function openAction(type){
  currentAction=type;
  const modal=document.getElementById("modal");
  document.getElementById("modalTitle").textContent=type==="deposit"?"Make a deposit":"Withdraw funds";
  document.getElementById("modalIcon").textContent=type==="deposit"?"＋":"↗";
  document.getElementById("modalText").textContent=type==="deposit"
    ?"Enter an amount. Mobile Money will be connected when the backend is enabled."
    :"Enter an amount. Automatic Mobile Money payout will be connected when the backend is enabled.";
  document.getElementById("modalAmount").value="";
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  setTimeout(()=>document.getElementById("modalAmount").focus(),50);
}

function closeModal(){
  const modal=document.getElementById("modal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
}

function submitAction(){
  const amount=Number(document.getElementById("modalAmount").value);
  if(!amount||amount<=0){
    showNotice("Enter a valid amount in UGX.");
    return;
  }
  showNotice(currentAction==="deposit"
    ?"Deposit flow saved as a demo action — backend comes next."
    :"Withdrawal flow saved as a demo action — backend comes next.");
  closeModal();
}

document.addEventListener("click",(event)=>{
  if(event.target.id==="modal") closeModal();
  if(event.target.closest(".nav-link") && window.innerWidth<=850) toggleMenu();
});

document.addEventListener("keydown",(event)=>{
  if(event.key==="Escape") closeModal();
});

const savedTheme=localStorage.getItem("hut10pro-theme");
applyTheme(savedTheme==="light"?"light":"dark");


/* HUT 10 PRO cinematic background animation */
(function hutVideoBackground(){
  const atmosphere=document.querySelector('.ai-atmosphere');
  if(!atmosphere || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let t=0;
  function frame(){
    t+=0.0025;
    const x=Math.sin(t)*18, y=Math.cos(t*.82)*10;
    atmosphere.style.setProperty('--drift-x',x.toFixed(2)+'px');
    atmosphere.style.setProperty('--drift-y',y.toFixed(2)+'px');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* HUT 10 PRO authentication session bridge */
let hut10Supabase=null;

async function loadDashboardData(){
  if(!window.HUT10Data) return;
  try{
    const user=await window.HUT10Data.init();
    if(!user) return;
    const data=await window.HUT10Data.load();
    const wallet=data.wallet?.[0]||{};
    const balance=Number(wallet.balance ?? wallet.available_balance ?? wallet.amount ?? 0) || 0;
    const invested=window.HUT10Data.sum(data.investments,["principal","principal_amount","amount","invested_amount"]);
    const profit=window.HUT10Data.sum(data.investments,["profit","profit_amount","earnings","return_amount"]);
    const plans=(data.investments||[]).length;
    const active=(data.investments||[]).filter(row=>!row.status || ["active","running","approved"].includes(String(row.status).toLowerCase())).length;
    const fmt=n=>"UGX "+Number(n||0).toLocaleString("en-UG");
    const byId=(id)=>document.getElementById(id);
    if(byId("amount")) byId("amount").textContent=fmt(balance);
    if(byId("availableBalance")) byId("availableBalance").textContent=fmt(balance);
    if(byId("totalInvested")) byId("totalInvested").textContent=fmt(invested);
    if(byId("profitValue")) byId("profitValue").textContent=fmt(profit);
    if(byId("planCount")) byId("planCount").textContent=plans+" plan"+(plans===1?"":"s");
    if(byId("activePlans")) byId("activePlans").textContent=active;
    if(byId("performance")) byId("performance").textContent=invested>0?((profit/invested)*100).toFixed(2)+"%":"0.00%";
  }catch(error){ console.error("HUT 10 PRO data load failed",error); }
}

async function initDashboardAuth(){
  const cfg=window.HUT10_SUPABASE_CONFIG;
  if(!cfg || !cfg.url || !cfg.key || cfg.url.includes('PASTE_YOUR_') || cfg.key.includes('PASTE_YOUR_')){
    const savedName=localStorage.getItem('hut10_name')||'HUT 10 PRO';
    updateTopUser(savedName);
    return;
  }
  try{
    hut10Supabase=window.supabase.createClient(cfg.url,cfg.key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
    const {data:{session}}=await hut10Supabase.auth.getSession();
    if(!session){
      window.location.href='auth.html';
      return;
    }
    const {data,error}=await hut10Supabase.auth.getUser();
    if(error) throw error;
    const user=data.user;
    const name=user.user_metadata?.full_name || user.email?.split('@')[0] || 'HUT 10 PRO';
    updateTopUser(name);
    localStorage.setItem('hut10_email',user.email||'');
    localStorage.setItem('hut10_session','active');
    await loadDashboardData();
    hut10Supabase.auth.onAuthStateChange((event, nextSession)=>{
      if(event==='SIGNED_OUT' || !nextSession) window.location.href='auth.html';
    });
  }catch(error){
    showNotice('Authentication connection error. Check Supabase settings.');
    console.error(error);
  }
}
function updateTopUser(name){
  const avatar=document.getElementById('topAvatar');
  const user=document.getElementById('topUser');
  if(avatar) avatar.textContent=name.charAt(0).toUpperCase();
  if(user) user.textContent=name;
}
async function signOutUser(){
  if(hut10Supabase){
    const {error}=await hut10Supabase.auth.signOut({scope:'local'});
    if(error){showNotice(error.message);return;}
  }
  localStorage.removeItem('hut10_session');
  showNotice('Signed out.');
  setTimeout(()=>window.location.href='auth.html',350);
}
document.addEventListener('DOMContentLoaded',initDashboardAuth);