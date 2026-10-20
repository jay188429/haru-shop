/* ===========================================================
   하루 상점 — 화면을 그리고 장바구니를 다루는 코드
   이 파일은 고치지 않아도 됩니다. (상품은 shop.js 에 있습니다)
   =========================================================== */

const won = n => n.toLocaleString("ko-KR") + "원";
const findProduct = id => PRODUCTS.find(p => p.id === id);
const qs = key => new URLSearchParams(location.search).get(key);

/* --- 장바구니는 브라우저에 저장합니다 --- */
const Cart = {
  read() {
    try { return JSON.parse(localStorage.getItem("haru_cart") || "[]"); }
    catch (e) { return []; }
  },
  write(items) {
    localStorage.setItem("haru_cart", JSON.stringify(items));
  },
  add(id) {
    const items = Cart.read();
    const hit = items.find(i => i.id === id);
    if (hit) hit.qty += 1;
    else items.push({ id, qty: 1 });
    Cart.write(items);

    // ▼ 여기에 「장바구니에 담았다」를 알리는 코드가 들어갑니다 (뒤 수업에서)
// 담은 상품의 이름과 가격을 상품 목록에서 찾아 온다
const p = findProduct(id);
// 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
window.dataLayer = window.dataLayer || [];
// 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
dataLayer.push({ ecommerce: null });
// 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
dataLayer.push({
  // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
  event: "add_to_cart",
  // 같이 보내는 상품 값 묶음
  ecommerce: {
    // 어느 나라 돈인가
    currency: "KRW",
    // 금액 - 한 번 누르면 한 개라 그 상품 가격 하나
    value: p.price,
    // 담은 상품 상자 하나를 목록에 넣는다
    items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
  }
});
  },
  remove(id) {
    Cart.write(Cart.read().filter(i => i.id !== id));
  },
  clear() {
    localStorage.removeItem("haru_cart");
  },
  count() {
    return Cart.read().reduce((sum, i) => sum + i.qty, 0);
  },
  total() {
    return Cart.read().reduce((sum, i) => {
      const p = findProduct(i.id);
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
  }
};

/* --- 머리글과 꼬리글 --- */
function paintChrome() {
  // 화면마다 제목이 달라야 검색에서 구분됩니다.
  // 그래서 제목을 통째로 바꾸지 않고 가게 이름만 갈아 끼웁니다.
  document.title = document.title.replaceAll("하루 상점", SHOP.name);

  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = SHOP.name;

  const badge = document.querySelector(".cart-count");
  if (badge) badge.textContent = Cart.count();

  const foot = document.querySelector("footer.site .wrap");
  if (foot) foot.textContent = SHOP.name + " · " + SHOP.tagline;
}

/* --- 상품 목록 --- */
function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;
  if (box.dataset.source === "firestore") return;

  document.querySelector("#hero-title").textContent = SHOP.name;
  document.querySelector("#hero-tagline").textContent = SHOP.tagline;

  box.innerHTML = PRODUCTS.map(p => `
    <a class="card" href="product.html?id=${p.id}">
      <div class="thumb">${p.emoji}</div>
      <h3>${p.name}</h3>
      <p class="sum">${p.summary}</p>
      <div class="price">${won(p.price)}</div>
    </a>`).join("");
}

/* --- 상품 상세 --- */
function paintDetail() {
  const box = document.querySelector("#product-detail");
  if (!box) return;

  const p = findProduct(qs("id"));
  if (!p) { box.innerHTML = '<p class="empty">그런 상품이 없습니다.</p>'; return; }

  document.title = p.name + " — " + SHOP.name;
  box.innerHTML = `
    <div class="thumb">${p.emoji}</div>
    <div>
      <h1>${p.name}</h1>
      <div class="price">${won(p.price)}</div>
      <div class="body prose">${p.detail.map(t => `<p>${t}</p>`).join("")}</div>
      <button class="btn" id="add-to-cart">장바구니에 담기</button>
    </div>`;

  window.dataLayer = window.dataLayer || [];
  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: "view_item",
    ecommerce: {
      currency: "KRW",
      value: p.price,
      items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
    }
  });

  document.querySelector("#add-to-cart").addEventListener("click", () => {
    Cart.add(p.id);
    // add_to_cart가 태그 관리자에 잡힐 시간을 준 뒤에 넘어간다
    setTimeout(() => { location.href = "cart.html"; }, 250);
  });
}

