/*
 * Node Helper for MMM-OneCallWeather.
 *
 * This helper is responsible for the DarkSky-compatible data pull from OpenWeather.
 * At a minimum the API key, Latitude and Longitude parameters
 * must be provided.  If any of these are missing, the request
 * to OpenWeather will not be executed, and instead an error
 * will be output the the MagicMirror log.
 *
 * Additional, this module supplies two optional parameters:
 *
 *  units - one of "metric", "imperial", or "" (blank)
 *  lang - Any of the languages OpenWeather supports, as listed here: https://openweathermap.org/api/one-call-api#multi
 *
 * The DarkSky-compatible API request looks like this:
 *
 *  https://api.openweathermap.org/data/2.5/onecall?lat=LATITUDE&lon=LONGITUDE&units=XXX&lang=YY&appid=API_KEY
 */

const NodeHelper = require("node_helper");
const Log = require("logger");
const moment = require("moment");

module.exports = NodeHelper.create({
  start () {
    // Log.log("====================== Starting node_helper for module [" + this.name + "]");
  },

  socketNotificationReceived (notification, config) {
    if (notification === "OPENWEATHER_ONECALL_GET") {
      const self = this;
      Log.log("node received");
      if (config.apikey === null || config.apikey === "") {
        Log.log(`[MMM-OneCallWeather] ${moment().format("D-MMM-YY HH:mm")} ** ERROR ** No API key configured. Get an API key at https://openweathermap.org/api/one-call-api`);
      } else if (
        config.latitude === null ||
        config.latitude === "" ||
        config.longitude === null ||
        config.longitude === ""
      ) {
        Log.log(`[MMM-OneCallWeather] ${moment().format("D-MMM-YY HH:mm")} ** ERROR ** Latitude and/or longitude not provided.`);
      } else {
        const myurl =
          `https://api.openweathermap.org/data/${config.apiVersion}/onecall` +
          `?lat=${config.latitude}&lon=${config.longitude}${
            config.units === ""
              ? ""
              : `&units=${config.units}`
          }&exclude=${config.exclude}&appid=${config.apikey}&lang=${
            config.language
          }`;

        // make request to OpenWeather onecall API

        fetch(myurl)
          .then((response) => {
            if (response.status === 200) {
              return response.json();
            }
            throw new Error(response.statusText);
          })
          .then((data) => {
            // handle success
            // Log.log("got request loop " + myurl);   // uncomment to see in terminal
            self.sendSocketNotification("OPENWEATHER_ONECALL_DATA", data);
            // Log.log("sent the data back" );
          })
          .catch((error) => {
            // handle error
            Log.log(`[MMM-OneCallWeather] ${moment().format("D-MMM-YY HH:mm")} ** ERROR ** ${error}`);
          });
      }
    }
  }
});
