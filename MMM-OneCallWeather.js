/* eslint-disable prefer-destructuring */
/* eslint-disable default-case */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-prototype-builtins */
/* global Module Log config moment WeatherObject */

/* MagicMirror²
 * Module: MMM-OneCallWeather
 *
 * By Simon Cowdell
 */

let data;

Module.register("MMM-OneCallWeather", {
  // Default module config.
  defaults: {
    latitude: false,
    longitude: false,
    apikey: "",
    apiVersion: "3.0",
    units: config.units,
    layout: "default", // default
    showRainAmount: false,
    showWind: true,
    showWindDirection: true,
    showFeelsLike: true,
    tempUnits: "c",
    windunits: "mph",
    useBeaufortInCurrent: false,

    initialLoadDelay: 2500, // 2.5 seconds delay. This delay is used to keep the OpenWeather API happy.
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    animationSpeed: 1000,
    updateFadeSpeed: 500,
    lang: config.language,
    language: config.language,
    requestDelay: 0,

    decimalSymbol: ".",
    fade: true,
    scale: false,
    exclude: "minutely",

    tableClass: "small",
    iconset: "4a",
    iconsetFormat: "png",

    onlyTemp: false,
    maxHourliesToShow: 30,
    maxDailiesToShow: 6,
    colored: true,
    roundTemp: true,

    label_ordinals: [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW"
    ],
    moduleTimestampIdPrefix: "OPENWEATHER_ONE_CALL_TIMESTAMP_"
  },

  // create a variable for the first upcoming calendaar event. Used if no location is specified.
  firstEvent: false,

  // Define required scripts.
  getScripts() {
    return ["moment.js", "weatherobject.js"];
  },

  // Define start sequence.
  start() {
    Log.info(`Starting module: ${this.name}`);
    // Set locale.
    moment.locale(config.language);
    this.forecast = [];
    this.loaded = false;
    this.scheduleUpdate(this.config.initialLoadDelay);
    this.updateTimer = null;
  },

  scheduleUpdate(delay) {
    let nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay >= 0) {
      nextLoad = delay;
    }

    const self = this;
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(function update() {
      self.updateWeather();
    }, nextLoad);
  },

  updateWeather() {
    this.sendSocketNotification("OPENWEATHER_ONECALL_GET", {
      apikey: this.config.apikey,
      apiVersion: this.config.apiVersion,
      exclude: this.config.exclude,
      latitude: this.config.latitude,
      longitude: this.config.longitude,
      units: this.config.units,
      language: this.config.language,
      requestDelay: this.config.requestDelay
    });
  },
  //           Log.log("node received");

  socketNotificationReceived(notification, payload) {
    //		Log.log("got some data back" );    		// uncomment to see in terminal

    if (notification === "OPENWEATHER_ONECALL_DATA") {
      //	Log.log("received socket");
      // process weather data
      data = payload;
      this.forecast = this.processOnecall(data);
      this.loaded = true;
      this.updateDom(); // this.config.updateFadeSpeed
      this.scheduleUpdate();
    }
  },

  processOnecall() {
    let precip = false;
    let wsfactor = 1;
    const current = [];
    if (this.config.windUnits === "kmph") {
      wsfactor = 3.6;
    } else if (this.config.windUnits === "ms") {
      wsfactor = 1;
    } else {
      wsfactor = 2.237;
    }

    if (data.hasOwnProperty("current")) {
      const currently = {
        date: moment(data.current.dt, "X").utcOffset(data.timezone_offset / 60),
        dayOfWeek: moment(data.current.dt, "X").format("ddd"),
        windSpeed: (data.current.wind_speed * wsfactor).toFixed(0),
        windDirection: data.current.wind_deg,
        sunrise: moment(data.current.sunrise, "X").utcOffset(
          data.timezone_offset / 60
        ),
        sunset: moment(data.current.sunset, "X").utcOffset(
          data.timezone_offset / 60
        ),
        temperature: this.roundValue(data.current.temp),
        weatherIcon: data.current.weather[0].icon,
        weatherType: this.convertWeatherType(data.current.weather[0].icon),
        humidity: data.current.humidity,
        feelsLikeTemp: data.current.feels_like.toFixed(1),
        precipitation: current.rain + current.snow
      };
      current.push(currently);
    }
    //			Log.log("current weather is " + JSON.stringify(currently));
    let weather = new WeatherObject(
      this.config.units,
      this.config.tempUnits,
      this.config.windUnits,
      this.config.useKmh
    );

    // get hourly weather, if requested
    const hours = [];
    this.hourForecast = [];
    let forecastData = [];

    if (data.hasOwnProperty("hourly")) {
      for (const hour of data.hourly) {
        if (
          Object.prototype.hasOwnProperty.call(hour, "rain") &&
          !Number.isNaN(hour.rain["1h"])
        ) {
          if (this.config.units === "imperial") {
            weather.rain = hour.rain["1h"] / 25.4;
          } else {
            weather.rain = hour.rain["1h"];
          }
          precip = true;
        }
        if (
          Object.prototype.hasOwnProperty.call(hour, "snow") &&
          !Number.isNaN(hour.snow["1h"])
        ) {
          if (this.config.units === "imperial") {
            weather.snow = hour.snow["1h"] / 25.4;
          } else {
            weather.snow = hour.snow["1h"];
          }
          precip = true;
        }
        if (precip) {
          weather.precipitation = weather.rain + weather.snow;
        }

        forecastData = {
          date: moment(hour.dt, "X").utcOffset(data.timezone_offset / 60),
          temperature: hour.temp,
          humidity: hour.humidity,
          windSpeed: hour.wind_speed,
          windDirection: hour.wind_deg,
          feelsLikeTemp: hour.feels_like.day,
          weatherIcon: hour.weather[0].icon,
          weatherType: this.convertWeatherType(hour.weather[0].icon),
          precipitation: weather.precipitation
        };
        hours.push(forecastData);
        weather = new WeatherObject(
          this.config.units,
          this.config.tempUnits,
          this.config.windUnits,
          this.config.useKmh
        );
      }
    }

    // get daily weather, if requested
    this.dayForecast = [];

    const days = [];
    if (data.hasOwnProperty("daily")) {
      for (const day of data.daily) {
        precip = false;
        if (!Number.isNaN(day.rain)) {
          if (this.config.units === "imperial") {
            weather.rain = day.rain / 25.4;
          } else {
            weather.rain = day.rain;
          }
          precip = true;
        }
        if (!Number.isNaN(day.snow)) {
          if (this.config.units === "imperial") {
            weather.snow = day.snow / 25.4;
          } else {
            weather.snow = day.snow;
          }
          precip = true;
        }
        if (precip) {
          weather.precipitation = weather.rain + weather.snow;
        }
        //

        //

        forecastData = {
          dayOfWeek: moment(day.dt, "X").format("ddd"),
          date: moment(day.dt, "X").utcOffset(data.timezone_offset / 60),
          sunrise: moment(day.sunrise, "X").utcOffset(
            data.timezone_offset / 60
          ),
          sunset: moment(day.sunset, "X").utcOffset(data.timezone_offset / 60),
          minTemperature: this.roundValue(day.temp.min),
          maxTemperature: this.roundValue(day.temp.max),
          humidity: day.humidity,
          windSpeed: (day.wind_speed * wsfactor).toFixed(0),
          windDirection: day.wind_deg,
          feelsLikeTemp: day.feels_like.day,
          weatherIcon: day.weather[0].icon,
          weatherType: this.convertWeatherType(day.weather[0].icon),
          precipitation: weather.precipitation
        };

        days.push(forecastData);
        weather = new WeatherObject(
          this.config.units,
          this.config.tempUnits,
          this.config.windUnits,
          this.config.useKmh
        );
      }
    }

    //			Log.log("forecast is " + JSON.stringify(days));
    return { current, hours, days };
  },

  // Override getHeader method.
  getHeader() {
    if (this.config.appendLocationNameToHeader) {
      return `${this.data.header} ${this.fetchedLocationName}`;
    }

    return this.data.header;
  },

  // Override dom generator.
  getDom() {
    const wrapper = document.createElement("div");

    if (this.config.appid === "") {
      wrapper.innerHTML = `Please set the correct openweather <i>appid</i> in the config for module: ${this.name}.`;
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.loaded) {
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    const table = document.createElement("table");
    let currentCell1;
    let currentCell2;
    let currentCell3;
    let currentRow1;
    let currentRow2;
    let currentRow3;
    let currentWeather;
    let currTemperature;
    let dailyForecast;
    let hCellData;
    let hRowData;
    let large;
    let small;
    let spacer;
    let weatherIcon;
    let windyDirection;
    let windIcon;
    let windySpeed;
    table.className = this.config.tableClass;
    table.style.borderCollapse = "collapse";

    let degreeLabel = "°";
    if (this.config.scale) {
      switch (this.config.units) {
        case "metric":
          degreeLabel += "C";
          break;
        case "imperial":
          degreeLabel += "F";
          break;
        default:
          degreeLabel = "K";
          break;
      }
    }

    if (this.config.decimalSymbol === "") {
      this.config.decimalSymbol = ".";
    }

    switch (this.config.layout) {
      case "horizontal":
        //				Log.log("count of data length " + this.forecast.days.length);

        Log.log(`count of data length ${this.forecast.hours.length}`);
        hRowData = document.createElement("tr");
        hCellData = document.createElement("td");
        hCellData.style.textAlign = "left";

        for (let h = 0; h < this.config.maxHourliesToShow; h += 1) {
          const hourlyForecast = this.forecast.hours[h];
          const lineOfData = document.createElement("div");
          lineOfData.innerHTML = `${moment(hourlyForecast.date, "X").format(
            "hhmm"
          )}&nbsp ${
            hourlyForecast.temperature
          }${degreeLabel}&nbsp ${hourlyForecast.windSpeed.toFixed(
            0
          )}&nbsp ${this.cardinalWindDirection(
            hourlyForecast.windDirection
          )}&nbsp ${hourlyForecast.weatherType}<BR>`;
          hCellData.appendChild(lineOfData);
        }

        for (let i = 0; i < this.config.maxDailiesToShow; i += 1) {
          dailyForecast = this.forecast.days[i];
          const lineOfData = document.createElement("div");
          lineOfData.innerHTML = `${dailyForecast.dayOfWeek}&nbsp ${
            dailyForecast.maxTemperature
          }&nbsp ${dailyForecast.minTemperature}&nbsp ${
            dailyForecast.windSpeed
          }&nbsp ${this.cardinalWindDirection(
            dailyForecast.windDirection
          )}&nbsp ${dailyForecast.weatherType}<BR>`;
          hCellData.appendChild(lineOfData);
        }

        hRowData.appendChild(hCellData);
        table.appendChild(hRowData);
        break;

      case "vertical":
        currentWeather = this.forecast.current[0];
        currentRow1 = document.createElement("tr");
        currentCell1 = document.createElement("td");
        //		currentCell.style.columnSpan = "all";
        currentCell1.colSpan = "6";
        currentCell1.className = "current";

        small = document.createElement("div");
        small.className = "normal medium";

        windIcon = document.createElement("img");
        windIcon.className = "wi wi-strong-wind dimmed";
        windIcon.src = "modules/MMM-OneCallWeather/windicon/windblow.png";

        small.appendChild(windIcon);

        windySpeed = document.createElement("span");
        windySpeed.innerHTML = ` ${currentWeather.windSpeed}`;
        small.appendChild(windySpeed);

        if (this.config.showWindDirection) {
          windyDirection = document.createElement("sup");
          if (this.config.showWindDirectionAsArrow) {
            if (currentWeather.windDirection !== null) {
              windyDirection.innerHTML = ` &nbsp;<i class="fa fa-long-arrow-down" style="transform:rotate(${this.windDeg}deg);"></i>&nbsp;`;
            }
          } else {
            windyDirection.innerHTML = ` ${this.cardinalWindDirection(
              currentWeather.windDirection
            )}`; // + currentWeather.windDirection;
          }
          small.appendChild(windyDirection);
        }
        spacer = document.createElement("span");
        spacer.innerHTML = "&nbsp;";
        small.appendChild(spacer);

        currentCell1.appendChild(small);
        currentRow1.appendChild(currentCell1);
        table.appendChild(currentRow1);

        currentRow2 = document.createElement("tr");
        currentCell2 = document.createElement("td");
        currentCell2.colSpan = "6";
        currentCell2.className = "current";

        large = document.createElement("div");
        large.className = "light";

        weatherIcon = document.createElement("img");
        weatherIcon.className = `wi weathericon wi-${currentWeather.weatherIcon}`;
        weatherIcon.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${currentWeather.weatherIcon}.${this.config.iconsetFormat}`;
        weatherIcon.style.cssFloat = "left";
        weatherIcon.style.maxHeight = "80px";
        weatherIcon.style.width = "auto";
        weatherIcon.style.verticalAlign = "middle";
        weatherIcon.style.transform = "translate(40px, -20px)"; // scale(2)
        large.appendChild(weatherIcon);

        currTemperature = document.createElement("span");
        currTemperature.className = "large bright";

        if (this.config.tempUnits === "f") {
          currTemperature.innerHTML = ` ${(
            currentWeather.temperature * (9 / 5) +
            32
          ).toFixed(0)}${degreeLabel}`;
        } else {
          currTemperature.innerHTML = ` ${currentWeather.temperature}${degreeLabel}`;
        }
        currTemperature.style.verticalAlign = "middle";

        large.appendChild(currTemperature);

        currentCell2.appendChild(large);
        currentRow2.appendChild(currentCell2);
        table.appendChild(currentRow2);

        currentRow3 = document.createElement("tr");
        currentCell3 = document.createElement("td");
        currentCell3.colSpan = "6";
        currentCell3.className = "current";

        if (this.config.showFeelsLike && this.config.onlyTemp === false) {
          small = document.createElement("div");
          small.className = "small dimmed";

          const currFeelsLike = document.createElement("span");
          currFeelsLike.className = "small dimmed";
          if (this.config.tempUnits === "f") {
            currFeelsLike.innerHTML = ` ${(
              currentWeather.feelsLikeTemp * (9 / 5) +
              32
            ).toFixed(0)}${degreeLabel}`;
          } else {
            currFeelsLike.innerHTML = `Feels Like ${currentWeather.feelsLikeTemp}${degreeLabel}`;
          }
          small.appendChild(currFeelsLike);
          currentCell1.appendChild(small);
        }

        currentCell3.appendChild(small);
        currentRow3.appendChild(currentCell3);
        table.appendChild(currentRow3);

        for (let i = 0; i < this.config.maxDailiesToShow; i += 1) {
          //				console.log("count of data length " + this.forecast.days.length);
          dailyForecast = this.forecast.days[i];

          const row = document.createElement("tr");
          //			row.style.borderStyle = "solid";
          //			row.style.borderColor = "red";

          if (this.config.colored) {
            row.className = "colored";
          }
          table.appendChild(row);

          const dayCell = document.createElement("td");
          dayCell.className = "day";
          dayCell.innerHTML = dailyForecast.dayOfWeek;
          row.appendChild(dayCell);

          const iconCell = document.createElement("td");
          iconCell.className = "bright weather-icon";
          const icon = document.createElement("span");
          const iconImg = document.createElement("img");
          iconImg.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${dailyForecast.weatherIcon}.${this.config.iconsetFormat}`;

          iconImg.style.height = "auto";
          iconImg.style.maxWidth = "44px";

          iconImg.style.display = "inline";
          icon.appendChild(iconImg);
          iconCell.appendChild(icon);
          row.appendChild(iconCell);

          const maxTempCell = document.createElement("td");
          maxTempCell.innerHTML = dailyForecast.maxTemperature + degreeLabel;
          maxTempCell.className = "align-center bright max-temp";
          //				maxTempCell.style.paddingRight="10px";
          row.appendChild(maxTempCell);

          const minTempCell = document.createElement("td");
          minTempCell.innerHTML = dailyForecast.minTemperature + degreeLabel;
          minTempCell.className = "align-center min-temp";
          row.appendChild(minTempCell);

          const windIconCell = document.createElement("td");
          windIconCell.className = "bright weather-icon";
          windIcon = document.createElement("span");
          const windIconImg = document.createElement("img");
          windIconImg.src = "modules/MMM-OneCallWeather/windicon/winddisc.png";

          windIconImg.style.position = "absolute"; // absolute
          windIconImg.style.transform = `rotate(${dailyForecast.windDirection}deg) `;
          windIconImg.style.textAlign = "center";
          windIconImg.style.marginLeft = "10px";
          windIconImg.style.marginTop = "-27px";

          windIcon.appendChild(windIconImg);
          windIconCell.appendChild(windIcon);
          row.appendChild(windIconCell);

          const windTextCell = document.createElement("td");
          windTextCell.className = "bright weather-icon";
          windTextCell.innerText = dailyForecast.windSpeed;
          windTextCell.style.position = "relative"; // absolute
          windTextCell.style.color = "red";

          row.appendChild(windTextCell);

          if (this.config.showRainAmount) {
            const rainCell = document.createElement("td");
            if (Number.isNaN(dailyForecast.precipitation)) {
              rainCell.innerHTML = "";
            } else if (config.units !== "imperial") {
              rainCell.innerHTML = `${parseFloat(
                dailyForecast.precipitation
              ).toFixed(1)} mm`;
            } else {
              rainCell.innerHTML = `${(
                parseFloat(dailyForecast.precipitation) / 25.4
              ).toFixed(2)} in`;
            }
            rainCell.className = "align-right bright rain";
            row.appendChild(rainCell);
          }
        }
        break;
      case "default":
        currentWeather = this.forecast.current[0];
        currentRow1 = document.createElement("tr");
        currentCell1 = document.createElement("td");
        //		currentCell.style.columnSpan = "all";
        currentCell1.colSpan = this.config.maxDailiesToShow;
        currentCell1.className = "current";

        small = document.createElement("div");
        small.className = "normal medium";

        windIcon = document.createElement("img");
        windIcon.className = "wi wi-strong-wind dimmed";
        windIcon.src = "modules/MMM-OneCallWeather/windicon/windblow.png";

        small.appendChild(windIcon);

        windySpeed = document.createElement("span");
        if (this.config.useBeaufortInCurrent) {
          this.convSpd = this.mph2Beaufort(currentWeather.windSpeed);
          windySpeed.innerHTML = `F${this.convSpd}`;
        } else {
          windySpeed.innerHTML = ` ${currentWeather.windSpeed}`;
        }
        small.appendChild(windySpeed);

        if (this.config.showWindDirection) {
          windyDirection = document.createElement("sup");
          if (this.config.showWindDirectionAsArrow) {
            if (currentWeather.windDirection !== null) {
              windyDirection.innerHTML = ` &nbsp;<i class="fa fa-long-arrow-down" style="transform:rotate(${this.windDeg}deg);"></i>&nbsp;`;
            }
          } else {
            windyDirection.innerHTML = ` ${this.cardinalWindDirection(
              currentWeather.windDirection
            )}`; // + currentWeather.windDirection;
          }
          small.appendChild(windyDirection);
        }
        spacer = document.createElement("span");
        spacer.innerHTML = "&nbsp;";
        small.appendChild(spacer);

        currentCell1.appendChild(small);
        currentRow1.appendChild(currentCell1);
        table.appendChild(currentRow1);

        currentRow2 = document.createElement("tr");
        currentCell2 = document.createElement("td");
        currentCell2.colSpan = this.config.maxDailiesToShow;
        currentCell2.className = "current";

        large = document.createElement("div");
        large.className = "light";

        if (this.config.decimalSymbol === "") {
          this.config.decimalSymbol = ".";
        }

        weatherIcon = document.createElement("img");
        weatherIcon.className = `wi weathericon wi-${currentWeather.weatherIcon}`;
        weatherIcon.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${currentWeather.weatherIcon}.${this.config.iconsetFormat}`;
        weatherIcon.style.cssFloat = "left";
        weatherIcon.style.maxHeight = "80px";
        weatherIcon.style.width = "auto";
        weatherIcon.style.verticalAlign = "middle";
        weatherIcon.style.transform = "translate(40px, -20px)"; // scale(2)
        large.appendChild(weatherIcon);

        currTemperature = document.createElement("span");
        currTemperature.className = "large bright";
        if (this.config.tempUnits === "f") {
          currTemperature.innerHTML = ` ${(
            currentWeather.temperature * (9 / 5) +
            32
          ).toFixed(0)}${degreeLabel}`;
        } else {
          currTemperature.innerHTML = ` ${currentWeather.temperature}${degreeLabel}`;
        }
        currTemperature.style.verticalAlign = "middle";

        large.appendChild(currTemperature);

        currentCell2.appendChild(large);
        currentRow2.appendChild(currentCell2);
        table.appendChild(currentRow2);

        currentRow3 = document.createElement("tr");
        currentCell3 = document.createElement("td");
        currentCell3.colSpan = this.config.maxDailiesToShow;
        currentCell3.className = "current";

        if (this.config.showFeelsLike && this.config.onlyTemp === false) {
          small = document.createElement("div");
          small.className = "small dimmed";
          const currFeelsLike = document.createElement("span");
          currFeelsLike.className = "small dimmed";
          currFeelsLike.innerHTML = `Feels Like ${currentWeather.feelsLikeTemp}${degreeLabel}`; // + "<BR>Last update" +  moment(currentWeather.date, "X").format("LT");
          //					currFeelsLike.style.transform = "translate(0px, -100px)"; //scale(2)
          //					currFeelsLike.style.border = "solid"; //scale(2)
          //					currFeelsLike.style.color = "red"; //scale(2)
          //					currFeelsLike.style.verticalAlign = "top";
          small.appendChild(currFeelsLike);
          currentCell1.appendChild(small);
        }
        currentCell3.appendChild(small);
        currentRow3.appendChild(currentCell3);
        table.appendChild(currentRow3);

        for (let j = 0; j < this.config.maxDailiesToShow; j += 1) {
          //				Log.log("count of data length " + this.forecast.days.length);
          dailyForecast = this.forecast.days[j];

          const row = document.createElement("td");

          if (this.config.colored) {
            row.className = "colored";
          }
          table.appendChild(row);

          const dayCell = document.createElement("tr");
          dayCell.className = "day";
          dayCell.innerHTML = dailyForecast.dayOfWeek;
          row.appendChild(dayCell);

          const iconCell = document.createElement("tr");
          iconCell.className = "bright weather-icon";
          const icon = document.createElement("span");
          const iconImg = document.createElement("img");
          iconImg.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${dailyForecast.weatherIcon}.${this.config.iconsetFormat}`;

          iconImg.style.height = "auto";
          iconImg.style.maxWidth = "44px";

          iconImg.style.display = "inline";
          icon.appendChild(iconImg);
          iconCell.appendChild(icon);
          row.appendChild(iconCell);

          if (
            this.config.decimalSymbol === "" ||
            this.config.decimalSymbol === " "
          ) {
            this.config.decimalSymbol = ".";
          }

          const maxTempCell = document.createElement("tr");

          maxTempCell.innerHTML = dailyForecast.maxTemperature + degreeLabel;
          maxTempCell.className = "align-center bright max-temp";
          row.appendChild(maxTempCell);

          const minTempCell = document.createElement("tr");
          if (this.config.tempUnits === "f") {
            minTempCell.innerHTML = ` ${(
              dailyForecast.minTemperature * (9 / 5) +
              32
            ).toFixed(0)}${degreeLabel}`;
          } else {
            minTempCell.innerHTML = dailyForecast.minTemperature + degreeLabel;
          }
          minTempCell.className = "align-center min-temp";
          row.appendChild(minTempCell);

          const windIconCell = document.createElement("tr");
          windIconCell.className = "bright weather-icon";
          windIcon = document.createElement("span");
          const windIconImg = document.createElement("img");
          windIconImg.src = "modules/MMM-OneCallWeather/windicon/winddisc.png";

          windIconImg.style.transform = `rotate(${dailyForecast.windDirection}deg)`;
          windIconImg.style.display = "inline";
          windIcon.appendChild(windIconImg);
          windIconCell.appendChild(windIcon);
          row.appendChild(windIconCell);

          const windTextCell = document.createElement("tr");
          windTextCell.className = "bright weather-icon";
          const ws = document.createElement("P");
          ws.innerText = dailyForecast.windSpeed;

          //				ws.innerText =  (dailyForecast.windSpeed * 2.237).toFixed(0);
          ws.style.color = "black";
          ws.style.position = "relative"; // absolute
          ws.style.top = "-65px";
          ws.style.left = "6px";
          ws.style.textAlign = "center";
          windTextCell.appendChild(ws);
          row.appendChild(windTextCell);

          if (this.config.showRainAmount) {
            const rainCell = document.createElement("td");
            if (Number.isNaN(dailyForecast.precipitation)) {
              rainCell.innerHTML = "";
            } else if (config.units !== "imperial") {
              rainCell.innerHTML = `${parseFloat(
                dailyForecast.precipitation
              ).toFixed(1)} mm`;
            } else {
              rainCell.innerHTML = `${(
                parseFloat(dailyForecast.precipitation) / 25.4
              ).toFixed(2)} in`;
            }
            rainCell.className = "align-right bright rain";
            row.appendChild(rainCell);
          }
        }

        break;
    }
    return table;
  },

  getOrdinal(bearing) {
    return this.config.label_ordinals[Math.round((bearing * 16) / 360) % 16];
  },

  cardinalWindDirection(windDir) {
    if (windDir > 11.25 && windDir <= 33.75) {
      return "NNE";
    }
    if (windDir > 33.75 && windDir <= 56.25) {
      return "NE";
    }
    if (windDir > 56.25 && windDir <= 78.75) {
      return "ENE";
    }
    if (windDir > 78.75 && windDir <= 101.25) {
      return "E";
    }
    if (windDir > 101.25 && windDir <= 123.75) {
      return "ESE";
    }
    if (windDir > 123.75 && windDir <= 146.25) {
      return "SE";
    }
    if (windDir > 146.25 && windDir <= 168.75) {
      return "SSE";
    }
    if (windDir > 168.75 && windDir <= 191.25) {
      return "S";
    }
    if (windDir > 191.25 && windDir <= 213.75) {
      return "SSW";
    }
    if (windDir > 213.75 && windDir <= 236.25) {
      return "SW";
    }
    if (windDir > 236.25 && windDir <= 258.75) {
      return "WSW";
    }
    if (windDir > 258.75 && windDir <= 281.25) {
      return "W";
    }
    if (windDir > 281.25 && windDir <= 303.75) {
      return "WNW";
    }
    if (windDir > 303.75 && windDir <= 326.25) {
      return "NW";
    }
    if (windDir > 326.25 && windDir <= 348.75) {
      return "NNW";
    }
    return "N";
  },

  convertOpenWeatherIdToIcon(id, openweatherIcon) {
    if (id >= 200 && id < 300) {
      // Thunderstorm
      return "thunderstorm";
    }
    if (id >= 300 && id < 400) {
      // Drizzle
      return "rain";
    }
    if (id === 511) {
      // Rain - freezing rain
      return "sleet";
    }
    if (id >= 500 && id < 600) {
      // Rain
      return "rain";
    }
    if (id >= 610 && id < 620) {
      // Snow - sleet or with rain
      return "sleet";
    }
    if (id >= 600 && id < 700) {
      // Snow
      return "snow";
    }
    if (id === 781) {
      // Atmosphere - tornado
      return "tornado";
    }
    if (id >= 700 && id < 800) {
      // Atmosphere
      return "fog";
    }
    if (id >= 800 && id < 810) {
      const isDay = openweatherIcon.slice(-1) === "d";

      if (id === 800) {
        // Clear
        if (isDay) {
          return "clear-day";
        }
        return "clear-night";
      }
      if (id === 801 || id === 802) {
        // Clouds - few or scattered
        if (isDay) {
          return "partly-cloudy-day";
        }
        return "partly-cloudy-night";
      }
      if (id === 803 || id === 804) {
        // Clouds - broken or overcast
        return "cloudy";
      }
    }
    return false;
  },

  roundValue(temperature) {
    const decimals = this.config.roundTemp ? 0 : 1;
    return parseFloat(temperature).toFixed(decimals);
  },

  /*
   * Convert the OpenWeatherMap icons to a more usable name.
   */
  convertWeatherType(weatherType) {
    const weatherTypes = {
      "01d": "day-sunny",
      "02d": "day-few-cloudy",
      "03d": "day-scattered-cloudy",
      "04d": "day-broken-cloudy",
      "09d": "day-showers",
      "10d": "day-rain",
      "11d": "day-thunderstorm",
      "13d": "day-snow",
      "50d": "day-fog",
      "01n": "night-clear",
      "02n": "night-few-cloudy",
      "03n": "night-scattered-cloudy",
      "04n": "night-broken-cloudy",
      "09n": "night-showers",
      "10n": "night-rain",
      "11n": "night-thunderstorm",
      "13n": "night-snow",
      "50n": "night-fog"
    };

    return weatherTypes.hasOwnProperty(weatherType)
      ? weatherTypes[weatherType]
      : null;
  },
  /* ms2Beaufort(ms)
   * Converts m2 to beaufort (windspeed).
   *
   * see:
   *  http://www.spc.noaa.gov/faq/tornado/beaufort.html
   *  https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
   *
   * argument ms number - Windspeed in m/s.
   *
   * return number - Windspeed in beaufort.
   */
  mph2Beaufort(mph) {
    const kmh = mph * 1.60934;
    const speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000];
    for (const beaufort of speeds) {
      const speed = speeds[beaufort];
      if (speed > kmh) {
        return beaufort;
      }
    }
    return 12;
  }
});