/* --- 장바구니 --- */
function paintCart() {
  const box = document.querySelector("#cart-box");
  if (!box) return;

  const items = Cart.read();
  if (items.length === 0) {
    box.innerHTML = '<p class="empty">장바구니가 비어 있습니다.</p>';
    return;
  }

  box.innerHTML = `
    <table class="cart">
      <tr><th>상품</th><th>수량</th><th>금액</th><th></th></tr>
      ${items.map(i => {
        const p = findProduct(i.id);
        if (!p) return "";
        return `<tr>
          <td>${p.emoji} ${p.name}</td>
          <td>${i.qty}</td>
          <td>${won(p.price * i.qty)}</td>
          <td><button class="btn ghost drop" data-id="${p.id}">빼기</button></td>
        </tr>`;
      }).join("")}
    </table>
    <div class="total">합계 ${won(Cart.total())}</div>
    <a class="btn" href="checkout.html">결제하기</a>`;

  box.querySelectorAll(".drop").forEach(b => {
    b.addEventListener("click", () => { Cart.remove(b.dataset.id); location.reload(); });
  });
}

/* --- 결제 --- */
function paintCheckout() {
  const form = document.querySelector("#pay-form");
  if (!form) return;

  const sum = document.querySelector("#pay-total");
  if (sum) sum.textContent = won(Cart.total());

  // ▼ 여기에 「결제 화면이 열렸다」를 알리는 코드가 들어갑니다 (뒤 수업에서)
  window.dataLayer = window.dataLayer || [];            // 통로가 있으면 그대로 쓰고, 없으면 만든다
  dataLayer.push({ ecommerce: null });                  // 앞 push의 전자상거래 값을 비운다
  dataLayer.push({
    event: "begin_checkout",                            // 계획서 이름 글자 그대로
    free_shipping: Cart.total() >= 50000 ? "yes" : "no", // ecommerce 밖 · 합계 50000 이상이면 yes
    ecommerce: {
      currency: "KRW",                                  // 통화는 글자 KRW
      value: Cart.total(),                              // 상품 합계 숫자 · 배송비 없음
      items: Cart.read()                                // 장바구니 줄 목록을 읽는다
        .map(i => ({ p: findProduct(i.id), qty: i.qty })) // 줄마다 상품 정보를 찾아 붙인다
        .filter(x => x.p)                               // 못 찾은 상품은 뺀다
        .map(x => ({                                    // 상품마다 상자 하나
          item_id: x.p.id,                              // 상품 번호
          item_name: x.p.name,                           // 상품 이름
          price: x.p.price,                              // 가격 숫자
          quantity: x.qty                                // 수량 숫자
        }))
    }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();

    // ▼ 여기에 「결제를 마쳤다」를 알리는 코드가 들어갑니다 (뒤 수업에서)
    const items = Cart.read();
    const paymentId = "HARU-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const namedItems = items
      .map(i => ({ item: i, product: findProduct(i.id) }))
      .filter(x => x.product);
    const firstProduct = namedItems[0]?.product;
    const orderName = firstProduct
      ? firstProduct.name + (namedItems.length > 1 ? ` 외 ${namedItems.length - 1}건` : "")
      : "하루상점 주문";
    const doneUrl = new URL("done.html", location.href).href;
    const customData = {
      items: items.map(item => ({ id: item.id, qty: item.qty }))
    };

    const goToDone = result => {
      const params = new URLSearchParams();
      const resultPaymentId = result?.paymentId || paymentId;
      if (resultPaymentId) params.set("paymentId", resultPaymentId);
      if (result?.code) params.set("code", result.code);
      if (result?.message) params.set("message", result.message);
      location.href = `${doneUrl}?${params}`;
    };

    (async () => {
      try {
        const result = await PortOne.requestPayment({
          storeId: "store-2d0f7c37-89c7-4b2d-beed-01d8a7ffe28a",
          channelKey: "channel-key-697a61ba-e87e-4386-9186-1e403561a6f8",
          paymentId,
          orderName,
          totalAmount: Cart.total(),
          currency: "KRW",
          payMethod: "CARD",
          customData,
          redirectUrl: doneUrl
        });
        goToDone(result);
      } catch (error) {
        goToDone({
          paymentId,
          code: error?.code || "PAYMENT_FAILED",
          message: error?.message || String(error)
        });
      }
    })();
  });
}

/* --- 가게 소개·배송 안내 글 --- */
function paintProse() {
  const about = document.querySelector("#about-body");
  if (about) about.innerHTML = SHOP.about.map(t => `<p>${t}</p>`).join("");

  const ship = document.querySelector("#shipping-body");
  if (ship) ship.innerHTML = SHOP.shipping.map(t => `<p>${t}</p>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  paintChrome();
  paintList();
  paintDetail();
  paintCart();
  paintCheckout();
  paintProse();
});

const authScript = document.createElement("script");
authScript.type = "module";
authScript.src = "assets/auth.js";
document.head.appendChild(authScript);

