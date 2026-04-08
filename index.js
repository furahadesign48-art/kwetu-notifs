const admin = require('firebase-admin');
const axios = require('axios');
const http = require('http');

// 1. INITIALISATION FIREBASE
// Assurez-vous que FIREBASE_SERVICE_ACCOUNT et EXPO_ACCESS_TOKEN sont dans vos variables d'env sur Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
console.log("🚀 Serveur Kwetu LIVE - Surveillance avec sécurité activée...");

// 2. FONCTION D'ENVOI DE NOTIFICATION ROBUSTE
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
    console.log(`⚠️ Token invalide ignoré: ${expoPushToken}`);
    return;
  }
  
  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', 
      {
        to: expoPushToken,
        title,
        body,
        data,
        channelId: "default",
        priority: "high",
        sound: "default"
      },
      {
        headers: {
          'Authorization': `Bearer ${expoAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
    );

    // ✅ VÉRIFICATION FLEXIBLE (Gère tableau ou objet direct d'Expo)
    if (response.data && response.data.data) {
      const expoData = response.data.data;
      const ticket = Array.isArray(expoData) ? expoData[0] : expoData;

      if (ticket && ticket.status === 'ok') {
        console.log(`✅ NOTIF ENVOYÉE à: ${expoPushToken} (ID: ${ticket.id || 'N/A'})`);
      } else if (ticket && ticket.status === 'error') {
        console.error(`❌ Erreur Expo pour ${expoPushToken}: ${ticket.message}`);
      }
    } else {
      console.error("⚠️ Réponse Expo malformée :", response.data);
    }

  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`❌ ERREUR CRITIQUE EXPO: ${errorMsg}`);
  }
}

// 3. SURVEILLANCE DES MESSAGES (CHAT)
db.collection('messages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      
      // Sécurité : Ne pas traiter les vieux messages au démarrage
      const now = new Date();
      const msgTime = new Date(msg.createdAt);
      if (now - msgTime > 30000) return; 

      console.log(`💬 Nouveau message détecté de: ${msg.senderName || 'Inconnu'}`);

      // Récupération du token du destinataire
      if (msg.chatId) {
        const userDoc = await db.collection('users').doc(msg.chatId).get();
        if (userDoc.exists) {
          const token = userDoc.data().expoPushToken || userDoc.data().pushToken;
          if (token) {
            await sendPushNotification(
              token,
              `Message de ${msg.senderName}`,
              msg.text,
              { screen: 'Chat', chatId: msg.senderId }
            );
          }
        }
      }
    }
  });
});

// 4. MINI SERVEUR HTTP (Pour éviter l'erreur de port sur Render)
const port = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Serveur de notifications Kwetu actif\n');
}).listen(port, () => {
  console.log(`🌍 Monitoring HTTP actif sur le port ${port}`);
});
