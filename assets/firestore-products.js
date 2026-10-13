import { collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, where, writeBatch } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { app, authReady } from "./auth.js";

const db = getFirestore(app);
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

async function renderList(box) {
  box.innerHTML = "<p>상품을 불러오는 중입니다.</p>";
  try {
    const snapshot = await getDocs(query(collection(db, "products"), where("isVisible", "==", true)));
    setReadCount(box, snapshot.size);

    const localProducts = new Map(PRODUCTS.map(product => [product.id, product]));
    const products = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (localProducts.get(a.id)?.id || "").localeCompare(localProducts.get(b.id)?.id || ""));

    if (products.length === 0) {
      box.innerHTML = '<p class="empty">표시할 상품이 없습니다.</p>';
      return;
    }

    box.innerHTML = products.map(product => {
      const local = localProducts.get(product.id);
      const stock = Number(product.stock || 0);
      return `
        <a class="card" href="product.html?id=${product.id}">
          <div class="thumb">${local?.emoji || ""}</div>
          <h3>${product.name}</h3>
          <p class="sum">${product.summary}</p>
          <div class="price">${won(product.price)}</div>
          <p class="stock">${stock === 0 ? "품절" : `재고 ${stock}개`}</p>
        </a>`;
    }).join("");
  } catch (error) {
    setReadCount(box, 0);
    box.innerHTML = `<p class="empty">${String(error)}</p>`;
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
    </div>`;

  document.querySelector("#add-to-cart").addEventListener("click", () => {
    Cart.add(product.id);
    setTimeout(() => { location.href = "cart.html"; }, 250);
  });
}

const listBox = document.querySelector("#product-list");
const detailBox = document.querySelector("#product-detail");

if (listBox) {
  addUploadControl(listBox);
  renderList(listBox);
}

if (detailBox) {
  renderDetail(detailBox);
}
