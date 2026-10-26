import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getMessaging, onMessage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0kTH70Gm6SXmk2i32D-wFpr97mXlufco",
  authDomain: "haru-shop-32b38.firebaseapp.com",
  projectId: "haru-shop-32b38",
  storageBucket: "haru-shop-32b38.firebasestorage.app",
  messagingSenderId: "675983958231",
  appId: "1:675983958231:web:398bf3df20fb83967c9092"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "ko";

const messaging = getMessaging(app);
onMessage(messaging, payload => {
  if (Notification.permission !== "granted") return;
  const title = payload.notification?.title || "하루상점 알림";
  const options = {body: payload.notification?.body || "새 알림이 도착했습니다."};
  new Notification(title, options);
});

function paintAuthArea(user) {
  document.querySelectorAll("nav.site").forEach(nav => {
    let area = nav.querySelector(".auth-area");
    if (!area) {
      area = document.createElement("span");
      area.className = "auth-area";
      nav.appendChild(area);
    }

    area.replaceChildren();

    if (user) {
      if (user.photoURL) {
        const avatar = document.createElement("img");
        avatar.className = "auth-avatar";
        avatar.src = user.photoURL;
        avatar.alt = "프로필 사진";
        area.append(avatar);
      }

      const email = document.createElement("span");
      email.className = "auth-email";
      email.textContent = user.email;

      const mypage = document.createElement("a");
      mypage.href = "mypage.html";
      mypage.textContent = "마이페이지";

      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "auth-logout";
      logout.textContent = "로그아웃";
      logout.addEventListener("click", async () => {
        await signOut(auth);
        location.href = "index.html";
      });

      area.append(email, mypage, logout);
    } else {
      const login = document.createElement("a");
      login.href = "login.html";
      login.textContent = "로그인";
      area.append(login);
    }
  });
}

let resolveAuthReady;
const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

onAuthStateChanged(auth, user => {
  paintAuthArea(user);
  resolveAuthReady(user);
});

export { app, auth, authReady };
