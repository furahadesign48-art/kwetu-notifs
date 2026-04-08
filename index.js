const admin = require('firebase-admin');
const axios = require('axios');
const http = require('http');

// Récupération des accès depuis les variables d'environnement Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN; // Le jeton de sécurité Expo

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
console.log("🚀 Serveur Kwetu LIVE - Surveillance avec sécurité activée...");

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return;
  
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
          'Authorization': `Bearer ${expoAccessToken}`, // On envoie le jeton de sécurité
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate'
        }
      }
    );
    
    const result = response.data.data[0];
    if (result.status === 'ok') {
      console.log(`✅ NOTIF LIVRÉE avec succès à: ${expoPushToken}`);
    } else {
      console.error(`❌ EXPO A REJETÉ LA LIVRAISON: ${result.message}`);
    }
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error("❌ ERREUR CRITIQUE EXPO:", errorMsg);
  }
}

// SURVEILLANCE DES MESSAGES (En temps réel)
db.collection('messages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      
      // On ne notifie que si le message est marqué non lu
      if (msg.read === false) {
        console.log(`📩 Nouveau message de: ${msg.senderName}`);
        
        const recipientDoc = await db.collection('users').doc(msg.chatId).get();
        if (recipientDoc.exists) {
          const userData = recipientDoc.data();
          const token = userData.pushToken || userData.expoPushToken;
          
          if (token) {
            await sendPushNotification(token, `Message de ${msg.senderName}`, msg.text, { 
              screen: 'Chat', 
              params: { chatId: msg.senderId, chatName: msg.senderName } 
            });
          } else {
            console.log(`⚠️ Aucun token pour l'utilisateur: ${msg.chatId}`);
          }
        }
      }
    }
  });
}, err => {
  console.error("❌ ERREUR SNAPSHOT FIRESTORE:", err);
});

// Petit serveur pour Render
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Kwetu Notifications Server is Running');
}).listen(process.env.PORT || 3000);
