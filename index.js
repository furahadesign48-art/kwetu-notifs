const admin = require('firebase-admin');
const axios = require('axios');
const http = require('http');

// Récupération sécurisée de la configuration
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log("🚀 Serveur de notifications Kwetu démarré...");

// Fonction d'envoi vers Expo
// Remplacez la fonction sendPushNotification dans votre index.js sur GitHub :
async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return;
  try {
    await axios.post('https://exp.host/--/api/v2/push/send', {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      channelId: "default", // <--- Ajoutez cette ligne
      priority: "high"      // <--- Ajoutez cette ligne pour réveiller le téléphone
    });
    console.log(`✅ Notification envoyée à ${expoPushToken}`);
  } catch (error) {
    console.error("❌ Erreur Expo:", error.message);
  }
}

// SURVEILLANCE DES MESSAGES (Instantané)
db.collection('messages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      // On ne notifie que si le message n'est pas encore lu (read: false)
      if (msg.read === false) {
        const recipientDoc = await db.collection('users').doc(msg.chatId).get();
        if (recipientDoc.exists) {
          const userData = recipientDoc.data();
          const token = userData.expoPushToken || userData.pushToken;
          if (token) {
            sendPushNotification(
              token,
              `Message de ${msg.senderName}`,
              msg.text,
              { screen: 'Chat', params: { chatId: msg.senderId, chatName: msg.senderName } }
            );
          }
        }
      }
    }
  });
});

// Garder le serveur vivant (requis par Render)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Kwetu Notifications is Running');
}).listen(process.env.PORT || 3000);
