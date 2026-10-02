// Minimalni service worker - postoji SAMO zbog obaveštenja o statusu
// porudžbine (Android Chrome ne prikazuje obaveštenja bez service worker-a).
// Ne kešira ništa i ne radi ništa drugo.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Klik na obaveštenje vraća kupca na otvorenu stranicu (ili je otvara)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((prozori) => {
        if (prozori.length > 0) return prozori[0].focus();
        return self.clients.openWindow(self.registration.scope);
      }),
  );
});
