/* Witty Yeti — shared cart drawer.
 * Ports the live-storefront ShopifyCartDrawer to a static-HTML demo in
 * WY brand colors. Persists cart state to localStorage, wires up every
 * .nav-cart trigger on the page, handles qty controls, per-item notes,
 * bundle upsells, trust signals, and the checkout CTA. */
(function () {
  'use strict';

  // ── Demo seed data ────────────────────────────────────────────────────
  // First visit gets a populated cart so the drawer isn't empty by default.
  const SEED_ITEMS = [
    {
      id: 'line-demo-1',
      name: 'MicroPenisCure.com',
      variant: 'Make Them Sign For It',
      price: 2199,
      qty: 1,
      image: 'images/micropenis1.webp',
      slug: 'micropeniscure-prank-mail',
      note: '',
    },
    {
      id: 'line-demo-2',
      name: 'BigAssDildos.com',
      variant: 'No Signature Required',
      price: 2199,
      qty: 1,
      image: 'images/bigassdildos2.webp',
      slug: 'bigassdildos-prank-mail',
      note: '',
    },
  ];

  const STORAGE_KEY = 'wy-cart';

  // ── State ─────────────────────────────────────────────────────────────
  const state = {
    items: loadCart(),
    isOpen: false,
    editingNoteFor: null,
  };

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ITEMS));
        return JSON.parse(JSON.stringify(SEED_ITEMS));
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return JSON.parse(JSON.stringify(SEED_ITEMS));
    }
  }

  function saveCart() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); } catch (_) {}
  }

  const formatPrice = (cents) => '$' + (cents / 100).toFixed(2);
  const totalQty    = () => state.items.reduce((s, i) => s + i.qty, 0);
  const subtotal    = () => state.items.reduce((s, i) => s + i.price * i.qty, 0);
  const escapeHTML  = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));

  // ── Drawer markup (injected once) ─────────────────────────────────────
  const DRAWER_HTML = `
    <div class="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Shopping cart" aria-hidden="true">
      <div class="cart-drawer__overlay" data-cart-close></div>
      <aside class="cart-drawer__panel">
        <header class="cart-drawer__header">
          <h2 class="cart-drawer__title">Your Cart <span class="cart-drawer__count" id="cartCountLabel"></span></h2>
          <button type="button" class="cart-drawer__close" data-cart-close aria-label="Close cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </header>

        <div class="cart-drawer__ship-bar" id="cartShipBar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          <span>Free shipping unlocked. Your friend is doomed.</span>
        </div>

        <div class="cart-drawer__body" id="cartDrawerBody"></div>

        <footer class="cart-drawer__footer" id="cartDrawerFooter">
          <div class="cart-drawer__subtotal-row">
            <span>Subtotal</span>
            <span id="cartSubtotal">$0.00</span>
          </div>
          <div class="cart-drawer__trust">
            <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Free shipping</span>
            <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> 3–5 days</span>
            <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Anonymous</span>
          </div>
          <button type="button" class="btn btn--primary btn--lg cart-drawer__checkout cta-pulse" id="cartCheckoutBtn">
            Proceed to Checkout
          </button>
          <p class="cart-drawer__checkout-note">Plain-label packaging. No return address.</p>
        </footer>
      </aside>
    </div>
  `;

  // ── Render ────────────────────────────────────────────────────────────
  function render() {
    const qty = totalQty();

    // Nav badge
    document.querySelectorAll('.nav-cart__count').forEach((el) => {
      el.textContent = String(qty);
    });
    document.querySelectorAll('.nav-cart').forEach((el) => {
      el.setAttribute('aria-label', `Cart (${qty} ${qty === 1 ? 'item' : 'items'})`);
    });

    // Header count
    const countLabel = document.getElementById('cartCountLabel');
    if (countLabel) countLabel.textContent = qty > 0 ? '(' + qty + ')' : '';

    // Subtotal
    const subEl = document.getElementById('cartSubtotal');
    if (subEl) subEl.textContent = formatPrice(subtotal());

    // Footer + ship bar visibility
    const footer  = document.getElementById('cartDrawerFooter');
    const shipBar = document.getElementById('cartShipBar');
    const isEmpty = state.items.length === 0;
    if (footer)  footer.hidden  = isEmpty;
    if (shipBar) shipBar.hidden = isEmpty;

    // Body
    const body = document.getElementById('cartDrawerBody');
    if (!body) return;

    if (isEmpty) {
      body.innerHTML = `
        <div class="cart-drawer__empty">
          <div class="cart-drawer__empty-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h3>Your cart is empty.</h3>
          <p>Your friend's mailbox doesn't have to be.</p>
          <a class="btn btn--primary btn--lg cta-pulse" href="collection.html" data-cart-close>Browse the Pranks</a>
        </div>
      `;
      return;
    }

    // Items + bundle upsells
    body.innerHTML = `
      <ul class="cart-items">
        ${state.items.map((it) => {
          const editing = state.editingNoteFor === it.id;
          return `
            <li class="cart-item" data-id="${it.id}">
              <a class="cart-item__img-wrap" href="product.html" data-cart-close>
                <img class="cart-item__img" src="${escapeHTML(it.image)}" alt="" />
              </a>
              <div class="cart-item__body">
                <a class="cart-item__name" href="product.html" data-cart-close>${escapeHTML(it.name)}</a>
                ${it.variant && it.variant !== 'Default Title' ? `<span class="cart-item__variant">${escapeHTML(it.variant)}</span>` : ''}
                <span class="cart-item__price">
                  ${formatPrice(it.price)}${it.qty > 1 ? ` <span class="cart-item__qty-inline">× ${it.qty}</span>` : ''}
                </span>

                ${editing
                  ? `<div class="cart-item__note-edit">
                      <textarea data-note-input maxlength="200" rows="2" placeholder="Gift note, recipient instructions, etc." aria-label="Package note">${escapeHTML(it.note || '')}</textarea>
                      <div class="cart-item__note-actions">
                        <button type="button" data-note-save>Save</button>
                        <button type="button" data-note-cancel>Cancel</button>
                      </div>
                    </div>`
                  : (it.note
                    ? `<div class="cart-item__note">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>&ldquo;${escapeHTML(it.note)}&rdquo;</span>
                        <button type="button" data-note-edit aria-label="Edit note">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                        </button>
                      </div>`
                    : `<button type="button" class="cart-item__add-note" data-note-edit>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Add note
                      </button>`)
                }

                <div class="cart-item__controls">
                  <div class="cart-qty" role="group" aria-label="Quantity">
                    <button type="button" data-qty="down" aria-label="Decrease quantity">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
                    </button>
                    <span class="cart-qty__value">${it.qty}</span>
                    <button type="button" data-qty="up" aria-label="Increase quantity">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    </button>
                  </div>
                  <button type="button" class="cart-item__trash" data-remove aria-label="Remove item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              ${it.qty > 1 ? `<div class="cart-item__line-total">${formatPrice(it.price * it.qty)}</div>` : ''}
            </li>
          `;
        }).join('')}
      </ul>

      <section class="cart-drawer__bundles">
        <p class="cart-drawer__section-label">Add more chaos</p>

        <a class="cart-bundle-row" href="bundle.html?tier=double" data-cart-close>
          <span class="cart-bundle-row__save cart-bundle-row__save--popular">Save 15%</span>
          <span class="cart-bundle-row__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="9" height="15" rx="1.5"/><rect x="13" y="5" width="9" height="15" rx="1.5"/></svg>
          </span>
          <span class="cart-bundle-row__body">
            <strong>Double Trouble</strong>
            <span>Add any second product. Save 15% on both.</span>
          </span>
          <svg class="cart-bundle-row__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>

        <a class="cart-bundle-row" href="bundle.html?tier=triple" data-cart-close>
          <span class="cart-bundle-row__save cart-bundle-row__save--hot">Save 25%</span>
          <span class="cart-bundle-row__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="7" height="15" rx="1.2"/><rect x="8.5" y="5" width="7" height="15" rx="1.2"/><rect x="16" y="5" width="7" height="15" rx="1.2"/></svg>
          </span>
          <span class="cart-bundle-row__body">
            <strong>Triple Threat</strong>
            <span>Pick two more. Save 25% on the whole cart.</span>
          </span>
          <svg class="cart-bundle-row__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </section>
    `;
  }

  // ── Open / close ──────────────────────────────────────────────────────
  function open() {
    if (state.isOpen) return;
    state.isOpen = true;
    const drawer = document.getElementById('cartDrawer');
    drawer.setAttribute('aria-hidden', 'false');
    // Next frame so the transition fires
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }
  function close() {
    if (!state.isOpen) return;
    state.isOpen = false;
    state.editingNoteFor = null;
    const drawer = document.getElementById('cartDrawer');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(render, 0);
  }

  // ── Mutations ────────────────────────────────────────────────────────
  function changeQty(id, delta) {
    const idx = state.items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const next = state.items[idx].qty + delta;
    if (next <= 0) state.items.splice(idx, 1);
    else state.items[idx].qty = next;
    saveCart();
    render();
  }
  function removeItem(id) {
    state.items = state.items.filter((x) => x.id !== id);
    saveCart();
    render();
  }
  function updateNote(id, note) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    it.note = note;
    saveCart();
    render();
  }

  // ── Event wiring ─────────────────────────────────────────────────────
  function bindEvents() {
    // Trigger: every .nav-cart button on the page
    document.querySelectorAll('.nav-cart').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    });

    // Delegated clicks inside the drawer (including overlay / close)
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-close]')) {
        close();
        return;
      }
      const drawer = document.getElementById('cartDrawer');
      if (!drawer || !drawer.contains(e.target)) return;

      const item = e.target.closest('.cart-item');
      const id = item ? item.dataset.id : null;

      const qtyBtn = e.target.closest('[data-qty]');
      if (qtyBtn && id) {
        changeQty(id, qtyBtn.dataset.qty === 'up' ? 1 : -1);
        return;
      }
      if (e.target.closest('[data-remove]') && id) {
        removeItem(id);
        return;
      }
      if (e.target.closest('[data-note-edit]') && id) {
        state.editingNoteFor = id;
        render();
        // Focus the textarea
        setTimeout(() => {
          const ta = document.querySelector(`.cart-item[data-id="${id}"] textarea`);
          if (ta) ta.focus();
        }, 0);
        return;
      }
      if (e.target.closest('[data-note-save]') && id) {
        const ta = document.querySelector(`.cart-item[data-id="${id}"] textarea`);
        updateNote(id, ta ? ta.value.trim() : '');
        state.editingNoteFor = null;
        render();
        return;
      }
      if (e.target.closest('[data-note-cancel]')) {
        state.editingNoteFor = null;
        render();
        return;
      }

      if (e.target.closest('#cartCheckoutBtn')) {
        alert('Demo checkout. In production this routes to Shopify.');
      }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) close();
    });
  }

  function init() {
    // Don't inject twice if the script is accidentally loaded again
    if (document.getElementById('cartDrawer')) return;
    document.body.insertAdjacentHTML('beforeend', DRAWER_HTML);
    render();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
