require('dotenv').config();
const Vonage = require('@vonage/server-sdk');
const got = require('got');


const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const vonage = new Vonage(
  {
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    applicationId: process.env.APP_ID,
    privateKey: './private.key'
  },
  {
    apiHost: 'https://messages-sandbox.nexmo.com/',
  }
);

let RESTAURANT_IS_OFFLINE = {status: true, count: 0, name: ""};


const getRestaurant = async (reqRestaurant) => {
    const response = await got.get(`https://restaurant-api.wolt.com/v3/venues/slug/${reqRestaurant}`)
        .json();

    return response.results[0];
}


  const sendFacebookMessage = async (text, req, res) => {
    vonage.channel.send(
      req.body.from,
      req.body.to,
      {
        content: {
          type: 'text',
          text: text,
        },
      },
      (err, data) => {
        if (err) {
          console.error(err);
        } else {
          console.log(data.message_uuid);
        }
      }
    );
  }

const sendStatusMessage = (restaurant, req, res) => {

  if (restaurant.online) {
    RESTAURANT_IS_OFFLINE.status = false;
    sendFacebookMessage(`Hey, ${restaurant.name[0].value} is now accepting orders!!`, req, res);
  } else {
    if (RESTAURANT_IS_OFFLINE.count == 0){
      sendFacebookMessage(`Sorry, ${restaurant.name[0].value} is currently offline. I'll ping you when it's open again!`, req, res);
    }
     RESTAURANT_IS_OFFLINE = {status: true, count: 1};
  }
}

app.post('/inbound', async (req, res) => {

  const requestedRestaurant = await req.body.message.content.text.split('/').pop();
  const restaurant = await getRestaurant(requestedRestaurant);
  RESTAURANT_IS_OFFLINE.name = restaurant.name[0].value;
  sendStatusMessage(restaurant, req, res);

  while(RESTAURANT_IS_OFFLINE.status){
    setInterval(await theLoop(), 600000);
  }

  res.send('ok');
});

  app.post('/status', (req, res) => {
  res.status(204).end();
});

const theLoop = async () => {
  const restaurant = await getRestaurant(RESTAURANT_IS_OFFLINE.name);
  const status = restaurant.online;
  sendStatusMessage(status);
}


app.listen(3000);


