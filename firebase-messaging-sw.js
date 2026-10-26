importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA0kTH70Gm6SXmk2i32D-wFpr97mXlufco",
  authDomain: "haru-shop-32b38.firebaseapp.com",
  projectId: "haru-shop-32b38",
  storageBucket: "haru-shop-32b38.firebasestorage.app",
  messagingSenderId: "675983958231",
  appId: "1:675983958231:web:398bf3df20fb83967c9092",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || "하루상점 알림";
  const options = {
    body: payload.notification?.body || "새 알림이 도착했습니다.",
    data: {link: payload.fcmOptions?.link || "https://haru-shop-jay.vercel.app"},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const link = event.notification.data?.link || "https://haru-shop-jay.vercel.app";
  event.waitUntil(clients.openWindow(link));
});
