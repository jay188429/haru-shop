import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getDownloadURL, getStorage, ref } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { app, authReady } from "./auth.js";

const db = getFirestore(app);
const storage = getStorage(app);
const stocks = {
  p2: { stock: 30, isVisible: true },
  p3: { stock: 8, isVisible: true },
  p4: { stock: 0, isVisible: true },
  p5: { stock: 5, isVisible: false },
  p6: { stock: 40, isVisible: true }
};

function setReadCount(host, count) {
  let line = host.parentElement.querySelector("#firestore-read-count");
  if (!line) {
    line = document.createElement("p");
    line.id = "firestore-read-count";
    host.parentElement.append(line);
  }
  line.className = "read-count";
  line.textContent = `이번 화면에서 읽은 문서 ${count}장`;
}

function setUploadStatus(control, message) {
  const status = control.querySelector(".product-upload-status");
  status.textContent = message;
}

function addUploadControl(box) {
  authReady.then(user => {
    if (!user || document.querySelector("#product-upload-control")) return;

    const control = document.createElement("div");
    control.id = "product-upload-control";
    control.className = "product-upload";
    control.innerHTML = `
      <button class="btn" id="upload-products" type="button">상품 올리기</button>
      <p class="product-upload-status" aria-live="polite"></p>`;
    box.parentElement.insertBefore(control, box);

    control.querySelector("#upload-products").addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;

      try {
        const batch = writeBatch(db);
        PRODUCTS.filter(product => stocks[product.id]).forEach(product => {
          const setting = stocks[product.id];
          batch.set(doc(db, "products", product.id), {
            name: product.name,
            price: product.price,
            summary: product.summary,
            stock: setting.stock,
            isVisible: setting.isVisible,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
        setUploadStatus(control, "상품 5개를 올렸습니다.");
      } catch (error) {
        setUploadStatus(control, String(error));
      } finally {
        button.disabled = false;
      }
    });
  });
}

let lastDoc = null;
let listReadCount = 0;
let listLoading = false;

function setMoreButton(box, visible) {
  let button = box.parentElement.querySelector("#load-more-products");
  if (!button) {
    button = document.createElement("button");
    button.id = "load-more-products";
    button.className = "btn";
    button.type = "button";
    button.textContent = "더 보기";
    box.parentElement.append(button);
    button.addEventListener("click", () => loadListPage(box));
  }
  button.hidden = !visible;
  return button;
}

function appendProducts(box, snapshot) {
  const localProducts = new Map(PRODUCTS.map(product => [product.id, product]));
  const products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  const cards = products.map(product => {
    const local = localProducts.get(product.id);
    const stock = Number(product.stock || 0);
    return `
      <a class="card" href="product.html?id=${product.id}">
        <div class="thumb" data-product-id="${product.id}">${local?.emoji || ""}</div>
        <h3>${product.name}</h3>
        <p class="sum">${product.summary}</p>
        <div class="price">${won(product.price)}</div>
        <p class="stock">${stock === 0 ? "품절" : `재고 ${stock}개`}</p>
      </a>`;
  }).join("");
  box.insertAdjacentHTML("beforeend", cards);
  products.filter(product => product.imagePath).forEach(product => {
    getDownloadURL(ref(storage, product.imagePath))
      .then(url => {
        const imageBox = box.querySelector(`[data-product-id="${product.id}"]`);
        if (!imageBox) return;
        imageBox.innerHTML = `<img class="product-image" src="${url}" alt="${product.name}">`;
      })
      .catch(error => console.error(error));
  });
  return products.length;
}

async function loadListPage(box) {
  if (listLoading) return;
  listLoading = true;
  setMoreButton(box, false);
  if (!lastDoc) box.innerHTML = "<p>상품을 불러오는 중입니다.</p>";

  try {
    const clauses = [
      collection(db, "products"),
      where("isVisible", "==", true),
      orderBy("price", "asc"),
      limit(2)
    ];
    const pageQuery = lastDoc
      ? query(...clauses, startAfter(lastDoc))
      : query(...clauses);
    const snapshot = await getDocs(pageQuery);
    listReadCount += snapshot.size;
    setReadCount(box, listReadCount);

    if (!lastDoc && snapshot.size === 0) {
      box.innerHTML = '<p class="empty">표시할 상품이 없습니다.</p>';
    } else if (snapshot.size > 0) {
      appendProducts(box, snapshot);
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    setMoreButton(box, snapshot.size === 2);
  } catch (error) {
    console.error(error);
    setReadCount(box, listReadCount);
    box.innerHTML = '<p class="empty">목록을 불러오지 못했습니다</p>';
    setMoreButton(box, false);
  } finally {
    listLoading = false;
  }
}

async function renderDetail(box) {
  box.innerHTML = "<p>상품을 불러오는 중입니다.</p>";
  const snapshot = await getDoc(doc(db, "products", qs("id")));
  setReadCount(box, snapshot.exists() ? 1 : 0);

  if (!snapshot.exists() || snapshot.data().isVisible === false) {
    box.innerHTML = '<p class="empty">그런 상품이 없습니다.</p>';
    return;
  }

  const product = { id: snapshot.id, ...snapshot.data() };
  const local = PRODUCTS.find(item => item.id === product.id);
  if (!local) {
    box.innerHTML = '<p class="empty">그런 상품이 없습니다.</p>';
    return;
  }

  document.title = product.name + " — " + SHOP.name;
  box.innerHTML = `
    <div class="thumb">${local.emoji}</div>
    <div>
      <h1>${product.name}</h1>
      <div class="price">${won(product.price)}</div>
      <p class="sum">${product.summary}</p>
      <div class="body prose">${local.detail.map(text => `<p>${text}</p>`).join("")}</div>
      <p class="stock">${Number(product.stock || 0) === 0 ? "품절" : `재고 ${Number(product.stock)}개`}</p>
      <button class="btn" id="add-to-cart">장바구니에 담기</button>
      <button class="btn" id="buy-now" type="button">바로 주문</button>
      <p id="buy-now-status" aria-live="polite"></p>
    </div>`;

  document.querySelector("#add-to-cart").addEventListener("click", () => {
    Cart.add(product.id);
    setTimeout(() => { location.href = "cart.html"; }, 250);
  });

  const buyButton = document.querySelector("#buy-now");
  const buyStatus = document.querySelector("#buy-now-status");
  buyButton.addEventListener("click", async () => {
    buyButton.disabled = true;
    buyStatus.textContent = "";

    try {
      const user = await authReady;
      if (!user) {
        buyStatus.textContent = "로그인이 필요합니다";
        return;
      }

      const productRef = doc(db, "products", product.id);
      const orderRef = doc(collection(db, "orders"));
      await runTransaction(db, async transaction => {
        const latest = await transaction.get(productRef);
        if (!latest.exists() || Number(latest.data().stock || 0) < 1) {
          const error = new Error("재고가 없습니다");
          error.code = "out-of-stock";
          throw error;
        }

        const data = latest.data();
        const price = Number(data.price);
        transaction.update(productRef, { stock: Number(data.stock) - 1 });
        transaction.set(orderRef, {
          userId: user.uid,
          items: [{ productId: product.id, name: data.name, price, quantity: 1 }],
          totalPrice: price,
          status: "paid",
          createdAt: serverTimestamp()
        });
      });
      buyStatus.textContent = "주문했습니다";
    } catch (error) {
      buyStatus.textContent = error.code === "out-of-stock" ? "재고가 없습니다" : String(error);
    } finally {
      buyButton.disabled = false;
    }
  });
}

const listBox = document.querySelector("#product-list");
const detailBox = document.querySelector("#product-detail");

if (listBox) {
  addUploadControl(listBox);
  loadListPage(listBox);
}

if (detailBox) {
  renderDetail(detailBox);
}
