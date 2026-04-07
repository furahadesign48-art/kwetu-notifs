const admin = require('firebase-admin');
const axios = require('axios');
const http = require('http');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
console.log("🚀 Serveur Kwetu LIVE - Surveillance activée...");

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return;
  try {
    await axios.post('https://exp.host/--/api/v2/push/send', {
      to: expoPushToken,
      title,
      body,
      data,
      channelId: "default",
      priority: "high",
      sound: "default"
    });
    console.log(`✅ NOTIF ENVOYÉE à: ${expoPushToken}`);
  } catch (error) {
    console.error("❌ ERREUR EXPO:", error.response ? error.response.data : error.message);
  }
}

// SURVEILLANCE DES MESSAGES
db.collection('messages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      console.log(`📩 Nouveau message détecté de: ${msg.senderName}`);
      
      // On notifie seulement si non lu
      if (msg.read === false) {
        const recipientDoc = await db.collection('users').doc(msg.chatId).get();
        if (recipientDoc.exists) {
          const token = recipientDoc.data().pushToken || recipientDoc.data().expoPushToken;
          if (token) {
            await sendPushNotification(token, `Message de ${msg.senderName}`, msg.text, { 
              screen: 'Chat', 
              params: { chatId: msg.senderId, chatName: msg.senderName } 
            });
          } else {
            console.log(`⚠️ Aucun token trouvé pour l'utilisateur: ${msg.chatId}`);
          }
        } else {
          console.log(`❌ Utilisateur destinataire introuvable: ${msg.chatId}`);
        }
      }
    }
  });
}, err => {
  console.error("❌ ERREUR SNAPSHOT FIRESTORE:", err);
});

// Serveur HTTP pour Render
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Kwetu Server is running');
}).listen(process.env.PORT || 3000);
