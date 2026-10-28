/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

initializeApp();

const portoneApiSecret = defineSecret("PORTONE_API_SECRET");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.portoneWebhook = onRequest({secrets: [portoneApiSecret]}, async (request, response) => {
  const {type, data} = request.body || {};
  const paymentId = data?.paymentId;
  console.log(`type=${type} paymentId=${paymentId}`);

  try {
    const paymentResponse = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: {Authorization: `PortOne ${portoneApiSecret.value()}`},
    });
    const responseText = await paymentResponse.text();

    if (!paymentResponse.ok) {
      console.log(`조회 실패: 상태 코드 ${paymentResponse.status} 받은 글 ${responseText}`);
      return response.status(200).send("OK");
    }

    const payment = JSON.parse(responseText);
    console.log(`status=${payment.status}`);
    console.log(`amount=${payment.amount?.total}`);
    console.log(`customData=${typeof payment.customData === "string" ? payment.customData : JSON.stringify(payment.customData)}`);

    const customData = typeof payment.customData === "string" ?
      JSON.parse(payment.customData) : payment.customData || {};
    const items = Array.isArray(customData) ? customData : customData.items || [];
    const db = getFirestore();
    let expectedAmount = 0;

    for (const item of items) {
      const productSnapshot = await db.collection("products").doc(String(item.id)).get();
      const product = productSnapshot.data();
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      expectedAmount += Number(product?.price || 0) * quantity;
    }

    const paidAmount = Number(payment.amount?.total || 0);
    if (payment.status === "PAID" && paidAmount === expectedAmount) {
      console.log(`검증 통과: ${paymentId} 기준 금액 ${expectedAmount} 결제 금액 ${paidAmount}`);

      const orderRef = db.collection("orders").doc(paymentId);
      const orderCreated = await db.runTransaction(async (transaction) => {
        const existingOrder = await transaction.get(orderRef);
        if (existingOrder.exists) return false;

        transaction.create(orderRef, {
          paymentId,
          userId: data?.userId ?? payment.userId ?? "",
          items: items.map((item) => ({
            productId: String(item.id),
            quantity: Number(item.qty ?? item.quantity ?? 0),
          })),
          totalPrice: expectedAmount,
          paidAmount,
          paidAt: payment.paidAt ?? "",
          status: "paid",
          createdAt: Timestamp.now(),
        });
        return true;
      });

      if (orderCreated) {
        console.log(`주문 생성: ${paymentId}`);
      } else {
        console.log(`이미 있는 주문 - 건너뜀: ${paymentId}`);
      }
    } else {
      console.log(`금액 불일치: ${paymentId} 기준 금액 ${expectedAmount} 결제 금액 ${paidAmount}`);
    }
  } catch (error) {
    console.log(`조회 실패: ${error.message}`);
  }

  return response.status(200).send("OK");
});

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// 실습 188 도전 - shopPing : 깨어 있는지 + 상품 개수
exports.shopPing = onRequest({region: "us-central1"}, async (request, response) => {
  const now = new Date().toISOString();
  const snap = await getFirestore().collection("products").get();
  response.send("하루상점 함수가 깨어 있습니다 · " + now + " · 상품 " + snap.size + "개");
});

exports.calcOrderTotal = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const {productId, quantity} = request.data || {};
  if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity < 1) {
    throw new HttpsError("invalid-argument", "수량은 1 이상의 정수여야 합니다.");
  }

  const productSnapshot = await getFirestore().collection("products").doc(productId).get();
  if (!productSnapshot.exists) {
    throw new HttpsError("not-found", "상품을 찾을 수 없습니다.");
  }

  return {totalPrice: Number(productSnapshot.get("price")) * quantity};
});

Object.assign(exports, require("./automation"));
Object.assign(exports, require("./admin"));

exports.askShopBot = onCall({region: "us-central1", secrets: [geminiApiKey]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인한 뒤에 물어볼 수 있어요");
  }

  const question = String(request.data?.question || "").trim();
  if (!question) {
    throw new HttpsError("invalid-argument", "질문을 입력해 주세요.");
  }

  const productSnapshot = await getFirestore().collection("products").get();
  const products = productSnapshot.docs.map((productDoc) => {
    const product = productDoc.data();
    return {id: productDoc.id, name: product.name || "", price: product.price};
  });
  const prompt = [
    "너는 하루상점 상품 안내 챗봇이다.",
    "아래 상품 목록의 name과 price만 근거로 질문 하나에 답하라.",
    "상품 목록에 없는 정보는 추측하지 말고 정확히 [그건 제가 아직 모르는 내용이에요]라고 답하라.",
    "이전 대화는 기억하지 않는다. 답변만 간단히 출력하라.",
    `상품 목록: ${JSON.stringify(products)}`,
    `손님 질문: ${question}`,
  ].join("\n");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent", {
    method: "POST",
    headers: {"Content-Type": "application/json", "x-goog-api-key": geminiApiKey.value()},
    body: JSON.stringify({contents: [{parts: [{text: prompt}]}]}),
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error(`Gemini 요청 실패: ${response.status} ${responseText}`);
    throw new HttpsError("internal", "챗봇 답변을 가져오지 못했습니다.");
  }

  const result = JSON.parse(responseText);
  const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  return {answer: answer || "[그건 제가 아직 모르는 내용이에요]"};
});
