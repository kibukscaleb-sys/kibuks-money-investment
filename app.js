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