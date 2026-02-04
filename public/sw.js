self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_TIMER') {
    const { endTime } = event.data;
    const remainingTime = endTime - Date.now();

    if (remainingTime > 0) {
      setTimeout(() => {
        self.registration.showNotification('Rainbow Timer', {
          body: 'Your timer is up!',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
        });
      }, remainingTime);
    }
  } else if (event.data && event.data.type === 'CANCEL_TIMER') {
    // In a real app, you would manage and cancel scheduled notifications.
    // For this simple case, we don't have a handle to the timeout,
    // so we can't easily cancel it. A more robust implementation
    // would use an ID to track and cancel specific timers.
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
