// 1. 쓰는 묶음 불러오기
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// 2. 서버용 라이브러리 준비 - 이미 준비돼 있으면 건너뛴다
if (getApps().length === 0) {
  initializeApp();
}

// 3. 주인 이메일
const OWNER_EMAIL = "jay188429@gmail.com";

// 4. 주인 계정에 관리자 커스텀 클레임을 다는 함수
exports.grantOwnerRole = onCall({ region: "us-central1" }, async (request) => {
  const token = request.auth ? request.auth.token : null;
  const email = token && token.email ? token.email.toLowerCase() : "";
  if (email !== OWNER_EMAIL.toLowerCase() || token.email_verified !== true) {
    throw new HttpsError("permission-denied", "주인 계정만 명찰을 달 수 있습니다");
  }

  await getAuth().setCustomUserClaims(request.auth.uid, { role: "admin" });
  return { role: "admin" };
});
