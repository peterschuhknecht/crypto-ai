const axios = require('axios');
const { Configuration, OpenAI } = require('openai');
const { MongoClient } = require('mongodb');
require('dotenv').config();
var cron = require('node-cron');

// OpenAI-Konfiguration
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// MongoDB-Verbindung
const mongoUri =  process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);

const weightFactor = 0.9;
let numberOfArticles = 10;

// Hilfsfunktion, um den API-Sentimentwert in eine Zahl umzuwandeln
function getSentiment(x) {
  if (x === 'Negative') {
    return -1;
  } else if (x === 'Positive') {
    return 1;
  } else {
    return 0;
  }
}

async function main() {
  try {
    await client.connect();
    const db = client.db('ai');
    const collection = db.collection('news');

    // API-URL zusammenbauen
    const url = `https://cryptonews-api.com/api/v1?tickers=BTC&items=${numberOfArticles}&page=1&token=8vmlj0xmy1gemrpkbmufwtij1bp4sg2u5jdrmtag`;
    const response = await axios.get(url);

    if (response.status === 200) {
      console.log('-----------------------');
      const data = response.data;
      let itemCount = 0;
      let sentimentCount = 0;
      const sentimentOpenai = [];
      const sentimentOpenaiWeighted = [];

      for (const item of data.data) {
        // console.log('Titel:', item.title);
        // console.log('Sentiment API:', getSentiment(item.sentiment));

        // Anfrage an die OpenAI-Chat-Completion-API
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "developer",
              content:
                "You are a financial expert who analyzes cryptocurrency news. You give a rating of the sentiment (sentiment analysis) between -1 (100% negative) and 1 (100% positive) of a news item. The sentiment has an impact on the price of the currency. You only give this one number, no additional text."
            },
            {
              role: "user",
              content: item.title + " " + item.text
            }
          ]
        });

        // console.log('OpenAI Response:', completion.choices[0].message.content);

        // Extrahiere und parse den Rückgabewert
        const sentimentValue = parseFloat(completion.choices[0].message.content);
        // console.log('Sentiment OpenAi:', sentimentValue);

        // Werte in Arrays speichern
        sentimentOpenai.push(sentimentValue);
        for (let i = 0; i < numberOfArticles + 1; i++) {
          sentimentOpenaiWeighted.push(sentimentValue);
        }

        itemCount++;
        sentimentCount += getSentiment(item.sentiment);
        numberOfArticles = parseInt(numberOfArticles * weightFactor);

        // console.log('-----------------------');
      }

      console.log('Anzahl der Artikel:', itemCount);
      console.log('Sentiment API Durchschnitt:', sentimentCount / itemCount);
      const sentimentOpenaiAvg = sentimentOpenai.reduce((a, b) => a + b, 0) / sentimentOpenai.length;
      console.log('Sentiment OpenAi Durchschnitt:', Math.round(sentimentOpenaiAvg * 100) / 100);
      const sentimentOpenaiWeightedAvg = sentimentOpenaiWeighted.reduce((a, b) => a + b, 0) / sentimentOpenaiWeighted.length;
      console.log('Sentiment OpenAi Weighted Durchschnitt:', Math.round(sentimentOpenaiWeightedAvg * 100) / 100);

      // Daten in der Datenbank speichern
      const document = {
        ticker: "BTC",
        dateTime: new Date().toISOString(),
        sentimentApi: sentimentCount / itemCount,
        sentimentOpenai: Math.round(sentimentOpenaiAvg * 100) / 100,
        sentimentOpenaiWeighted: Math.round(sentimentOpenaiWeightedAvg * 100) / 100
      };

      const result = await collection.insertOne(document);
      // console.log("Gespeicherte Objekt-ID:", result.insertedId);
    } else {
      console.log("Fehler bei der API-Anfrage:", response.status);
    }
  } catch (error) {
    console.error("Fehler:", error);
  } finally {
    await client.close();
  }
}
// cron.schedule('* * * * *', () => {
//   main();
// });

main();