// =============================================
// 🔧 Utils — Per-user Firestore Cart
// =============================================

// ── Toast ─────────────────────────────────────
function showToast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Get current user's cart Firestore ref ─────
function getCartRef() {
  const user = auth.currentUser;
  if (!user) return null;
  return db.collection("carts").doc(user.uid);
}

// ── Load cart from Firestore (returns array) ──
async function loadCartFromFirestore() {
  const ref = getCartRef();
  if (!ref) return [];
  try {
    const snap = await ref.get();
    if (snap.exists && Array.isArray(snap.data().items)) {
      return snap.data().items;
    }
    return [];
  } catch (err) {
    console.error("Cart load error:", err);
    return [];
  }
}

// ── Save cart array to Firestore ─────────────
async function saveCartToFirestore(items) {
  const ref = getCartRef();
  if (!ref) return;
  try {
    await ref.set({ items, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Cart save error:", err);
  }
}

// ── Add item to cart ─────────────────────────
async function addToCart(product) {
  const items = await loadCartFromFirestore();
  const existing = items.find(i => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit || "",
      imageUrl: product.imageUrl || "",
      qty: 1
    });
  }
  await saveCartToFirestore(items);
  await updateCartBadge();
  return items;
}

// ── Update quantity (removes if qty <= 0) ─────
async function updateQty(productId, newQty) {
  let items = await loadCartFromFirestore();
  if (newQty <= 0) {
    items = items.filter(i => i.id !== productId);
  } else {
    const item = items.find(i => i.id === productId);
    if (item) item.qty = newQty;
  }
  await saveCartToFirestore(items);
  await updateCartBadge();
  return items;
}

// ── Clear entire cart ─────────────────────────
async function clearCart() {
  await saveCartToFirestore([]);
  await updateCartBadge();
}

// ── Update cart badge count in navbar ─────────
async function updateCartBadge() {
  const items = await loadCartFromFirestore();
  const total = items.reduce((sum, i) => sum + i.qty, 0);
  ["cartBadge", "cartBadge2"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (total > 0) {
      el.textContent = total;
      el.style.display = "inline-block";
    } else {
      el.style.display = "none";
    }
  });
  return total;
}

// ── Calculate cart total ──────────────────────
function calcCartTotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// ── Format currency ───────────────────────────
function formatRupees(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

// ── Require auth or redirect ──────────────────
function requireAuth(redirectTo = "../pages/login.html") {
  return new Promise(resolve => {
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}