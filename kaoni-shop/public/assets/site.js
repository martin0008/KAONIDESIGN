/* ============================================
   KAONI DESIGN — site.js
   Logica condivisa da tutte le pagine: Supabase, autenticazione,
   carrello, menu di navigazione, ricerca, notifiche.
   ============================================ */

// ============================================
// CONFIGURAZIONE SUPABASE
// ============================================
const SUPABASE_URL = 'https://mcwkvozuzpyghihjylte.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MONvzORVYZ1ri4QY0yt4bg_f4bkoLZN';

let supabaseClient = null;
let supabaseReady = false;
let currentUser = null;

try{
  if(SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 10){
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseReady = true;
  }
}catch(e){
  console.warn('Supabase non disponibile su questa pagina.', e);
}

// ============================================
// UTILITY
// ============================================
function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 2600);
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function escapeAttr(str){ return (str||'').replace(/"/g,'&quot;'); }

// ============================================
// INCLUDE HEADER + CARRELLO (fetch dei partial HTML)
// ============================================
async function includePartials(){
  const headerSlot = document.getElementById('site-header-slot');
  const cartSlot = document.getElementById('site-cart-slot');

  if(headerSlot){
    const res = await fetch('/partials/header.html');
    headerSlot.innerHTML = await res.text();
  }
  if(cartSlot){
    const res = await fetch('/partials/cart-drawer.html');
    cartSlot.innerHTML = await res.text();
  }
}

// ============================================
// AUTENTICAZIONE — stato condiviso su tutte le pagine
// ============================================
if(supabaseReady){
  supabaseClient.auth.onAuthStateChange((_event, session)=>{
    currentUser = session ? session.user : null;
    updateAccountNavLabel();
  });
}

async function updateAccountNavLabel(){
  const link = document.getElementById('accountNavLink');
  if(!link) return;

  if(!supabaseReady){ link.textContent = 'Account'; return; }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session && session.user){
    currentUser = session.user;
    try{
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();
      link.textContent = (profile && profile.full_name) ? profile.full_name.split(' ')[0] : 'Account';
    }catch(e){
      link.textContent = 'Account';
    }
  } else {
    currentUser = null;
    link.textContent = 'Account';
  }
}

// ============================================
// CARRELLO (localStorage, condiviso su tutte le pagine dello stesso dominio)
// ============================================
const CART_KEY = 'kaoni-cart-v1';

function getCart(){
  try{
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

function setCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCountBadge();
}

function updateCartCountBadge(){
  const cart = getCart();
  const totalQty = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = totalQty);
}

function addToCart(productId){
  const cart = getCart();
  cart[productId] = (cart[productId] || 0) + 1;
  setCart(cart);
  showToast('Aggiunto al carrello.');
  openCart();
}

function updateCartQty(productId, delta){
  const cart = getCart();
  if(!cart[productId]) return;
  cart[productId] += delta;
  if(cart[productId] <= 0){ delete cart[productId]; }
  setCart(cart);
}

function removeFromCart(productId){
  const cart = getCart();
  delete cart[productId];
  setCart(cart);
}

async function renderCart(){
  const wrap = document.getElementById('cartItemsWrap');
  const subtotalEl = document.getElementById('cartSubtotal');
  if(!wrap || !subtotalEl) return;

  const cart = getCart();
  const ids = Object.keys(cart);

  if(ids.length === 0){
    wrap.innerHTML = '<div class="cart-empty">Il carrello è vuoto.</div>';
    subtotalEl.textContent = '€ 0.00';
    return;
  }

  if(!supabaseReady){
    wrap.innerHTML = '<div class="cart-empty">Errore di connessione al negozio.</div>';
    return;
  }

  const { data: products, error } = await supabaseClient
    .from('products')
    .select('id, title, price, image_url')
    .in('id', ids);

  if(error || !products){
    wrap.innerHTML = '<div class="cart-empty">Errore nel caricamento del carrello.</div>';
    return;
  }

  let subtotal = 0;
  wrap.innerHTML = '';
  products.forEach(p=>{
    const qty = cart[p.id];
    if(!qty) return;
    subtotal += p.price * qty;
    const thumb = p.image_url ? `<img class="cart-item-thumb" src="${escapeAttr(p.image_url)}">` : `<div class="cart-item-thumb"></div>`;
    const item = document.createElement('div');
    item.className = 'cart-item';
    item.innerHTML = `
      ${thumb}
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHtml(p.title)}</div>
        <div class="cart-item-price">€ ${Number(p.price).toFixed(2)}</div>
        <div class="cart-qty-row">
          <button class="cart-qty-btn" data-action="minus">−</button>
          <span class="cart-qty-value">${qty}</span>
          <button class="cart-qty-btn" data-action="plus">+</button>
          <button class="cart-remove-btn">Rimuovi</button>
        </div>
      </div>`;
    item.querySelector('[data-action="minus"]').addEventListener('click', ()=> updateCartQty(p.id, -1));
    item.querySelector('[data-action="plus"]').addEventListener('click', ()=> updateCartQty(p.id, 1));
    item.querySelector('.cart-remove-btn').addEventListener('click', ()=> removeFromCart(p.id));
    wrap.appendChild(item);
  });
  subtotalEl.textContent = '€ ' + subtotal.toFixed(2);
}

function openCart(){
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if(drawer) drawer.classList.add('open');
  if(overlay) overlay.classList.add('open');
  renderCart();
}
function closeCart(){
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if(drawer) drawer.classList.remove('open');
  if(overlay) overlay.classList.remove('open');
}

async function goToCheckout(){
  const cart = getCart();
  const items = Object.entries(cart).map(([id, quantity])=>({ id, quantity }));
  const errorEl = document.getElementById('cartError');
  if(errorEl) errorEl.textContent = '';

  if(items.length === 0){
    if(errorEl) errorEl.textContent = 'Il carrello è vuoto.';
    return;
  }

  // Richiede un account per acquistare
  if(supabaseReady){
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(!session){
      if(errorEl) errorEl.textContent = 'Devi accedere o registrarti per completare l\'acquisto.';
      showToast('Devi essere registrato per acquistare.');
      setTimeout(()=>{ window.location.href = '/account.html'; }, 1200);
      return;
    }
  }

  const btn = document.getElementById('checkoutBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Attendere...'; }

  try{
    const res = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if(data.url){
      window.location.href = data.url;
    } else {
      if(errorEl) errorEl.textContent = data.error || 'Errore nella creazione del pagamento.';
    }
  }catch(e){
    console.error(e);
    if(errorEl) errorEl.textContent = 'Impossibile contattare il server di pagamento.';
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = 'Vai al pagamento'; }
  }
}

