/* MONEYLOG PWA — local-first encrypted personal finance journal */
const APP_VERSION = '2.1.0';
const UPDATE_MANIFEST_URL = './version.json';
const DB_NAME = 'moneylog-secure-v2';
const DB_VERSION = 1;
const PBKDF2_ITERATIONS = 220000;
const REMIND_LATER_MS = 6 * 60 * 60 * 1000;
const CURRENCIES = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹' };
const DEFAULT_CATEGORIES = {
  expense: ['Food','Transport','Shopping','Bills','Education','Health','Entertainment','Housing','Family','Personal','Other'],
  income: ['Salary','Freelance','Business','Gift','Interest','Other']
};
const ICONS = {
  home:'⌂', history:'◷', insights:'◒', settings:'⚙', lock:'⌁', eye:'◉', plus:'＋', arrow:'→',
  income:'↙', expense:'↗', transfer:'⇄', wallet:'▣', goal:'◎', repeat:'↻', bell:'◔', shield:'◇',
  search:'⌕', edit:'✎', trash:'⌫', down:'⌄', up:'⌃', check:'✓', close:'×', moon:'◐', sun:'☼'
};

let db = null;
let sessionKey = null;
let state = null;
let currentTab = 'home';
let historyFilters = { q:'', type:'all', account:'all', category:'all', from:'', to:'' };
let modalCloseTimer = null;
let deferredInstallPrompt = null;
let autoLockTimer = null;
let updateInfo = null;

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off*60000).toISOString().slice(0,10);
};
const monthKey = d => d.slice(0,7);
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function formatMoney(minor, stateOverride=state, short=false){
  const currency = stateOverride?.settings?.currency || 'BDT';
  const symbol = CURRENCIES[currency] || currency;
  const n = Math.abs(Number(minor||0))/100;
  const text = n.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(short && n >= 1000000) return `${symbol}${(n/1000000).toFixed(1)}m`;
  if(short && n >= 1000) return `${symbol}${(n/1000).toFixed(1)}k`;
  return `${symbol}${text}`;
}
function amountMajorToMinor(v){
  const n = Number(v);
  if(!Number.isFinite(n) || n <= 0) return null;
  const minor = Math.round(n*100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}
function signedMoney(minor,type){
  const sign = type==='expense'?'−':type==='income'?'+':'';
  return sign + formatMoney(Math.abs(minor));
}
function fmtDate(date){
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-BD',{month:'short',day:'numeric',year:'numeric'});
}
function fmtCompactDate(date){
  if(date===todayISO()) return 'Today';
  const yesterday = new Date(`${todayISO()}T00:00:00`); yesterday.setDate(yesterday.getDate()-1);
  if(date===yesterday.toISOString().slice(0,10)) return 'Yesterday';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-BD',{month:'short',day:'numeric'});
}
function monthLabel(key){
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-BD',{month:'long',year:'numeric'});
}
function dateRange(kind){
  const today = new Date(`${todayISO()}T00:00:00`);
  let from = new Date(today), to = new Date(today);
  if(kind==='thisMonth') from.setDate(1);
  else if(kind==='lastMonth'){ from = new Date(today.getFullYear(), today.getMonth()-1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); }
  else if(kind==='3Months'){ from = new Date(today.getFullYear(), today.getMonth()-2, 1); }
  else if(kind==='year'){ from = new Date(today.getFullYear(),0,1); }
  else if(kind==='week'){ const day=today.getDay()||7; from.setDate(today.getDate()-day+1); }
  return {from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded = () => {
      const d=req.result;
      if(!d.objectStoreNames.contains('meta')) d.createObjectStore('meta',{keyPath:'key'});
      if(!d.objectStoreNames.contains('vault')) d.createObjectStore('vault',{keyPath:'key'});
      if(!d.objectStoreNames.contains('publicPrefs')) d.createObjectStore('publicPrefs',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function idbGet(storeName,key){
  return new Promise((resolve,reject)=>{const r=db.transaction(storeName,'readonly').objectStore(storeName).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
function idbPut(storeName,value){
  return new Promise((resolve,reject)=>{const r=db.transaction(storeName,'readwrite').objectStore(storeName).put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error);});
}
function idbDelete(storeName,key){
  return new Promise((resolve,reject)=>{const r=db.transaction(storeName,'readwrite').objectStore(storeName).delete(key);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});
}
function idbClear(storeName){
  return new Promise((resolve,reject)=>{const r=db.transaction(storeName,'readwrite').objectStore(storeName).clear();r.onsuccess=resolve;r.onerror=()=>reject(r.error);});
}

function bytesToB64(bytes){let s='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)s+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(s);}
function b64ToBytes(b64){const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr;}
async function deriveKey(password,salt){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},base,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
}
async function encryptText(text,key){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));
  return {iv:bytesToB64(iv),data:bytesToB64(new Uint8Array(cipher))};
}
async function decryptText(payload,key){
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(payload.iv)},key,b64ToBytes(payload.data));
  return new TextDecoder().decode(plain);
}
async function exportKeyRaw(key){return new Uint8Array(await crypto.subtle.exportKey('raw',key));}
async function importKeyRaw(bytes){return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function createRecoveryProfile(username,recoveryCode,key=sessionKey){
  const u=username.trim(); const c=recoveryCode.trim();
  if(u.length<2) throw new Error('RECOVERY_USERNAME');
  if(c.length<8) throw new Error('RECOVERY_CODE');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const recoveryKey=await deriveKey(c,salt);
  const wrapped=await encryptText(bytesToB64(await exportKeyRaw(key)),recoveryKey);
  await idbPut('meta',{key:'recovery',username:u,salt:bytesToB64(salt),wrapped});
}
async function recoverPassword(username,recoveryCode,newPassword){
  const meta=await idbGet('meta','security');
  const recovery=await idbGet('meta','recovery');
  if(!meta||!recovery) throw new Error('NO_RECOVERY');
  if(username.trim().toLowerCase()!==String(recovery.username).trim().toLowerCase()) throw new Error('WRONG_RECOVERY');
  const recoveryKey=await deriveKey(recoveryCode.trim(),b64ToBytes(recovery.salt));
  const raw=await decryptText(recovery.wrapped,recoveryKey);
  const recoveredKey=await importKeyRaw(b64ToBytes(raw));
  const vault=await idbGet('vault','main');
  const nextState=vault?validateState(JSON.parse(await decryptText(vault,recoveredKey))):defaultState();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const newKey=await deriveKey(newPassword,salt);
  const check=await encryptText('MONEYLOG-PASSWORD-CHECK-v3',newKey);
  const newRecoveryKey=await deriveKey(recoveryCode.trim(),b64ToBytes(recovery.salt));
  const newWrapped=await encryptText(bytesToB64(await exportKeyRaw(newKey)),newRecoveryKey);
  await idbPut('meta',{key:'security',salt:bytesToB64(salt),check});
  await idbPut('meta',{key:'recovery',username:recovery.username,salt:recovery.salt,wrapped:newWrapped});
  sessionKey=newKey; state=nextState; await saveVault(); await syncPublicPrefs();
}
async function ensureRecoveryProfile(){
  const existing=await idbGet('meta','recovery');
  if(existing){if(state&&!state.settings.username){state.settings.username=existing.username;await saveVault();}return;}
  await new Promise(resolve=>{
    modal('Secure your recovery',`<p class="muted">MONEYLOG now uses a username + password + recovery code. Your username is only stored on this device; it is not an online account.</p><form id="recovery-setup-form"><div class="field"><label>Username</label><input id="recovery-username" class="input" minlength="2" maxlength="40" required placeholder="Your local username"></div><div class="field" style="margin-top:12px"><label>Recovery code</label><input id="recovery-code" class="input" minlength="8" maxlength="64" required placeholder="Create a code you will remember"></div><div class="install-hint" style="margin-top:12px"><strong>Save this recovery code somewhere safe.</strong><br>It is the only supported way to reset your MONEYLOG password. MONEYLOG cannot email or retrieve it for you.</div><div class="modal-actions"><button type="submit" class="btn btn-primary">Save recovery method</button></div></form>`,{wide:false});
    const form=$('#recovery-setup-form'); if(!form){resolve();return;}
    form.addEventListener('submit',async e=>{e.preventDefault();try{await createRecoveryProfile($('#recovery-username').value,$('#recovery-code').value);state.settings.username=$('#recovery-username').value.trim();await saveVault();closeModal();resolve();showToast('Recovery method saved.');}catch(err){showToast(err.message==='RECOVERY_USERNAME'?'Enter a username.':'Use a recovery code of at least 8 characters.');}});
  });
}

async function createPassword(password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await deriveKey(password,salt);
  const check=await encryptText('MONEYLOG-PASSWORD-CHECK-v2',key);
  await idbPut('meta',{key:'security',salt:bytesToB64(salt),check});
  sessionKey=key;
}
async function unlockPassword(password){
  const meta=await idbGet('meta','security');
  if(!meta) throw new Error('NO_PASSWORD');
  const key=await deriveKey(password,b64ToBytes(meta.salt));
  const check=await decryptText(meta.check,key);
  if(check!=='MONEYLOG-PASSWORD-CHECK-v2' && check!=='MONEYLOG-PASSWORD-CHECK-v3') throw new Error('WRONG_PASSWORD');
  const vault=await idbGet('vault','main');
  if(vault){ const raw=await decryptText(vault,key); state=validateState(JSON.parse(raw)); }
  else state=defaultState();
  sessionKey=key;
  await saveVault();
  await processRecurring();
  await syncPublicPrefs();
}
async function saveVault(){
  if(!sessionKey||!state) return;
  const payload=await encryptText(JSON.stringify(state),sessionKey);
  await idbPut('vault',{key:'main',...payload});
  await syncPublicPrefs();
}
function defaultState(){
  return {
    version:2,
    accounts:[{id:uuid(),name:'Cash',type:'Cash',openingMinor:0,description:'',archived:false}],
    transactions:[],
    categories:{expense:DEFAULT_CATEGORIES.expense.map(name=>({id:uuid(),name,archived:false})),income:DEFAULT_CATEGORIES.income.map(name=>({id:uuid(),name,archived:false}))},
    budgets:{overallMinor:0,category:{}},
    goals:[],
    recurring:[],
    settings:{currency:'BDT',theme:'system',hideAmounts:false,defaultAccountId:null,reminderEnabled:false,reminderTime:'20:30',autoLock:'15',lastReminderDate:'',lastBackupAt:'',firstDayTip:true,installChoice:'',durableBackupName:'moneylog-vault.moneylog'}
  };
}
function normalizeAccounts(accounts,transactions,settings){
  const list=Array.isArray(accounts)?accounts.map(a=>({...a,id:a.id||uuid(),name:String(a.name||'').trim()||'Account',openingMinor:Number(a.openingMinor||0)})):[];
  const removed=new Set();
  for(let i=0;i<list.length;i++){
    const a=list[i]; if(removed.has(a.id)) continue;
    for(let j=i+1;j<list.length;j++){
      const b=list[j]; if(removed.has(b.id)) continue;
      if(a.name.toLowerCase()==='cash' && b.name.toLowerCase()==='cash' && a.type===b.type && Number(b.openingMinor||0)===0 && !(transactions||[]).some(t=>t.accountId===b.id||t.toAccountId===b.id)){removed.add(b.id);}
    }
  }
  const filtered=list.filter(a=>!removed.has(a.id));
  for(const t of transactions||[]){if(removed.has(t.accountId))t.accountId=filtered.find(a=>a.name.toLowerCase()==='cash')?.id||filtered[0]?.id||'';if(removed.has(t.toAccountId))t.toAccountId=filtered.find(a=>a.name.toLowerCase()==='cash')?.id||filtered[0]?.id||'';}
  if(settings&&removed.has(settings.defaultAccountId))settings.defaultAccountId=filtered.find(a=>!a.archived)?.id||filtered[0]?.id||null;
  return filtered.length?filtered:[{id:uuid(),name:'Cash',type:'Cash',openingMinor:0,description:'',archived:false}];
}

function validateState(s){
  const d=defaultState();
  s=s&&typeof s==='object'?s:{};
  const transactions=Array.isArray(s.transactions)?s.transactions.map(t=>({...t,id:t.id||uuid(),amountMinor:Number(t.amountMinor||0)})):[];
  const settings={...d.settings,...(s.settings||{})};
  const accounts=normalizeAccounts(s.accounts,transactions,settings);
  return {
    version:2,
    accounts,
    transactions,
    categories:{expense:Array.isArray(s.categories?.expense)?s.categories.expense:d.categories.expense,income:Array.isArray(s.categories?.income)?s.categories.income:d.categories.income},
    budgets:{overallMinor:Number(s.budgets?.overallMinor||0),category:s.budgets?.category||{}},
    goals:Array.isArray(s.goals)?s.goals:[],
    recurring:Array.isArray(s.recurring)?s.recurring:[],
    settings
  };
}

async function setupPassword(){
  renderAuth('setup');
  $('#setup-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const username=$('#setup-username').value.trim(),p=$('#setup-password').value,c=$('#setup-confirm').value,recovery=$('#setup-recovery').value.trim(),recoveryConfirm=$('#setup-recovery-confirm').value.trim();
    if(username.length<2)return showToast('Enter a username.');
    if(p.length<8)return showToast('Use at least 8 characters for your password.');
    if(p!==c)return showToast('The passwords do not match.');
    if(recovery.length<8)return showToast('Use at least 8 characters for your recovery code.');
    if(recovery!==recoveryConfirm)return showToast('The recovery codes do not match.');
    try{ await createPassword(p); state=defaultState(); state.settings.defaultAccountId=state.accounts[0].id; state.settings.username=username; await createRecoveryProfile(username,recovery); await saveVault(); await finishUnlock(); showToast('MONEYLOG is ready.'); }
    catch(err){console.error(err);showToast('Could not create the secure vault.');}
  });
}

async function login(){
  renderAuth('login');
  $('#login-form').addEventListener('submit',async e=>{
    e.preventDefault();
    try{ await unlockPassword($('#login-password').value); await finishUnlock(); }
    catch(err){const msg=err?.message==='WRONG_PASSWORD'?'That password is not correct.':'Could not open your vault.';showToast(msg);$('#login-password').select();}
  });
}
function recoveryPasswordForm(){
  modal('Recover your MONEYLOG',`<p class="muted">Use the username and recovery code you created on first setup. This works only on this device because MONEYLOG has no online account system.</p><form id="recover-form"><div class="field"><label>Username</label><input id="recover-username" class="input" required></div><div class="field" style="margin-top:12px"><label>Recovery code</label><input id="recover-code" class="input" required></div><div class="field" style="margin-top:12px"><label>New password</label><input id="recover-new" class="input" type="password" minlength="8" required></div><div class="field" style="margin-top:12px"><label>Confirm new password</label><input id="recover-confirm" class="input" type="password" minlength="8" required></div><div class="install-hint" style="margin-top:12px">Your recovery code is not stored in plain text. Keep it somewhere safe after this reset.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary">Reset password</button></div></form>`);
  $('#recover-form').addEventListener('submit',async e=>{e.preventDefault();const n=$('#recover-new').value,c=$('#recover-confirm').value;if(n.length<8||n!==c)return showToast('Check the new password.');try{await recoverPassword($('#recover-username').value,$('#recover-code').value,n);closeModal();await finishUnlock();showToast('Password reset successfully.');}catch(err){showToast(err.message==='NO_RECOVERY'?'No recovery method is configured for this vault.':'The username or recovery code is not correct.');}});
}

async function finishUnlock(){
  applyTheme();
  resetAutoLockTimer();
  await ensureRecoveryProfile();
  await checkForUpdate(true);
  renderApp();
  maybeShowInstallChoice();
}
function lockApp(silent=false){
  sessionKey=null; state=null; clearTimeout(autoLockTimer); renderAuth('login'); if(!silent)showToast('MONEYLOG locked.');
}
function resetAutoLockTimer(){
  clearTimeout(autoLockTimer);
  const minutes=Number(state?.settings?.autoLock||0);
  if(!minutes) return;
  autoLockTimer=setTimeout(()=>lockApp(true),minutes*60*1000);
}
function handleVisibility(){
  if(!state) return;
  if(document.visibilityState==='hidden') state.__hiddenAt=Date.now();
  else {
    if(state.__hiddenAt && Number(state.settings.autoLock||0)>0 && Date.now()-state.__hiddenAt >= Number(state.settings.autoLock)*60000){ lockApp(true); return; }
    resetAutoLockTimer();
    checkReminderDue();
  }
}

function applyTheme(){
  const pref=state?.settings?.theme||'system';
  document.documentElement.dataset.theme=pref==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):pref;
}

function navItem(tab,label,ico){return `<button data-tab="${tab}" class="${currentTab===tab?'active':''}"><span class="nav-ico">${ico}</span><span>${label}</span></button>`;}
function appShell(content){
  const update = updateInfo ? `<div class="update-banner"><div><strong>${esc(updateInfo.title||'New MONEYLOG update')}</strong><small>${esc((updateInfo.notes||[]).slice(0,2).join(' · '))}</small></div><button class="btn btn-primary btn-update" data-action="open-update">Update</button></div>` : '';
  return `<div class="app-shell">
    <aside class="sidebar"><div class="brand"><div class="brand-name">MONEY<span>LOG</span></div><div class="brand-tag">PERSONAL MONEY JOURNAL</div></div>
      <nav class="nav">${navItem('home','Home',ICONS.home)}${navItem('history','History',ICONS.history)}${navItem('insights','Insights',ICONS.insights)}${navItem('settings','Settings',ICONS.settings)}</nav>
      <div class="sidebar-spacer"></div><div class="side-card"><strong>${state.accounts.filter(a=>!a.archived).length} active accounts</strong><small>Your records stay on this device.</small></div><button class="btn btn-ghost" data-action="lock">${ICONS.lock} Lock MONEYLOG</button></aside>
    <main class="main"><div class="content">${update}${content}</div></main>
    <nav class="mobile-nav">${navItem('home','Home',ICONS.home)}${navItem('history','History',ICONS.history)}${navItem('insights','Insights',ICONS.insights)}${navItem('settings','Settings',ICONS.settings)}<button data-action="lock">${ICONS.lock}<span>Lock</span></button></nav>
  </div><footer class="app-footer">Made with <span>♥</span> by nashihab</footer>${currentTab!=='settings'?`<button class="fab" data-action="add">${ICONS.plus}</button>`:''}`;
}
function renderApp(){
  if(!state||!sessionKey){renderAuth('login');return;}
  applyTheme();
  let content='';
  if(currentTab==='home')content=homeView();
  else if(currentTab==='history')content=historyView();
  else if(currentTab==='insights')content=insightsView();
  else content=settingsView();
  $('#app').innerHTML=appShell(content);
}
function renderAuth(mode){
  document.documentElement.dataset.theme='light';
  if(mode==='setup'){
    $('#app').innerHTML=`<div class="auth"><div class="auth-card glass"><div class="auth-brand"><div class="brand-name">MONEY<span>LOG</span></div><div class="brand-tag">PERSONAL MONEY JOURNAL</div></div><h1 class="auth-title">Create your private MONEYLOG.</h1><p class="auth-copy">Set a local username, password, and recovery code. Nothing is sent to a server.</p><form id="setup-form"><div class="field"><label>Username</label><input id="setup-username" class="input" minlength="2" maxlength="40" autocomplete="username" required placeholder="Choose a local username"></div><div class="field" style="margin-top:12px"><label>Password</label><div class="password-wrap"><input id="setup-password" class="input" type="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters"><button class="reveal" type="button" data-action="toggle-pass" data-target="setup-password">◉</button></div></div><div class="field" style="margin-top:12px"><label>Confirm password</label><input id="setup-confirm" class="input" type="password" minlength="8" autocomplete="new-password" required placeholder="Enter it again"></div><div class="field" style="margin-top:12px"><label>Recovery code</label><input id="setup-recovery" class="input" minlength="8" maxlength="64" required placeholder="Create a recovery code"></div><div class="field" style="margin-top:12px"><label>Confirm recovery code</label><input id="setup-recovery-confirm" class="input" minlength="8" maxlength="64" required placeholder="Enter it again"></div><div class="install-hint" style="margin-top:14px"><strong>Do not lose the recovery code.</strong><br>MONEYLOG cannot email it or recover it for you. It is your password-reset method.</div><button class="btn btn-primary" style="width:100%;margin-top:14px">Create MONEYLOG</button></form><div class="auth-footer">Made with <span>♥</span> by nashihab</div></div></div>`;
  } else {
    $('#app').innerHTML=`<div class="auth"><div class="auth-card glass"><div class="auth-brand"><div class="brand-name">MONEY<span>LOG</span></div><div class="brand-tag">PERSONAL MONEY JOURNAL</div></div><h1 class="auth-title">Welcome back.</h1><p class="auth-copy">Enter your username and password to unlock your private vault.</p><form id="login-form"><div class="field"><label>Username</label><input id="login-username" class="input" autocomplete="username" required placeholder="Your MONEYLOG username"></div><div class="field" style="margin-top:12px"><label>Password</label><div class="password-wrap"><input id="login-password" class="input" type="password" autocomplete="current-password" required placeholder="Your MONEYLOG password"><button class="reveal" type="button" data-action="toggle-pass" data-target="login-password">◉</button></div></div><button class="btn btn-primary" style="width:100%;margin-top:14px">Unlock MONEYLOG</button></form><button class="btn btn-ghost" style="width:100%;margin-top:8px" data-action="forgot-password">Forgot password? Use recovery code</button><div class="install-hint" style="margin-top:14px">Your financial data stays on this device. Use the installed web app for the safest storage experience.</div><div class="auth-footer">Made with <span>♥</span> by nashihab</div></div></div>`;
    $('#login-form').addEventListener('submit',async e=>{e.preventDefault();try{const entered=$('#login-username').value.trim();const recoveryMeta=await idbGet('meta','recovery');if(recoveryMeta&&entered.toLowerCase()!==String(recoveryMeta.username).toLowerCase())throw new Error('WRONG_USER');await unlockPassword($('#login-password').value);await finishUnlock();}catch(err){const msg=err?.message==='WRONG_USER'?'That username is not correct.':err?.message==='WRONG_PASSWORD'?'That password is not correct.':'Could not open your vault.';showToast(msg);$('#login-password').select();}});
  }
}

function currentMonthTransactions(){return state.transactions.filter(t=>t.date.startsWith(monthKey(todayISO())));}
function balanceForAccount(accountId){
  const a=state.accounts.find(x=>x.id===accountId); if(!a)return 0;
  return a.openingMinor + state.transactions.reduce((sum,t)=>{
    if(t.type==='income' && t.accountId===accountId)return sum+t.amountMinor;
    if(t.type==='expense' && t.accountId===accountId)return sum-t.amountMinor;
    if(t.type==='transfer'){ if(t.accountId===accountId)sum-=t.amountMinor; if(t.toAccountId===accountId)sum+=t.amountMinor; }
    return sum;
  },0);
}
function totalBalance(){return state.accounts.reduce((sum,a)=>sum+(a.archived?0:balanceForAccount(a.id)),0);}
function periodTotals(from,to){return state.transactions.filter(t=>t.date>=from&&t.date<=to).reduce((r,t)=>{if(t.type==='income')r.income+=t.amountMinor;if(t.type==='expense')r.expense+=t.amountMinor;return r},{income:0,expense:0});}
function getCurrentTotals(){const r=dateRange('thisMonth');return periodTotals(r.from,r.to);}
function categoryName(type,id){return state.categories[type]?.find(c=>c.id===id)?.name||id||'Other';}
function accountName(id){return state.accounts.find(a=>a.id===id)?.name||'Unknown account';}
function categoryIdFromName(type,name){return state.categories[type]?.find(c=>c.name===name)?.id || '';}
function accountOptions(selected,includeArchived=false){return state.accounts.filter(a=>includeArchived||!a.archived).map(a=>`<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('');}
function categoryOptions(type,selected){return state.categories[type].filter(c=>!c.archived).map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('');}
function recentTransactions(n=6){return state.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||String(b.id).localeCompare(String(a.id))).slice(0,n);}
function transactionRow(t,compact=false){
  const label=t.type==='transfer'?`${accountName(t.accountId)} → ${accountName(t.toAccountId)}`:categoryName(t.type,t.categoryId);
  const sub=t.type==='transfer'?'Transfer':`${accountName(t.accountId)}${t.note?` · ${t.note}`:''}`;
  const icon=t.type==='income'?ICONS.income:t.type==='expense'?ICONS.expense:ICONS.transfer;
  const sign=t.type==='expense'?'negative':t.type==='income'?'positive':'';
  return `<button class="list-row" data-action="edit-tx" data-id="${esc(t.id)}" style="width:100%;background:none;border:0;color:inherit;text-align:left"><span class="avatar">${icon}</span><span class="grow"><strong class="truncate">${esc(label)}</strong><small class="truncate">${esc(sub)} · ${esc(fmtCompactDate(t.date))}</small></span><span class="money ${sign}">${esc(signedMoney(t.amountMinor,t.type))}</span></button>`;
}
function homeView(){
  const totals=getCurrentTotals();
  const remaining = state.budgets.overallMinor ? state.budgets.overallMinor - totals.expense : null;
  const activeAccounts=state.accounts.filter(a=>!a.archived);
  const goals=state.goals.filter(g=>!g.archived).slice(0,2);
  const latest=recentTransactions(5);
  const hide=state.settings.hideAmounts;
  const accDefault=state.settings.defaultAccountId||activeAccounts[0]?.id;
  return `<div class="topbar"><div><div class="kicker">${greeting()}</div><h1 class="page-title">Your money, clearly.</h1></div><div class="top-actions"><button class="btn btn-soft optional" data-action="quick-income">${ICONS.income} Income</button><button class="btn btn-primary" data-action="add">${ICONS.plus} Add</button></div></div>
  <section class="hero"><div class="hero-row"><div><div class="kicker label">TOTAL AVAILABLE</div><div class="hero-amount">${hide?'••••••••':esc(formatMoney(totalBalance()))}</div><small class="label">Across ${activeAccounts.length} active account${activeAccounts.length===1?'':'s'}</small></div><button class="btn btn-soft" data-action="toggle-hide">${ICONS.eye} ${hide?'Show':'Hide'}</button></div></section>
  <div class="grid grid-4 section"><div class="card stat"><div class="label">THIS MONTH · IN</div><strong class="income">${hide?'••••':esc(formatMoney(totals.income,true))}</strong></div><div class="card stat"><div class="label">THIS MONTH · OUT</div><strong class="expense">${hide?'••••':esc(formatMoney(totals.expense,true))}</strong></div><div class="card stat"><div class="label">NET FLOW</div><strong class="${totals.income-totals.expense>=0?'income':'expense'}">${hide?'••••':esc(formatMoney(totals.income-totals.expense,true))}</strong></div><div class="card stat"><div class="label">BUDGET LEFT</div><strong>${hide?'••••':remaining===null?'—':esc(formatMoney(remaining,true))}</strong></div></div>
  <div class="section"><div class="section-head"><h2>Quick add</h2><span class="mini">Few taps. Done.</span></div><div class="quick-grid"><button class="quick" data-action="quick-expense"><span class="qicon expense">${ICONS.expense}</span><span><strong>Expense</strong><small>Food, transport, bills…</small></span></button><button class="quick" data-action="quick-income"><span class="qicon income">${ICONS.income}</span><span><strong>Income</strong><small>Salary, freelance…</small></span></button><button class="quick" data-action="quick-transfer"><span class="qicon">${ICONS.transfer}</span><span><strong>Transfer</strong><small>Move between accounts</small></span></button></div></div>
  <div class="section"><div class="section-head"><h2>Recent activity</h2><button class="btn btn-ghost" data-tab="history">See all ${ICONS.arrow}</button></div><div class="card">${latest.length?`<div class="list">${latest.map(transactionRow).join('')}</div>`:`<div class="empty"><strong>Your journal starts here.</strong>Add your first expense or income and MONEYLOG will handle the math.</div>`}</div></div>
  <div class="section"><div class="section-head"><h2>Your accounts</h2><button class="btn btn-ghost" data-tab="settings">Manage</button></div><div class="accounts-grid">${activeAccounts.slice(0,3).map(a=>`<button class="account-card" data-action="edit-account" data-id="${esc(a.id)}" style="text-align:left"><span class="pill">${esc(a.type)}</span><strong class="truncate" style="margin-top:8px">${esc(a.name)}</strong><div class="amount">${hide?'••••':esc(formatMoney(balanceForAccount(a.id)))}</div><small class="muted">Current balance</small></button>`).join('')}</div></div>
  ${state.budgets.overallMinor?`<div class="section"><div class="card"><div class="section-head"><h2>Monthly budget</h2><span class="pill">${remaining<0?'Over budget':'On track'}</span></div><div class="row" style="justify-content:space-between;margin-bottom:9px"><span class="mini">${esc(formatMoney(totals.expense))} spent of ${esc(formatMoney(state.budgets.overallMinor))}</span><strong>${Math.round(clamp(totals.expense/state.budgets.overallMinor*100,0,999))}%</strong></div><div class="progress"><span style="width:${clamp(totals.expense/state.budgets.overallMinor*100,0,100)}%;background:${remaining<0?'var(--expense)':'var(--brand)'}"></span></div></div></div>`:''}
  ${goals.length?`<div class="section"><div class="section-head"><h2>Goals</h2><button class="btn btn-ghost" data-action="add-goal">Add</button></div><div class="goal-grid">${goals.map(goalCard).join('')}</div></div>`:''}`;
}
function goalCard(g){const pct=clamp(g.currentMinor/g.targetMinor*100,0,100);return `<button class="card" data-action="edit-goal" data-id="${esc(g.id)}" style="text-align:left"><div class="row" style="justify-content:space-between"><span class="pill">${ICONS.goal} Goal</span><strong>${Math.round(pct)}%</strong></div><h3 style="margin:13px 0 3px">${esc(g.name)}</h3><small class="muted">${esc(formatMoney(g.currentMinor))} of ${esc(formatMoney(g.targetMinor))}</small><div class="progress" style="margin-top:11px"><span style="width:${pct}%"></span></div></button>`;}
function historyView(){
  const cats=[...new Set(state.transactions.filter(t=>t.type!=='transfer').map(t=>categoryName(t.type,t.categoryId)))].sort();
  const rows=filteredTransactions();
  return `<div class="topbar"><div><div class="kicker">YOUR JOURNAL</div><h1 class="page-title">History</h1></div><div class="top-actions"><button class="btn btn-soft" data-action="export-csv">Export CSV</button><button class="btn btn-primary" data-action="add">${ICONS.plus} Add</button></div></div>
  <div class="card"><div class="filters"><input class="input search" id="history-q" placeholder="Search notes, categories, accounts…" value="${esc(historyFilters.q)}"><select class="select" id="history-type"><option value="all">All types</option><option value="expense" ${historyFilters.type==='expense'?'selected':''}>Expenses</option><option value="income" ${historyFilters.type==='income'?'selected':''}>Income</option><option value="transfer" ${historyFilters.type==='transfer'?'selected':''}>Transfers</option></select><select class="select" id="history-account"><option value="all">All accounts</option>${accountOptions(historyFilters.account==='all'?'':historyFilters.account,true)}</select><select class="select" id="history-category"><option value="all">All categories</option>${cats.map(c=>`<option ${historyFilters.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select><input class="input" id="history-from" type="date" value="${esc(historyFilters.from)}"><input class="input" id="history-to" type="date" value="${esc(historyFilters.to)}"></div></div>
  <div class="section"><div class="section-head"><h2>${rows.length} record${rows.length===1?'':'s'}</h2><button class="btn btn-ghost" data-action="clear-filters">Clear filters</button></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Entry</th><th>Account</th><th>Type</th><th>Amount</th></tr></thead><tbody>${rows.map(t=>`<tr data-action="edit-tx" data-id="${esc(t.id)}" style="cursor:pointer"><td>${esc(fmtDate(t.date))}</td><td><strong>${esc(t.type==='transfer'?'Transfer':categoryName(t.type,t.categoryId))}</strong><div class="mini">${esc(t.note||'')}</div></td><td>${esc(t.type==='transfer'?`${accountName(t.accountId)} → ${accountName(t.toAccountId)}`:accountName(t.accountId))}</td><td><span class="pill">${esc(t.type)}</span></td><td class="money ${t.type==='income'?'positive':t.type==='expense'?'negative':''}">${esc(signedMoney(t.amountMinor,t.type))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><strong>No matching records.</strong>Try clearing a filter or add a new transaction.</div>`}</div>`;
}
function filteredTransactions(){
  return state.transactions.slice().filter(t=>{
    if(historyFilters.q){const q=historyFilters.q.toLowerCase();const text=[t.note||'',t.type,categoryName(t.type,t.categoryId),accountName(t.accountId),accountName(t.toAccountId)].join(' ').toLowerCase();if(!text.includes(q))return false;}
    if(historyFilters.type!=='all'&&t.type!==historyFilters.type)return false;
    if(historyFilters.account!=='all'&&t.accountId!==historyFilters.account&&t.toAccountId!==historyFilters.account)return false;
    if(historyFilters.category!=='all'&&categoryName(t.type,t.categoryId)!==historyFilters.category)return false;
    if(historyFilters.from&&t.date<historyFilters.from)return false;if(historyFilters.to&&t.date>historyFilters.to)return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||''));
}
function insightsView(){
  const range=dateRange('thisMonth');
  const totals=periodTotals(range.from,range.to);
  const expenseByCat={};state.transactions.filter(t=>t.type==='expense'&&t.date>=range.from&&t.date<=range.to).forEach(t=>{const n=categoryName('expense',t.categoryId);expenseByCat[n]=(expenseByCat[n]||0)+t.amountMinor;});
  const ranked=Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).slice(0,8);const max=ranked[0]?.[1]||1;
  const months=[];const now=new Date(`${todayISO()}T00:00:00`);for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const key=d.toISOString().slice(0,7);months.push({key,label:d.toLocaleDateString('en-BD',{month:'short'}),...periodTotals(`${key}-01`,`${key}-${new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}`)});}
  const trendMax=Math.max(1,...months.map(m=>Math.max(m.income,m.expense)));
  return `<div class="topbar"><div><div class="kicker">UNDERSTAND YOUR MONEY</div><h1 class="page-title">Insights</h1></div><select class="select" id="insight-range" style="width:auto"><option value="week">This week</option><option value="thisMonth" selected>This month</option><option value="lastMonth">Last month</option><option value="3Months">Last 3 months</option><option value="year">This year</option></select></div>
  <div class="grid grid-3"><div class="card stat"><div class="label">INCOME</div><strong class="income">${esc(formatMoney(totals.income))}</strong><small class="muted">${esc(fmtDate(range.from))} → ${esc(fmtDate(range.to))}</small></div><div class="card stat"><div class="label">EXPENSE</div><strong class="expense">${esc(formatMoney(totals.expense))}</strong><small class="muted">Transfers excluded</small></div><div class="card stat"><div class="label">NET FLOW</div><strong class="${totals.income-totals.expense>=0?'income':'expense'}">${esc(formatMoney(totals.income-totals.expense))}</strong><small class="muted">Income minus expenses</small></div></div>
  <div class="grid grid-2 section"><div class="card"><div class="section-head"><h2>Where it goes</h2><span class="mini">This month</span></div>${ranked.length?`<div class="chart">${ranked.map(([name,val])=>`<div class="bar-item"><span class="truncate">${esc(name)}</span><div class="bar-track"><span style="width:${val/max*100}%"></span></div><strong style="text-align:right">${esc(formatMoney(val,true))}</strong></div>`).join('')}</div>`:`<div class="empty"><strong>No expenses yet.</strong>Category insights appear after your first expense.</div>`}</div>
  <div class="card"><div class="section-head"><h2>Six-month flow</h2><span class="mini">Income vs expense</span></div><div class="chart">${months.map(m=>`<div><div class="row" style="justify-content:space-between"><span class="mini">${esc(m.label)}</span><span class="mini">${esc(formatMoney(m.income,true))} in · ${esc(formatMoney(m.expense,true))} out</span></div><div class="progress" style="margin-top:5px"><span style="width:${m.income/trendMax*100}%;background:var(--income)"></span></div><div class="progress" style="margin-top:4px"><span style="width:${m.expense/trendMax*100}%;background:var(--expense)"></span></div></div>`).join('')}</div></div></div>
  <div class="section"><div class="section-head"><h2>Account picture</h2><span class="mini">Current balances</span></div><div class="accounts-grid">${state.accounts.map(a=>`<div class="account-card"><span class="pill">${esc(a.type)}${a.archived?' · Archived':''}</span><strong style="margin-top:8px">${esc(a.name)}</strong><div class="amount">${esc(formatMoney(balanceForAccount(a.id)))}</div><small class="muted">Opening ${esc(formatMoney(a.openingMinor))}</small></div>`).join('')}</div></div>`;
}
function settingsView(){
  const s=state.settings;const recurringDue=state.recurring.filter(r=>r.active);
  return `<div class="topbar"><div><div class="kicker">YOUR CONTROL CENTER</div><h1 class="page-title">Settings</h1></div><div class="top-actions"><button class="btn btn-danger" data-action="lock">${ICONS.lock} Lock now</button></div></div>
  <div class="grid grid-2"><div class="card"><div class="section-head"><div><h2>Privacy & security</h2><span class="mini">Local-only controls</span></div><span class="pill">${ICONS.shield} Private</span></div><div class="setting-list"><div class="setting"><div><div class="setting-title">Hide amounts</div><div class="setting-desc">Mask monetary values on the dashboard.</div></div><label class="switch"><input id="setting-hide" type="checkbox" ${s.hideAmounts?'checked':''}><span class="slider"></span></label></div><div class="setting"><div><div class="setting-title">Auto-lock</div><div class="setting-desc">Lock after inactivity.</div></div><select class="select" id="setting-autolock" style="width:auto"><option value="5" ${s.autoLock==='5'?'selected':''}>5 min</option><option value="15" ${s.autoLock==='15'?'selected':''}>15 min</option><option value="30" ${s.autoLock==='30'?'selected':''}>30 min</option><option value="0" ${s.autoLock==='0'?'selected':''}>Never</option></select></div><div class="setting"><div><div class="setting-title">Change password</div><div class="setting-desc">Re-encrypt the vault with a new password.</div></div><button class="btn btn-soft" data-action="change-password">Change</button></div><div class="setting"><div><div class="setting-title">Lock MONEYLOG</div><div class="setting-desc">Close the current decrypted session.</div></div><button class="btn btn-ghost" data-action="lock">Lock</button></div></div></div>
  <div class="card"><div class="section-head"><div><h2>Daily journal reminder</h2><span class="mini">A gentle nudge to record today's money.</span></div><span class="pill">${ICONS.bell} Reminder</span></div><div class="setting"><div><div class="setting-title">Daily reminder</div><div class="setting-desc">Notifications are optional and controlled by your device.</div></div><label class="switch"><input id="setting-reminder" type="checkbox" ${s.reminderEnabled?'checked':''}><span class="slider"></span></label></div><div class="form-grid two"><div class="field"><label>Reminder time</label><input id="setting-reminder-time" class="input" type="time" value="${esc(s.reminderTime)}"></div><div class="field"><label>Status</label><div class="install-hint" id="reminder-status">${esc(reminderStatusText())}</div></div></div><div class="mini" style="margin-top:10px">Best-effort background delivery depends on browser support. When background scheduling is unavailable, MONEYLOG also checks while the app is active.</div></div></div>
  <div class="card section"><div class="section-head"><div><h2>Local profile</h2><span class="mini">Stored only on this device.</span></div><span class="pill">${esc(state.settings.username||'Local user')}</span></div><p class="muted">Your username is used to verify the correct vault during sign-in and password recovery. It is not an online account.</p></div><div class="card section"><div class="section-head"><div><h2>Appearance</h2><span class="mini">Comfortable in light or dark environments.</span></div></div><div class="choice-row">${['system','light','dark'].map(x=>`<button class="choice ${s.theme===x?'active':''}" data-action="theme" data-theme="${x}">${x==='system'?'System':x==='light'?ICONS.sun+' Light':ICONS.moon+' Dark'}</button>`).join('')}</div></div>
  <div class="card section"><div class="section-head"><div><h2>Money format</h2><span class="mini">One base currency throughout the app.</span></div></div><div class="form-grid two"><div class="field"><label>Currency</label><select id="setting-currency" class="select">${Object.entries(CURRENCIES).map(([k,v])=>`<option value="${k}" ${s.currency===k?'selected':''}>${esc(k)} · ${esc(v)}</option>`).join('')}</select></div><div class="field"><label>Backup</label><button class="btn btn-soft" data-action="export-backup">Export encrypted backup</button></div></div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Restore</label><input id="restore-file" class="input" type="file" accept=".moneylog,application/octet-stream"></div><div class="field"><label>Install</label><button class="btn btn-ghost" data-action="install">Add MONEYLOG to home screen</button></div></div></div>
  <div class="grid grid-2 section"><div class="card"><div class="section-head"><div><h2>Accounts</h2><span class="mini">Cash, bank, savings and more.</span></div><button class="btn btn-primary" data-action="add-account">Add</button></div><div class="list">${state.accounts.map(a=>`<div class="list-row"><span class="avatar">${ICONS.wallet}</span><span class="grow"><strong>${esc(a.name)}</strong><small>${esc(a.type)}${a.archived?' · Archived':''}</small></span><strong class="money">${esc(formatMoney(balanceForAccount(a.id)))}</strong><button class="btn btn-ghost btn-icon" data-action="edit-account" data-id="${esc(a.id)}">${ICONS.edit}</button></div>`).join('')}</div></div>
  <div class="card"><div class="section-head"><div><h2>Budget</h2><span class="mini">Optional monthly spending limit.</span></div></div><div class="field"><label>Overall monthly budget</label><input id="budget-input" class="input" type="number" min="0" step="0.01" value="${state.budgets.overallMinor/100}"></div><button class="btn btn-primary" data-action="save-budget" style="margin-top:10px">Save budget</button></div></div>
  <div class="grid grid-2 section"><div class="card"><div class="section-head"><div><h2>Categories</h2><span class="mini">Custom categories stay in history when archived.</span></div><button class="btn btn-soft" data-action="add-category">Add</button></div><div class="choice-row">${state.categories.expense.filter(c=>!c.archived).map(c=>`<button class="choice" data-action="edit-category" data-id="${esc(c.id)}" data-type="expense">${esc(c.name)}</button>`).join('')}</div><div style="height:10px"></div><div class="choice-row">${state.categories.income.filter(c=>!c.archived).map(c=>`<button class="choice" data-action="edit-category" data-id="${esc(c.id)}" data-type="income">${esc(c.name)}</button>`).join('')}</div></div>
  <div class="card"><div class="section-head"><div><h2>Recurring entries</h2><span class="mini">Generated safely when MONEYLOG is opened.</span></div><button class="btn btn-soft" data-action="add-recurring">Add</button></div>${recurringDue.length?`<div class="list">${recurringDue.map(r=>`<div class="list-row"><span class="avatar">${ICONS.repeat}</span><span class="grow"><strong>${esc(r.name||r.categoryName||'Recurring')}</strong><small>${esc(r.frequency)} · next ${esc(r.nextDate)}</small></span><span class="money ${r.type==='income'?'positive':'negative'}">${esc(signedMoney(r.amountMinor,r.type))}</span><button class="btn btn-ghost btn-icon" data-action="edit-recurring" data-id="${esc(r.id)}">${ICONS.edit}</button></div>`).join('')}</div>`:`<div class="empty">No recurring entries yet.</div>`}</div></div>
  <div class="card section"><div class="section-head"><div><h2>Savings goals</h2><span class="mini">Planning progress; contributions do not move account balances automatically.</span></div><button class="btn btn-soft" data-action="add-goal">Add goal</button></div>${state.goals.length?`<div class="goal-grid">${state.goals.map(g=>goalCard(g)).join('')}</div>`:`<div class="empty">Create a goal such as “Emergency fund” or “New laptop”.</div>`}</div>
  <div class="card section"><div class="section-head"><div><h2>App updates</h2><span class="mini">MONEYLOG checks its published version when online.</span></div><span class="pill">v${APP_VERSION}</span></div><div class="row" style="justify-content:space-between"><span class="muted">${updateInfo?`New version ${esc(updateInfo.version)} is available.`:'You are up to date.'}</span><button class="btn btn-soft" data-action="check-update">Check now</button></div></div>
  <div class="card section" style="border-color:color-mix(in srgb,var(--expense) 22%,var(--line))"><div class="section-head"><div><h2>Danger zone</h2><span class="mini">These actions are destructive.</span></div></div><div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="muted">Delete the local vault only when you intentionally want to start over. Browser cache/site-data cleanup can also remove local browser storage; use the .moneylog file for durable backup.</span><button class="btn btn-danger" data-action="wipe-data">Delete all data</button></div></div>`;
}
function greeting(){const h=new Date().getHours();return h<5?'LATE NIGHT':h<12?'GOOD MORNING':h<18?'GOOD AFTERNOON':'GOOD EVENING';}
function reminderStatusText(){
  if(!state.settings.reminderEnabled)return 'Off';
  if(!('Notification' in window))return 'Browser notifications unavailable';
  if(Notification.permission==='denied')return 'Blocked by browser';
  if(Notification.permission!=='granted')return 'Permission needed';
  return `On · ${formatTime(state.settings.reminderTime)}`;
}
function formatTime(t){const [h,m]=t.split(':').map(Number);const d=new Date();d.setHours(h,m);return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
async function syncPublicPrefs(){
  if(!state)return;
  await idbPut('publicPrefs',{key:'reminder',enabled:!!state.settings.reminderEnabled,time:state.settings.reminderTime||'20:30',lastReminderDate:state.settings.lastReminderDate||''});
  await idbPut('publicPrefs',{key:'appmeta',version:APP_VERSION});
  await scheduleReminder();
}
async function enableReminder(){
  if(!('Notification' in window)) throw new Error('NOTIFICATIONS_UNAVAILABLE');
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted') throw new Error('NOTIFICATION_DENIED');
  state.settings.reminderEnabled=true;
  await syncPublicPrefs();
}
async function disableReminder(){state.settings.reminderEnabled=false;await syncPublicPrefs();}
function nextReminderTimestamp(time){const [h,m]=time.split(':').map(Number);const now=new Date();let d=new Date(now);d.setHours(h,m,0,0);if(d<=now)d.setDate(d.getDate()+1);return d.getTime();}
async function scheduleReminder(){
  if(!state?.settings?.reminderEnabled || !('serviceWorker' in navigator)) return;
  try{
    const reg=await navigator.serviceWorker.ready;
    const when=nextReminderTimestamp(state.settings.reminderTime||'20:30');
    if('showTrigger' in Notification.prototype && typeof TimestampTrigger!=='undefined'){
      const existing=await reg.getNotifications({tag:'moneylog-daily-reminder',includeTriggered:true}).catch(()=>[]);
      existing.forEach(n=>n.close());
      await reg.showNotification('MONEYLOG reminder',{tag:'moneylog-daily-reminder',body:'A quiet minute for today’s money log.',icon:'./icon.svg',showTrigger:new TimestampTrigger(when),data:{url:'./'}});
      return;
    }
    if(reg.periodicSync){
      try{await reg.periodicSync.register('moneylog-daily-reminder',{minInterval:60*60*1000});}catch{}
    }
  }catch{}
}
async function checkReminderDue(){
  if(!state?.settings?.reminderEnabled)return;
  const now=new Date();const [h,m]=state.settings.reminderTime.split(':').map(Number);const current=now.getHours()*60+now.getMinutes();const target=h*60+m;
  const hasToday=state.transactions.some(t=>t.date===todayISO());
  if(current>=target && !hasToday && state.settings.lastReminderDate!==todayISO()){
    state.settings.lastReminderDate=todayISO();await saveVault();
    if('Notification' in window && Notification.permission==='granted' && 'serviceWorker' in navigator){try{(await navigator.serviceWorker.ready).showNotification('MONEYLOG reminder',{body:'You haven’t logged today yet. Add today’s income or expenses.',icon:'./icon.svg',data:{url:'./'}});}catch{}}
    else showToast('Reminder: you have not logged today yet.');
  }
}

function modal(title,body,opts={}){
  const cls=opts.wide?'modal wide':'modal';
  $('#modal-root').innerHTML=`<div class="modal-backdrop" data-modal-bg><section class="${cls}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="btn btn-ghost btn-icon" data-action="close-modal">${ICONS.close}</button></div><div class="modal-body">${body}</div></section></div>`;
  $('#modal-root').dataset.open='1';
}
function closeModal(){ $('#modal-root').innerHTML=''; delete $('#modal-root').dataset.open; }
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2800);}

function transactionForm(existing=null,forcedType='expense'){
  const type=existing?.type||forcedType;
  const defaultAcc=existing?.accountId||state.settings.defaultAccountId||state.accounts.find(a=>!a.archived)?.id||'';
  const cat=existing?.categoryId||state.categories[type==='transfer'?'expense':type].find(c=>!c.archived)?.id||'';
  modal(existing?'Edit transaction':'New transaction',`
    <form id="tx-form">
      <div class="choice-row" id="tx-type">${['expense','income','transfer'].map(t=>`<button type="button" class="choice ${type===t?'active':''}" data-tx-type="${t}">${t==='expense'?ICONS.expense:t==='income'?ICONS.income:ICONS.transfer} ${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
      <div class="field" style="margin-top:16px"><label>Amount</label><input id="tx-amount" class="input" inputmode="decimal" type="number" min="0.01" step="0.01" required placeholder="0.00" value="${existing?esc((existing.amountMinor/100).toFixed(2)):''}" style="font-size:28px;font-weight:850;padding:16px"></div>
      <div class="form-grid two" style="margin-top:12px"><div class="field" id="tx-category-field"><label>Category</label><select id="tx-category" class="select">${type==='transfer'?'<option value="">Transfer</option>':categoryOptions(type,cat)}</select></div><div class="field"><label>${type==='transfer'?'From account':'Account'}</label><select id="tx-account" class="select">${accountOptions(defaultAcc)}</select></div></div>
      <div class="field ${type==='transfer'?'':'hidden'}" id="tx-to-field"><label>To account</label><select id="tx-to" class="select">${accountOptions(existing?.toAccountId||state.accounts.find(a=>a.id!==defaultAcc&&!a.archived)?.id||'')}</select></div>
      <div class="form-grid two" style="margin-top:12px"><div class="field"><label>Date</label><input id="tx-date" class="input" type="date" value="${existing?.date||todayISO()}" required></div><div class="field"><label>Time <span class="mini">optional</span></label><input id="tx-time" class="input" type="time" value="${existing?.time||''}"></div></div>
      <div class="field" style="margin-top:12px"><label>Note <span class="mini">optional</span></label><input id="tx-note" class="input" maxlength="120" value="${esc(existing?.note||'')}" placeholder="What was this for?"></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>${existing?'<button type="button" class="btn btn-danger" data-action="delete-tx">Delete</button>':''}<button class="btn btn-primary">${existing?'Save changes':'Save transaction'}</button></div>
    </form>`);
  const form=$('#tx-form');let txType=type;
  $$('#tx-type [data-tx-type]').forEach(btn=>btn.addEventListener('click',()=>{txType=btn.dataset.txType;updateTxFormType(txType)}));
  form.addEventListener('submit',async e=>{e.preventDefault();await saveTransaction(existing,txType);});
  if(existing) $('#modal-root').dataset.editingId=existing.id;
}
function updateTxFormType(type){
  $$('#tx-type [data-tx-type]').forEach(b=>b.classList.toggle('active',b.dataset.txType===type));
  const f=$('#tx-category-field'),tf=$('#tx-to-field'),cat=$('#tx-category');
  if(type==='transfer'){f.classList.add('hidden');tf.classList.remove('hidden');}
  else {f.classList.remove('hidden');tf.classList.add('hidden');cat.innerHTML=categoryOptions(type,'');}
}
async function saveTransaction(existing,type){
  const amount=amountMajorToMinor($('#tx-amount').value); if(!amount)return showToast('Enter a valid amount.');
  const accountId=$('#tx-account').value;const toAccountId=type==='transfer'?$('#tx-to').value:'';
  if(type==='transfer'&&(!toAccountId||toAccountId===accountId))return showToast('Choose two different accounts.');
  const tx={id:existing?.id||uuid(),type,amountMinor:amount,categoryId:type==='transfer'?'':$('#tx-category').value,accountId,toAccountId,date:$('#tx-date').value,time:$('#tx-time').value,note:$('#tx-note').value.trim(),updatedAt:new Date().toISOString()};
  if(existing){const i=state.transactions.findIndex(x=>x.id===existing.id);if(i>=0)state.transactions[i]=tx;}else state.transactions.push(tx);
  state.settings.defaultAccountId=accountId;await saveVault();closeModal();resetAutoLockTimer();renderApp();showToast(existing?'Transaction updated.':'Saved.');await checkReminderDue();
}

function accountForm(existing=null){
  modal(existing?'Edit account':'New account',`<form id="account-form"><div class="form-grid two"><div class="field"><label>Name</label><input id="account-name" class="input" required maxlength="40" value="${esc(existing?.name||'')}" placeholder="Cash, Bank, Savings…"></div><div class="field"><label>Type</label><select id="account-type" class="select">${['Cash','Bank','Mobile money','Savings','Other'].map(x=>`<option ${existing?.type===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div></div><div class="field" style="margin-top:12px"><label>Opening balance</label><input id="account-opening" class="input" type="number" step="0.01" value="${existing?existing.openingMinor/100:0}"></div><div class="field" style="margin-top:12px"><label>Description <span class="mini">optional</span></label><input id="account-desc" class="input" maxlength="80" value="${esc(existing?.description||'')}"></div><div class="setting" style="margin-top:5px"><div><div class="setting-title">Archived</div><div class="setting-desc">Keeps historical records but removes the account from quick entry.</div></div><label class="switch"><input id="account-archived" type="checkbox" ${existing?.archived?'checked':''}><span class="slider"></span></label></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save account</button></div></form>`);
  $('#account-form').addEventListener('submit',async e=>{e.preventDefault();const name=$('#account-name').value.trim();const opening=Number($('#account-opening').value);if(!name||!Number.isFinite(opening))return showToast('Enter a valid account.');if(existing){Object.assign(existing,{name,type:$('#account-type').value,openingMinor:Math.round(opening*100),description:$('#account-desc').value.trim(),archived:$('#account-archived').checked});}else state.accounts.push({id:uuid(),name,type:$('#account-type').value,openingMinor:Math.round(opening*100),description:$('#account-desc').value.trim(),archived:false});if(!state.settings.defaultAccountId)state.settings.defaultAccountId=state.accounts.find(a=>!a.archived)?.id||null;await saveVault();closeModal();renderApp();showToast('Account saved.');});
}

function categoryForm(existing=null,type='expense'){
  const actualType=existing?.type||type;
  modal(existing?'Edit category':'New category',`<form id="cat-form"><div class="field"><label>Type</label><div class="choice-row">${['expense','income'].map(x=>`<button type="button" class="choice ${actualType===x?'active':''}" data-cat-type="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div><div class="field" style="margin-top:14px"><label>Name</label><input id="cat-name" class="input" maxlength="30" required value="${esc(existing?.name||'')}" placeholder="e.g. Coffee"></div><div class="setting" style="margin-top:4px"><div><div class="setting-title">Archived</div><div class="setting-desc">Hidden from new entries; history stays intact.</div></div><label class="switch"><input id="cat-archived" type="checkbox" ${existing?.archived?'checked':''}><span class="slider"></span></label></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary">Save category</button></div></form>`);
  let catType=actualType;$$('[data-cat-type]').forEach(b=>b.onclick=()=>{catType=b.dataset.catType;$$('[data-cat-type]').forEach(x=>x.classList.toggle('active',x===b));});
  $('#cat-form').addEventListener('submit',async e=>{e.preventDefault();const name=$('#cat-name').value.trim();if(!name)return showToast('Enter a category name.');const target=state.categories[catType];if(existing){const i=target.findIndex(x=>x.id===existing.id);if(i>=0)Object.assign(target[i],{name,archived:$('#cat-archived').checked});}else if(target.some(c=>c.name.toLowerCase()===name.toLowerCase()))return showToast('That category already exists.');else target.push({id:uuid(),name,archived:false});await saveVault();closeModal();renderApp();showToast('Category saved.');});
}

function goalForm(existing=null){
  modal(existing?'Edit savings goal':'New savings goal',`<form id="goal-form"><div class="field"><label>Goal name</label><input id="goal-name" class="input" required value="${esc(existing?.name||'')}" placeholder="Emergency fund"></div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Target amount</label><input id="goal-target" class="input" type="number" min="0.01" step="0.01" required value="${existing?existing.targetMinor/100:''}"></div><div class="field"><label>Current saved</label><input id="goal-current" class="input" type="number" min="0" step="0.01" value="${existing?existing.currentMinor/100:0}"></div></div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Target date <span class="mini">optional</span></label><input id="goal-date" class="input" type="date" value="${esc(existing?.targetDate||'')}"></div><div class="field"><label>Archived</label><label class="switch" style="margin-top:8px"><input id="goal-archived" type="checkbox" ${existing?.archived?'checked':''}><span class="slider"></span></label></div></div><div class="install-hint" style="margin-top:12px">Goal progress is a planning figure. Adding money here does not automatically change an account balance.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>${existing?'<button type="button" class="btn btn-danger" data-action="delete-goal">Delete</button>':''}<button class="btn btn-primary">Save goal</button></div></form>`);
  $('#goal-form').addEventListener('submit',async e=>{e.preventDefault();const name=$('#goal-name').value.trim(),target=amountMajorToMinor($('#goal-target').value),cur=Math.round(Math.max(0,Number($('#goal-current').value))*100);if(!name||!target)return showToast('Enter a valid goal and target.');const obj={id:existing?.id||uuid(),name,targetMinor:target,currentMinor:Math.min(cur,target),targetDate:$('#goal-date').value,archived:$('#goal-archived').checked};if(existing)Object.assign(existing,obj);else state.goals.push(obj);await saveVault();closeModal();renderApp();showToast('Goal saved.');});
  if(existing)$('#modal-root').dataset.editingId=existing.id;
}

function recurringForm(existing=null){
  const t=existing?.type||'expense';const acc=existing?.accountId||state.settings.defaultAccountId||state.accounts.find(a=>!a.archived)?.id||'';
  modal(existing?'Edit recurring entry':'New recurring entry',`<form id="recurring-form"><div class="field"><label>Name</label><input id="rec-name" class="input" required value="${esc(existing?.name||'')}" placeholder="Salary, rent, internet…"></div><div class="choice-row" style="margin-top:12px">${['expense','income'].map(x=>`<button type="button" class="choice ${t===x?'active':''}" data-rec-type="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Amount</label><input id="rec-amount" class="input" type="number" min="0.01" step="0.01" required value="${existing?existing.amountMinor/100:''}"></div><div class="field"><label>Category</label><select id="rec-cat" class="select">${categoryOptions(t,existing?.categoryId)}</select></div></div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Account</label><select id="rec-account" class="select">${accountOptions(acc)}</select></div><div class="field"><label>Frequency</label><select id="rec-frequency" class="select">${['daily','weekly','monthly','yearly'].map(x=>`<option ${existing?.frequency===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="form-grid two" style="margin-top:12px"><div class="field"><label>Next date</label><input id="rec-next" class="input" type="date" required value="${existing?.nextDate||todayISO()}"></div><div class="field"><label>Active</label><label class="switch" style="margin-top:7px"><input id="rec-active" type="checkbox" ${existing?.active!==false?'checked':''}><span class="slider"></span></label></div></div><div class="field" style="margin-top:12px"><label>Note <span class="mini">optional</span></label><input id="rec-note" class="input" value="${esc(existing?.note||'')}"></div><div class="install-hint" style="margin-top:12px">Recurring entries are created when MONEYLOG opens. Duplicate entries are prevented by storing each generated date.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>${existing?'<button type="button" class="btn btn-danger" data-action="delete-recurring">Delete</button>':''}<button class="btn btn-primary">Save recurring entry</button></div></form>`);
  let recType=t;$$('[data-rec-type]').forEach(b=>b.onclick=()=>{recType=b.dataset.recType;$$('[data-rec-type]').forEach(x=>x.classList.toggle('active',x===b));$('#rec-cat').innerHTML=categoryOptions(recType,'');});
  $('#recurring-form').addEventListener('submit',async e=>{e.preventDefault();const amount=amountMajorToMinor($('#rec-amount').value);if(!amount)return showToast('Enter a valid amount.');const obj={id:existing?.id||uuid(),name:$('#rec-name').value.trim(),type:recType,amountMinor:amount,categoryId:$('#rec-cat').value,accountId:$('#rec-account').value,frequency:$('#rec-frequency').value,nextDate:$('#rec-next').value,active:$('#rec-active').checked,note:$('#rec-note').value.trim(),generatedDates:existing?.generatedDates||[]};if(existing)Object.assign(existing,obj);else state.recurring.push(obj);await processRecurring();await saveVault();closeModal();renderApp();showToast('Recurring entry saved.');});
  if(existing)$('#modal-root').dataset.editingId=existing.id;
}
function addDays(date,frequency){const d=new Date(`${date}T00:00:00`);if(frequency==='daily')d.setDate(d.getDate()+1);if(frequency==='weekly')d.setDate(d.getDate()+7);if(frequency==='monthly')d.setMonth(d.getMonth()+1);if(frequency==='yearly')d.setFullYear(d.getFullYear()+1);return d.toISOString().slice(0,10);}
async function processRecurring(){
  if(!state)return;let changed=false;const today=todayISO();
  for(const r of state.recurring){if(!r.active||!r.nextDate)continue;r.generatedDates=r.generatedDates||[];while(r.nextDate<=today){if(!r.generatedDates.includes(r.nextDate)){state.transactions.push({id:uuid(),type:r.type,amountMinor:r.amountMinor,categoryId:r.categoryId,accountId:r.accountId,toAccountId:'',date:r.nextDate,time:'',note:r.note||r.name,updatedAt:new Date().toISOString(),recurringId:r.id});r.generatedDates.push(r.nextDate);changed=true;}r.nextDate=addDays(r.nextDate,r.frequency);changed=true;}}
  if(changed)await saveVault();
}

async function changePassword(){
  modal('Change MONEYLOG password',`<form id="pw-form"><div class="field"><label>Current password</label><input id="pw-old" class="input" type="password" required autocomplete="current-password"></div><div class="field" style="margin-top:12px"><label>New password</label><input id="pw-new" class="input" type="password" minlength="8" required autocomplete="new-password"></div><div class="field" style="margin-top:12px"><label>Confirm new password</label><input id="pw-confirm" class="input" type="password" minlength="8" required autocomplete="new-password"></div><div class="field" style="margin-top:12px"><label>Recovery code</label><input id="pw-recovery" class="input" required placeholder="Required to keep password recovery working"></div><div class="install-hint" style="margin-top:12px">Your recovery code is used to wrap the new password key. It is not stored in plain text.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary">Change password</button></div></form>`);
  $('#pw-form').addEventListener('submit',async e=>{e.preventDefault();const old=$('#pw-old').value,n=$('#pw-new').value,c=$('#pw-confirm').value,rcode=$('#pw-recovery').value.trim();if(n.length<8||n!==c)return showToast('Check the new password.');try{const meta=await idbGet('meta','security'),recovery=await idbGet('meta','recovery');const oldKey=await deriveKey(old,b64ToBytes(meta.salt));const check=await decryptText(meta.check,oldKey);if(!['MONEYLOG-PASSWORD-CHECK-v2','MONEYLOG-PASSWORD-CHECK-v3'].includes(check))throw new Error('WRONG');if(!recovery)throw new Error('NO_RECOVERY');const rkey=await deriveKey(rcode,b64ToBytes(recovery.salt));await decryptText(recovery.wrapped,rkey);const salt=crypto.getRandomValues(new Uint8Array(16)),key=await deriveKey(n,salt),newCheck=await encryptText('MONEYLOG-PASSWORD-CHECK-v3',key);const newRKey=await deriveKey(rcode,b64ToBytes(recovery.salt)),wrapped=await encryptText(bytesToB64(await exportKeyRaw(key)),newRKey);sessionKey=key;await idbPut('meta',{key:'security',salt:bytesToB64(salt),check:newCheck});await idbPut('meta',{key:'recovery',username:recovery.username,salt:recovery.salt,wrapped});await saveVault();closeModal();showToast('Password changed.');}catch(err){showToast(err.message==='NO_RECOVERY'?'Set up a recovery method first.':'Current password or recovery code is not correct.');}});
}

async function exportBackup(){
  const p=prompt('Create a password for this backup file (8+ characters).');if(!p)return;if(p.length<8)return showToast('Use at least 8 characters.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),key=await deriveKey(p,salt);const payload={format:'moneylog',version:3,exportedAt:new Date().toISOString(),state};const encrypted=await encryptText(JSON.stringify(payload),key);const file={magic:'MONEYLOG',version:3,salt:bytesToB64(salt),...encrypted};const blob=new Blob([JSON.stringify(file)],{type:'application/octet-stream'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`moneylog-${todayISO()}.moneylog`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);state.settings.lastBackupAt=new Date().toISOString();await saveVault();showToast('Encrypted backup exported.');
}
async function restoreBackup(file){
  if(!file)return;try{const raw=JSON.parse(await file.text());if(raw.magic!=='MONEYLOG'||raw.version!==2)throw new Error('unsupported');const p=prompt('Enter the backup password.');if(!p)return;const key=await deriveKey(p,b64ToBytes(raw.salt));if(![2,3].includes(raw.version))throw new Error('unsupported');const data=JSON.parse(await decryptText(raw,key));if(!data.state)throw new Error('invalid');if(!confirm('Replace all current MONEYLOG data with this backup? This cannot be undone.'))return;state=validateState(data.state);await saveVault();renderApp();showToast('Backup restored.');}catch{showToast('Could not restore this backup. Check the password or file.');}}
function exportCSV(){const rows=[['Date','Type','Category','Account','To account','Amount','Note'],...filteredTransactions().map(t=>[t.date,t.type,t.type==='transfer'?'Transfer':categoryName(t.type,t.categoryId),accountName(t.accountId),accountName(t.toAccountId),(t.type==='expense'?-1:t.type==='income'?1:1)*(t.amountMinor/100),t.note||''])];const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`moneylog-${todayISO()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

async function saveDurableBackup(){
  const p=prompt('Create a password for this durable .moneylog file (8+ characters).');if(!p)return;if(p.length<8)return showToast('Use at least 8 characters.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),key=await deriveKey(p,salt),payload={format:'moneylog',version:3,exportedAt:new Date().toISOString(),state};const encrypted=await encryptText(JSON.stringify(payload),key);const bytes=new Blob([JSON.stringify({magic:'MONEYLOG',version:3,salt:bytesToB64(salt),...encrypted})],{type:'application/octet-stream'});
  if(window.showSaveFilePicker){try{const handle=await window.showSaveFilePicker({suggestedName:'moneylog-vault.moneylog',types:[{description:'MONEYLOG encrypted vault',accept:{'application/octet-stream':['.moneylog']}}]});const writable=await handle.createWritable();await writable.write(bytes);await writable.close();state.settings.durableBackupName=handle.name||'moneylog-vault.moneylog';await saveVault();showToast('Durable vault file saved.');return;}catch(err){if(err?.name==='AbortError')return;}}
  const a=document.createElement('a');a.href=URL.createObjectURL(bytes);a.download='moneylog-vault.moneylog';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('Encrypted vault file downloaded. Keep it safe.');
}
function maybeShowInstallChoice(){
  if(localStorage.getItem('moneylog-entry-choice'))return;
  setTimeout(()=>{if($('#modal-root').dataset.open)return;modal('How would you like to use MONEYLOG?',`<p class="muted">For the best experience, install MONEYLOG as a web app. The installed version keeps its app shell separate from ordinary browsing.</p><div class="install-choice-grid"><button class="install-option" data-action="install-choice" data-choice="install"><span class="install-option-icon">↓</span><span><strong>Install Web App</strong><small>Best choice for daily use</small></span></button><button class="install-option" data-action="install-choice" data-choice="web"><span class="install-option-icon">↗</span><span><strong>Use Web Version</strong><small>Runs inside your browser</small></span></button></div><div class="web-warning"><strong>Web version warning</strong><br>Browser cleanup, clearing site data, or uninstalling browser data can remove MONEYLOG's local vault. Keep an encrypted <code>.moneylog</code> backup outside the browser.</div>`);},250);
}
function toggleInstall(){if(deferredInstallPrompt){deferredInstallPrompt.prompt();deferredInstallPrompt=null;return;}showToast('Open your browser menu and choose “Add to Home screen”.');}
async function checkForUpdate(force=false){
  try{
    const last=Number(localStorage.getItem('moneylog-update-check')||0);if(!force&&Date.now()-last<15*60*1000)return;
    localStorage.setItem('moneylog-update-check',String(Date.now()));
    const res=await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`,{cache:'no-store'});if(!res.ok)return;const info=await res.json();
    if(compareVersions(info.version,APP_VERSION)>0){
      const dismissed=Number(localStorage.getItem('moneylog-update-dismiss-'+info.version)||0);
      if(!dismissed||Date.now()-dismissed>REMIND_LATER_MS){updateInfo=info;if(state){renderApp();setTimeout(()=>openUpdateModal(),160);}}
    }else {updateInfo=null;}
  }catch{}
}
function openUpdateModal(){if(!updateInfo||$('#modal-root').dataset.open)return;modal(updateInfo.title||'MONEYLOG update',`<p>A newer version <strong>${esc(updateInfo.version)}</strong> is ready.</p><div class="install-hint">${esc((updateInfo.notes||[]).join(' · '))}</div><div class="modal-actions"><button class="btn btn-ghost" data-action="remind-update">Remind me later</button><button class="btn btn-primary" data-action="apply-update">Update now</button></div>`);}
function compareVersions(a,b){const aa=String(a||'0').split('.').map(Number),bb=String(b||'0').split('.').map(Number);for(let i=0;i<Math.max(aa.length,bb.length);i++){const x=aa[i]||0,y=bb[i]||0;if(x!==y)return x-y;}return 0;}
async function applyUpdate(){
  try{
    const reg=await navigator.serviceWorker.ready;showToast('Preparing the update…');await reg.update();
    if(reg.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});return;}
    if(reg.installing){reg.installing.addEventListener('statechange',()=>{if(reg.installing?.state==='installed'&&navigator.serviceWorker.controller){reg.waiting?.postMessage({type:'SKIP_WAITING'});}});return;}
    location.reload();
  }catch{location.reload();}
}
async function registerSW(){
  if(!('serviceWorker' in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register('./sw.js');
    navigator.serviceWorker.addEventListener('controllerchange',()=>{location.reload();});
    if(reg.waiting&&navigator.serviceWorker.controller) updateInfo=updateInfo||null;
  }catch{}
}

function renderAuthAgain(){if(sessionKey)renderApp();else login();}

$('#app').addEventListener('click',async e=>{
  const tabBtn=e.target.closest('[data-tab]');if(tabBtn&&!tabBtn.dataset.action){currentTab=tabBtn.dataset.tab;resetAutoLockTimer();renderApp();return;}
  const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;const id=el.dataset.id;
  try{
    if(action==='add'||action==='quick-expense'||action==='quick-income'||action==='quick-transfer')transactionForm(null,action==='quick-income'?'income':action==='quick-transfer'?'transfer':'expense');
    else if(action==='edit-tx')transactionForm(state.transactions.find(t=>t.id===id));
    else if(action==='delete-tx'){if(confirm('Delete this transaction?')){state.transactions=state.transactions.filter(t=>t.id!==$('#modal-root').dataset.editingId);await saveVault();closeModal();renderApp();showToast('Transaction deleted.');}}
    else if(action==='close-modal')closeModal();
    else if(action==='toggle-hide'){state.settings.hideAmounts=!state.settings.hideAmounts;await saveVault();renderApp();}
    else if(action==='lock')lockApp();
    else if(action==='add-account')accountForm();
    else if(action==='edit-account')accountForm(state.accounts.find(a=>a.id===id));
    else if(action==='add-category')categoryForm();
    else if(action==='edit-category')categoryForm(state.categories[el.dataset.type]?.find(c=>c.id===id),el.dataset.type);
    else if(action==='add-goal')goalForm();
    else if(action==='edit-goal')goalForm(state.goals.find(g=>g.id===id));
    else if(action==='add-recurring')recurringForm();
    else if(action==='edit-recurring')recurringForm(state.recurring.find(r=>r.id===id));
    else if(action==='change-password')changePassword();
    else if(action==='export-backup')exportBackup();
    else if(action==='export-csv')exportCSV();
    else if(action==='install')toggleInstall();
    else if(action==='install-choice'){localStorage.setItem('moneylog-entry-choice',el.dataset.choice);closeModal();if(el.dataset.choice==='install')toggleInstall();}
    else if(action==='forgot-password')recoveryPasswordForm();
    else if(action==='save-durable-backup')saveDurableBackup();
    else if(action==='toggle-pass'){const input=$(`#${el.dataset.target}`);input.type=input.type==='password'?'text':'password';}
    else if(action==='save-budget'){const v=Math.max(0,Number($('#budget-input').value));if(!Number.isFinite(v))return showToast('Enter a valid budget.');state.budgets.overallMinor=Math.round(v*100);await saveVault();renderApp();showToast('Budget saved.');}
    else if(action==='theme'){state.settings.theme=el.dataset.theme;await saveVault();applyTheme();renderApp();}
    else if(action==='wipe-data'){if(confirm('Delete every MONEYLOG record on this device? This cannot be undone unless you have a backup.')){await idbClear('vault');await idbClear('meta');await idbClear('publicPrefs');sessionKey=null;state=null;currentTab='home';renderAuth('setup');showToast('All data deleted.');}}
    else if(action==='open-update')openUpdateModal();
    else if(action==='remind-update'){if(updateInfo)localStorage.setItem('moneylog-update-dismiss-'+updateInfo.version,String(Date.now()));closeModal();showToast('Okay. I’ll remind you later.');}
    else if(action==='apply-update'){closeModal();await applyUpdate();}
    else if(action==='check-update'){await checkForUpdate(true);showToast(updateInfo?`Version ${updateInfo.version} is available.`:'You are up to date.');renderApp();}
  }catch(err){console.error(err);showToast('Something went wrong. Your data was not intentionally deleted.');}
});

$('#app').addEventListener('input',e=>{
  if(e.target.id==='history-q'){historyFilters.q=e.target.value;renderApp();const el=$('#history-q');if(el){el.focus();el.setSelectionRange(historyFilters.q.length,historyFilters.q.length);}}
});
$('#app').addEventListener('change',async e=>{
  if(e.target.id==='history-type'){historyFilters.type=e.target.value;renderApp();}
  if(e.target.id==='history-account'){historyFilters.account=e.target.value;renderApp();}
  if(e.target.id==='history-category'){historyFilters.category=e.target.value;renderApp();}
  if(e.target.id==='history-from'){historyFilters.from=e.target.value;renderApp();}
  if(e.target.id==='history-to'){historyFilters.to=e.target.value;renderApp();}
  if(e.target.id==='insight-range'){renderInsightsForRange(e.target.value);}
  if(e.target.id==='setting-hide'){state.settings.hideAmounts=e.target.checked;await saveVault();renderApp();}
  if(e.target.id==='setting-autolock'){state.settings.autoLock=e.target.value;await saveVault();resetAutoLockTimer();showToast('Auto-lock updated.');}
  if(e.target.id==='setting-currency'){state.settings.currency=e.target.value;await saveVault();renderApp();}
  if(e.target.id==='setting-reminder'){
    try{if(e.target.checked)await enableReminder();else await disableReminder();await saveVault();renderApp();showToast(e.target.checked?'Daily reminder enabled.':'Daily reminder disabled.');}
    catch(err){e.target.checked=false;renderApp();showToast(err.message==='NOTIFICATION_DENIED'?'Notification permission was not granted.':'Notifications are unavailable here.');}
  }
  if(e.target.id==='setting-reminder-time'){state.settings.reminderTime=e.target.value||'20:30';await saveVault();renderApp();}
  if(e.target.id==='restore-file'){await restoreBackup(e.target.files?.[0]);}
});
function renderInsightsForRange(kind){
  // Re-render the same page with the selected range by temporarily changing helper behavior.
  const target=dateRange(kind);const totals=periodTotals(target.from,target.to);const el=$('#insight-range');if(!el)return;
  const root=el.closest('.content');
  const by={};state.transactions.filter(t=>t.type==='expense'&&t.date>=target.from&&t.date<=target.to).forEach(t=>{const n=categoryName('expense',t.categoryId);by[n]=(by[n]||0)+t.amountMinor;});
  const rank=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8),max=rank[0]?.[1]||1;root.querySelector('.card .chart')?.remove();
  // Simple refresh: use full app render. The default page remains readable and the selected range is reflected in summary after this action.
  let html=insightsViewDynamic(kind);root.innerHTML=html;
}
function insightsViewDynamic(kind){
  const range=dateRange(kind),totals=periodTotals(range.from,range.to);const expenseByCat={};state.transactions.filter(t=>t.type==='expense'&&t.date>=range.from&&t.date<=range.to).forEach(t=>{const n=categoryName('expense',t.categoryId);expenseByCat[n]=(expenseByCat[n]||0)+t.amountMinor;});const ranked=Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).slice(0,8),max=ranked[0]?.[1]||1;const months=[];const now=new Date(`${todayISO()}T00:00:00`);for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=d.toISOString().slice(0,7),last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();months.push({label:d.toLocaleDateString('en-BD',{month:'short'}),...periodTotals(`${key}-01`,`${key}-${last}`)});}const trendMax=Math.max(1,...months.map(m=>Math.max(m.income,m.expense)));return `<div class="topbar"><div><div class="kicker">UNDERSTAND YOUR MONEY</div><h1 class="page-title">Insights</h1></div><select class="select" id="insight-range" style="width:auto">${['week','thisMonth','lastMonth','3Months','year'].map(x=>`<option value="${x}" ${x===kind?'selected':''}>${x==='week'?'This week':x==='thisMonth'?'This month':x==='lastMonth'?'Last month':x==='3Months'?'Last 3 months':'This year'}</option>`).join('')}</select></div><div class="grid grid-3"><div class="card stat"><div class="label">INCOME</div><strong class="income">${esc(formatMoney(totals.income))}</strong><small class="muted">${esc(fmtDate(range.from))} → ${esc(fmtDate(range.to))}</small></div><div class="card stat"><div class="label">EXPENSE</div><strong class="expense">${esc(formatMoney(totals.expense))}</strong><small class="muted">Transfers excluded</small></div><div class="card stat"><div class="label">NET FLOW</div><strong class="${totals.income-totals.expense>=0?'income':'expense'}">${esc(formatMoney(totals.income-totals.expense))}</strong><small class="muted">Income minus expenses</small></div></div><div class="grid grid-2 section"><div class="card"><div class="section-head"><h2>Where it goes</h2><span class="mini">Selected period</span></div>${ranked.length?`<div class="chart">${ranked.map(([name,val])=>`<div class="bar-item"><span class="truncate">${esc(name)}</span><div class="bar-track"><span style="width:${val/max*100}%"></span></div><strong style="text-align:right">${esc(formatMoney(val,true))}</strong></div>`).join('')}</div>`:`<div class="empty"><strong>No expenses yet.</strong>No category spending for this period.</div>`}</div><div class="card"><div class="section-head"><h2>Six-month flow</h2><span class="mini">Context</span></div><div class="chart">${months.map(m=>`<div><div class="row" style="justify-content:space-between"><span class="mini">${esc(m.label)}</span><span class="mini">${esc(formatMoney(m.income,true))} in · ${esc(formatMoney(m.expense,true))} out</span></div><div class="progress" style="margin-top:5px"><span style="width:${m.income/trendMax*100}%;background:var(--income)"></span></div><div class="progress" style="margin-top:4px"><span style="width:${m.expense/trendMax*100}%;background:var(--expense)"></span></div></div>`).join('')}</div></div></div><div class="section"><div class="section-head"><h2>Account picture</h2></div><div class="accounts-grid">${state.accounts.map(a=>`<div class="account-card"><span class="pill">${esc(a.type)}${a.archived?' · Archived':''}</span><strong style="margin-top:8px">${esc(a.name)}</strong><div class="amount">${esc(formatMoney(balanceForAccount(a.id)))}</div><small class="muted">Opening ${esc(formatMoney(a.openingMinor))}</small></div>`).join('')}</div></div>`;}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
window.addEventListener('online',()=>checkForUpdate(true));
window.addEventListener('focus',()=>{if(state){checkForUpdate();checkReminderDue();}});

$('#modal-root').addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const action=el.dataset.action;
  try{
    if(action==='close-modal') closeModal();
    else if(action==='toggle-pass'){const input=$(`#${el.dataset.target}`);if(input){input.type=input.type==='password'?'text':'password';}}
    else if(action==='delete-tx'){if(confirm('Delete this transaction?')){const id=$('#modal-root').dataset.editingId;state.transactions=state.transactions.filter(t=>t.id!==id);await saveVault();closeModal();renderApp();showToast('Transaction deleted.');}}
    else if(action==='delete-goal'){const id=$('#modal-root').dataset.editingId; if(id){state.goals=state.goals.filter(g=>g.id!==id);await saveVault();closeModal();renderApp();showToast('Goal removed.');}}
    else if(action==='delete-recurring'){const id=$('#modal-root').dataset.editingId; if(id){state.recurring=state.recurring.filter(r=>r.id!==id);await saveVault();closeModal();renderApp();showToast('Recurring entry removed.');}}
    else if(action==='remind-update'){if(updateInfo)localStorage.setItem('moneylog-update-dismiss-'+updateInfo.version,String(Date.now()));closeModal();showToast('Okay. I’ll remind you later.');}
    else if(action==='apply-update'){closeModal();await applyUpdate();}
  }catch(err){console.error(err);showToast('Something went wrong.');}
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(state&&state.settings.theme==='system')applyTheme();});

(async function boot(){
  try{
    db=await openDB(); await registerSW();
    const security=await idbGet('meta','security');
    if(!security) await setupPassword(); else await login();
  }catch(err){console.error(err);$('#app').innerHTML='<div class="auth"><div class="auth-card"><h1 class="auth-title">MONEYLOG could not start.</h1><p class="auth-copy">Use MONEYLOG from HTTPS or localhost so encrypted storage and the offline app shell are available.</p></div></div>';}
})();
