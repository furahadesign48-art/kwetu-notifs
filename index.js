const admin = require('firebase-admin');
const axios = require('axios');
const http = require('http');

// INITIALISATION
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// FONCTION D'ENVOI
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return;
  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', 
      { to: expoPushToken, title, body, data, sound: "default", priority: "high" },
      { headers: { 'Authorization': `Bearer ${expoAccessToken}` } }
    );
    console.log(`✅ Notif envoyée à ${expoPushToken.substring(0, 15)}...`);
  } catch (error) {
    console.error(`❌ Erreur Notif: ${error.message}`);
  }
}

const now = new Date();

// 1. SURVEILLANCE DES MESSAGES
db.collection('messages').where('createdAt', '>', now.toISOString()).onSnapshot(snap => {
  snap.docChanges().forEach(async change => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      const userDoc = await db.collection('users').doc(msg.chatId).get();
      if (userDoc.exists && userDoc.data().expoPushToken) {
        sendPushNotification(userDoc.data().expoPushToken, `Message de ${msg.senderName}`, msg.text, { screen: 'Chat' });
      }
    }
  });
});

// 2. SURVEILLANCE DES RÉSERVATIONS
db.collection('reservations').where('createdAt', '>', now.toISOString()).onSnapshot(snap => {
  snap.docChanges().forEach(async change => {
    if (change.type === 'added') {
      const res = change.doc.data();
      // Notifier l'Admin
      const admins = await db.collection('users').where('role', '==', 'admin').get();
      admins.forEach(doc => sendPushNotification(doc.data().expoPushToken, "Nouvelle Réservation !", `${res.clientName} pour ${res.hallName}`));
    }
  });
});

// 3. SURVEILLANCE DES RAPPORTS
db.collection('reports').where('createdAt', '>', now.toISOString()).onSnapshot(snap => {
  snap.docChanges().forEach(async change => {
    if (change.type === 'added') {
      const report = change.doc.data();
      const admins = await db.collection('users').where('role', '==', 'admin').get();
      admins.forEach(doc => sendPushNotification(doc.data().expoPushToken, "Nouveau Rapport !", `${report.senderName} a envoyé un rapport.`));
    }
  });
});

// 4. SURVEILLANCE DES INCIDENTS (Maintenance)
db.collection('incidents').where('createdAt', '>', now.toISOString()).onSnapshot(snap => {
  snap.docChanges().forEach(async change => {
    if (change.type === 'added') {
      const incident = change.doc.data();
      const admins = await db.collection('users').where('role', '==', 'admin').get();
      admins.forEach(doc => sendPushNotification(doc.data().expoPushToken, "⚠️ ALERTE INCIDENT", `${incident.title} dans ${incident.hallName}`));
    }
  });
});

// SERVEUR DE SANTÉ POUR RENDER
const port = process.env.PORT || 10000;
http.createServer((req, res) => { res.writeHead(200); res.end('Actif'); }).listen(port);
