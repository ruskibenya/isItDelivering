require('dotenv').config();
const Vonage = require('@vonage/server-sdk');
const got = require('got');

const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const TIMEOUT = 600000;

let intervalId;
let shouldPing = true;
let CURRENT_RESTAURANT = {};

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

const setNewCurrentRestaurant = (restaurant) => {
  CURRENT_RESTAURANT = {
    name: restaurant.name[0].value,
    isOnline: restaurant.online,
  };
}

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

const sendStatusMessage = (req) => {
  if (CURRENT_RESTAURANT.isOnline) {
    sendFacebookMessage(`Hey, ${CURRENT_RESTAURANT.name} is now accepting orders!!`, req);
  } else if (shouldPing) {
    sendFacebookMessage(`Sorry, ${CURRENT_RESTAURANT.name} is currently offline. I'll ping you when it's open again!`, req);
    shouldPing = false;
  }
}

const theLoop = async (req) => {
  const restaurant = await getRestaurant(CURRENT_RESTAURANT.name);
  setNewCurrentRestaurant(restaurant);
  sendStatusMessage(req);
  if (CURRENT_RESTAURANT.isOnline) {
    clearInterval(intervalId);
    intervalId = null;
  } 
}

// the route is more RESTful
app.post('/restaurants/:name/status', async (req, res) => {
  const requestedRestaurant = req.params.name;
  const restaurant = await getRestaurant(requestedRestaurant);
  setNewCurrentRestaurant(restaurant);
  // When there is a new restaurant request, we set shouldPing to true
  shouldPing = true;
  sendStatusMessage(req);
  // Start interval only if we havent yet started one
  if (!intervalId) {
    // Don't need to pass the entire req but it is simpler this way i believe
    intervalId = setInterval(await theLoop(req), TIMEOUT);
  }
  res.send('ok');
});

app.listen(3000);