function setupCartHandlers(){
  const openBtn = document.getElementById('cartOpenBtn');
  const closeBtn = document.getElementById('cartCloseBtn');
  const overlay = document.getElementById('cartOverlay');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if(openBtn) openBtn.addEventListener('click', openCart);
  if(closeBtn) closeBtn.addEventListener('click', closeCart);
  if(overlay) overlay.addEventListener('click', closeCart);
  if(checkoutBtn) checkoutBtn.addEventListener('click', goToCheckout);
  updateCartCountBadge();
}

// ============================================
// MENU (desktop + mobile), con categorie caricate da Supabase
// ============================================
async function renderNavMenus(){
  const desktop = document.getElementById('desktopMenu');
  const mobile = document.getElementById('mobileMenu');
  if(!desktop && !mobile) return;

  let categories = [];
  if(supabaseReady){
    try{
      const { data } = await supabaseClient.from('categories').select('*').order('created_at', { ascending:true });
      categories = data || [];
    }catch(e){ console.error('Errore caricamento categorie:', e); }
  }

  if(desktop){
    desktop.innerHTML = '';
    const homeItem = document.createElement('div');
    homeItem.className = 'nav-item';
    homeItem.innerHTML = '<a href="/" class="nav-link">Home</a>';
    desktop.appendChild(homeItem);

    categories.forEach(cat=>{
      const item = document.createElement('div');
      item.className = 'nav-item';
      const subs = cat.subs || [];
      const subsHtml = subs.map(s=>`<a href="/collezione.html?cat=${cat.id}&sub=${s.id}">${escapeHtml(s.name)}</a>`).join('');
      item.innerHTML = `<a href="/collezione.html?cat=${cat.id}" class="nav-link">${escapeHtml(cat.name)}</a><div class="dropdown">${subsHtml}</div>`;
      desktop.appendChild(item);
    });
  }

  if(mobile){
    mobile.innerHTML = '';
    const mobileHome = document.createElement('a');
    mobileHome.href = '/';
    mobileHome.textContent = 'Home';
    mobile.appendChild(mobileHome);

    categories.forEach(cat=>{
      const mLink = document.createElement('button');
      mLink.className = 'mobile-link';
      mLink.textContent = cat.name;
      mobile.appendChild(mLink);

      const subs = cat.subs || [];
      const mSub = document.createElement('div');
      mSub.className = 'mobile-submenu';
      mSub.innerHTML = subs.map(s=>`<a href="/collezione.html?cat=${cat.id}&sub=${s.id}">${escapeHtml(s.name)}</a>`).join('')
        + `<a href="/collezione.html?cat=${cat.id}">Vedi tutto ${escapeHtml(cat.name)}</a>`;
      mobile.appendChild(mSub);

      mLink.addEventListener('click', ()=> mSub.classList.toggle('open'));
    });

    const helpA = document.createElement('a'); helpA.href='/account.html'; helpA.textContent='Account';
    mobile.appendChild(helpA);
  }
}

function setupMobileMenuToggle(){
  const burgerBtn = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  if(!burgerBtn || !mobileMenu || !menuOverlay) return;

  function toggle(open){
    burgerBtn.classList.toggle('open', open);
    mobileMenu.classList.toggle('open', open);
    menuOverlay.classList.toggle('open', open);
  }
  burgerBtn.addEventListener('click', ()=> toggle(!mobileMenu.classList.contains('open')));
  menuOverlay.addEventListener('click', ()=> toggle(false));
}

// ============================================
// ACCESSO ADMIN (triplo click sul logo -> pagina admin.html)
// La vera verifica dei permessi avviene dentro admin.html stesso.
// ============================================
function setupAdminSecretAccess(){
  const logoBtn = document.getElementById('logoBtn');
  if(!logoBtn) return;
  let clickCount = 0, clickTimer = null;
  logoBtn.addEventListener('click', ()=>{
    clickCount++;
    if(clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(()=>{ clickCount = 0; }, 600);
    if(clickCount >= 3){
      clickCount = 0;
      window.location.href = '/admin.html';
    }
  });
}

// ============================================
// TRADUZIONE (Google Translate — copre tutte le lingue automaticamente)
// ============================================
function loadGoogleTranslate(){
  if(window.google && window.google.translate){ return; }
  window.googleTranslateElementInit = function(){
    new google.translate.TranslateElement({
      pageLanguage: 'it',
      autoDisplay: false,
      layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    }, 'google_translate_element');
  };
  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  document.body.appendChild(script);
}

// ============================================
// INIZIALIZZAZIONE COMUNE — da chiamare in ogni pagina dopo includePartials()
// ============================================
async function initSharedUI(){
  await includePartials();
  await renderNavMenus();
  setupMobileMenuToggle();
  setupCartHandlers();
  setupAdminSecretAccess();
  updateAccountNavLabel();
  loadGoogleTranslate();
}
