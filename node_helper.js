/** *******************************

  Node Helper for MMM-OneCallWeather.

  This helper is responsible for the DarkSky-compatible data pull from OpenWeather.
  At a minimum the API key, Latitude and Longitude parameters
  must be provided.  If any of these are missing, the request
  to OpenWeather will not be executed, and instead an error
  will be output the the MagicMirror log.

  Additional, this module supplies two optional parameters:

    units - one of "metric", "imperial", or "" (blank)
    lang - Any of the languages OpenWeather supports, as listed here: https://openweathermap.org/api/one-call-api#multi

  The DarkSky-compatible API request looks like this:

    https://api.openweathermap.org/data/2.5/onecall?lat=LATITUDE&lon=LONGITUDE&units=XXX&lang=YY&appid=API_KEY

******************************** */

const NodeHelper = require("node_helper");
const Log = require("logger");
const moment = require("moment");
const axios = require("axios").default;

module.exports = NodeHelper.create({
  start() {
    //    console.log("====================== Starting node_helper for module [" + this.name + "]");
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "OPENWEATHER_ONECALL_GET") {
      const self = this;
      Log.log("node received");
      if (payload.apikey == null || payload.apikey === "") {
        Log.log(
          `[MMM-OneCallWeather] ${moment().format(
            "D-MMM-YY HH:mm"
          )} ** ERROR ** No API key configured. Get an API key at https://openweathermap.org/api/one-call-api`
        );
      } else if (
        payload.latitude == null ||
        payload.latitude === "" ||
        payload.longitude == null ||
        payload.longitude === ""
      ) {
        Log.log(
          `[MMM-OneCallWeather] ${moment().format(
            "D-MMM-YY HH:mm"
          )} ** ERROR ** Latitude and/or longitude not provided.`
        );
      } else {
        const myurl =
          `https://api.openweathermap.org/data/2.5/onecall` +
          `?lat=${payload.latitude}&lon=${payload.longitude}${
            payload.units !== "" ? `&units=${payload.units}` : ""
          }&exclude${payload.exclude}&appid=${payload.apikey}&lang=${
            payload.language
          }`;

        // make request to OpenWeather onecall API

        axios
          .get(myurl)
          .then(function handleData(response) {
            // handle success
            //          console.log("got request loop " + myurl);    		// uncomment to see in terminal
            response.data.instanceId = payload.instanceId;
            self.sendSocketNotification(
              "OPENWEATHER_ONECALL_DATA",
              response.data
            );
            //          console.log("sent the data back" );
          })
          .catch(function handleError(error) {
            // handle error
            Log.log(
              `[MMM-OneCallWeather] ${moment().format(
                "D-MMM-YY HH:mm"
              )} ** ERROR ** ${error}`
            );
          });
      }
    }
  }
});
