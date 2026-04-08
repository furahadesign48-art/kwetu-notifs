const admin = require('firebase-admin');
const axios = require('axios');

// Récupération des accès depuis les variables d'environnement Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
console.log("🚀 Serveur Kwetu LIVE - Surveillance avec sécurité activée...");

// Fonction d'envoi robuste
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

    // ✅ VÉRIFICATION SÉCURISÉE DE LA RÉPONSE
    if (response.data && response.data.data && response.data.data[0]) {
      const ticket = response.data.data[0];
      if (ticket.status === 'ok') {
        console.log(`✅ NOTIF ENVOYÉE à: ${expoPushToken}`);
      } else {
        console.error(`❌ Erreur Expo pour ${expoPushToken}: ${ticket.message}`);
      }
    } else {
      console.error("⚠️ Réponse Expo malformée :", response.data);
    }

  } catch (error) {
    // Gestion propre des erreurs sans crasher
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`❌ ERREUR CRITIQUE EXPO: ${errorMsg}`);
  }
}

// Surveillance des messages (Exemple pour le chat)
db.collection('messages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      
      // On évite les messages déjà traités (selon votre logique)
      const now = new Date();
      const msgTime = new Date(msg.createdAt);
      if (now - msgTime > 30000) return; // Ignore les messages vieux de plus de 30s

      console.log(`💬 Nouveau message détecté de: ${msg.senderName || 'Inconnu'}`);

      // Logique pour trouver le destinataire et son token
      // Ici, vous devez récupérer le token Firestore de l'utilisateur concerné
      // Exemple simplifié :
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
