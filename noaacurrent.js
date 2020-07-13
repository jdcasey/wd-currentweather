/* Magic Mirror
 * Module: NOAACurrent
 * By John Casey https://github.com/jdcasey
 *
 * Based on Module: CurrentWeather, 
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("noaacurrent", {
	// Default module config.
	defaults: {
		lat: 0,
		lon: 0,
		units: config.units,
		updateInterval: 10 * 60 * 1000, // every 10 minutes
		animationSpeed: 1000,
		timeFormat: config.timeFormat,
		lang: config.language,
		decimalSymbol: ".",
		degreeLabel: false,

		showPeriod: true,
		showPeriodUpper: false,
		showWindDirection: true,
		showWindDirectionAsArrow: false,
		showHumidity: true,
		showSun: true,
		showIndoorTemperature: false,
		showIndoorHumidity: false,
		showFeelsLike: true,

		useBeaufort: false,
		useKMPHwind: true,

		initialLoadDelay: 0, // 0 seconds delay
		retryDelay: 2500,

		apiBase: "https://api.weather.gov",

		appendLocationNameToHeader: true,
		calendarClass: "calendar",
		tableClass: "large",

		onlyTemp: false,
		hideTemp: false,
		roundTemp: false,
	},

	// create a variable for the first upcoming calendar event. Used if no location is specified.
	firstEvent: false,

	// create a variable to hold the location name based on the API result.
	fetchedLocationName: "",

	// Define required scripts.
	getScripts: function () {
		return ["moment.js"];
	},

	// Define required scripts.
	getStyles: function () {
		return ["noaacurrent.css"];
	},

	// Define required translations.
	getTranslations: function () {
		// The translations for the default modules are defined in the core translation files.
		// Therefor we can just return false. Otherwise we should have returned a dictionary.
		// If you're trying to build your own module including translations, check out the documentation.
		return false;
	},

	// Define start sequence.
	start: function () {
		Log.info("Starting module: " + this.name);

		// Set locale.
		moment.locale(config.language);

		this.windSpeed = null;
		this.windDirection = null;
		this.windDeg = null;
		this.sunriseSunsetTime = null;
		this.sunriseSunsetIcon = null;
		this.temperature = null;
		this.indoorTemperature = null;
		this.indoorHumidity = null;
		this.weatherType = null;
		this.feelsLike = null;
		this.loaded = false;

		this.scheduleUpdate(this.config.initialLoadDelay);
	},

	// add extra information of current weather
	// windDirection, humidity, sunrise and sunset
	addExtraInfoWeather: function (wrapper) {
		var small = document.createElement("div");
		small.className = "normal medium";

		var windIcon = document.createElement("span");
		windIcon.className = "wi wi-strong-wind dimmed";
		small.appendChild(windIcon);

		var windSpeed = document.createElement("span");
		windSpeed.innerHTML = " " + this.windSpeed;
		small.appendChild(windSpeed);

		if (this.config.showWindDirection) {
			var windDirection = document.createElement("sup");
			if (this.config.showWindDirectionAsArrow) {
				if (this.windDeg !== null) {
					windDirection.innerHTML = ' &nbsp;<i class="fa fa-long-arrow-down" style="transform:rotate(' + this.windDeg + 'deg);"></i>&nbsp;';
				}
			} else {
				windDirection.innerHTML = " " + this.translate(this.windDirection);
			}
			small.appendChild(windDirection);
		}
		var spacer = document.createElement("span");
		spacer.innerHTML = "&nbsp;";
		small.appendChild(spacer);

		if (this.config.showHumidity) {
			var humidity = document.createElement("span");
			humidity.innerHTML = this.humidity;

			var supspacer = document.createElement("sup");
			supspacer.innerHTML = "&nbsp;";

			var humidityIcon = document.createElement("sup");
			humidityIcon.className = "wi wi-humidity humidityIcon";
			humidityIcon.innerHTML = "&nbsp;";

			small.appendChild(humidity);
			small.appendChild(supspacer);
			small.appendChild(humidityIcon);
		}

		if (this.config.showSun) {
			var sunriseSunsetIcon = document.createElement("span");
			sunriseSunsetIcon.className = "wi dimmed " + this.sunriseSunsetIcon;
			small.appendChild(sunriseSunsetIcon);

			var sunriseSunsetTime = document.createElement("span");
			sunriseSunsetTime.innerHTML = " " + this.sunriseSunsetTime;
			small.appendChild(sunriseSunsetTime);
		}

		wrapper.appendChild(small);
	},

	// Override dom generator.
	getDom: function () {
		var wrapper = document.createElement("div");
		wrapper.className = this.config.tableClass;

		if (this.config.appid === "") {
			wrapper.innerHTML = "Please set the correct openweather <i>appid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.config.onlyTemp === false) {
			this.addExtraInfoWeather(wrapper);
		}

		var large = document.createElement("div");
		large.className = "light";

		var degreeLabel = "";
		if (this.config.units === "metric" || this.config.units === "imperial") {
			degreeLabel += "°";
		}
		if (this.config.degreeLabel) {
			switch (this.config.units) {
				case "metric":
					degreeLabel += "C";
					break;
				case "imperial":
					degreeLabel += "F";
					break;
				case "default":
					degreeLabel += "K";
					break;
			}
		}

		if (this.config.decimalSymbol === "") {
			this.config.decimalSymbol = ".";
		}

		if (this.config.hideTemp === false) {
			var weatherIconSpan = document.createElement("span");
			weatherIconSpan.className = "wi weathericon";

            var weatherIcon = document.createElement("img");
            weatherIcon.src = this.weatherType;
            weatherIconSpan.appendChild(weatherIcon);

			large.appendChild(weatherIconSpan);

			var temperature = document.createElement("span");
			temperature.className = "bright";
			temperature.innerHTML = " " + this.temperature.replace(".", this.config.decimalSymbol) + degreeLabel;
			large.appendChild(temperature);
		}

		if (this.config.showIndoorTemperature && this.indoorTemperature) {
			var indoorIcon = document.createElement("span");
			indoorIcon.className = "fa fa-home";
			large.appendChild(indoorIcon);

			var indoorTemperatureElem = document.createElement("span");
			indoorTemperatureElem.className = "bright";
			indoorTemperatureElem.innerHTML = " " + this.indoorTemperature.replace(".", this.config.decimalSymbol) + degreeLabel;
			large.appendChild(indoorTemperatureElem);
		}

		if (this.config.showIndoorHumidity && this.indoorHumidity) {
			var indoorHumidityIcon = document.createElement("span");
			indoorHumidityIcon.className = "fa fa-tint";
			large.appendChild(indoorHumidityIcon);

			var indoorHumidityElem = document.createElement("span");
			indoorHumidityElem.className = "bright";
			indoorHumidityElem.innerHTML = " " + this.indoorHumidity + "%";
			large.appendChild(indoorHumidityElem);
		}

		wrapper.appendChild(large);

		if (this.config.showFeelsLike && this.config.onlyTemp === false) {
			var small = document.createElement("div");
			small.className = "normal medium";

			var feelsLike = document.createElement("span");
			feelsLike.className = "dimmed";
			feelsLike.innerHTML = this.translate("FEELS") + " " + this.feelsLike + degreeLabel;
			small.appendChild(feelsLike);

			wrapper.appendChild(small);
		}

		return wrapper;
	},

	// Override getHeader method.
	getHeader: function () {
		if (this.config.appendLocationNameToHeader && this.data.header !== undefined) {
			return this.data.header + " " + this.fetchedLocationName;
		}

		if (this.config.useLocationAsHeader && this.config.location !== false) {
			return this.config.location;
		}

		return this.data.header;
	},

	// Override notification handler.
	notificationReceived: function (notification, payload, sender) {
		if (notification === "DOM_OBJECTS_CREATED") {
			if (this.config.appendLocationNameToHeader) {
				this.hide(0, { lockString: this.identifier });
			}
		}
		if (notification === "CALENDAR_EVENTS") {
			var senderClasses = sender.data.classes.toLowerCase().split(" ");
			if (senderClasses.indexOf(this.config.calendarClass.toLowerCase()) !== -1) {
				this.firstEvent = false;

				for (var e in payload) {
					var event = payload[e];
					if (event.location || event.geo) {
						this.firstEvent = event;
						//Log.log("First upcoming event with location: ", event);
						break;
					}
				}
			}
		}
		if (notification === "INDOOR_TEMPERATURE") {
			this.indoorTemperature = this.roundValue(payload);
			this.updateDom(this.config.animationSpeed);
		}
		if (notification === "INDOOR_HUMIDITY") {
			this.indoorHumidity = this.roundValue(payload);
			this.updateDom(this.config.animationSpeed);
		}
	},

    makeRequest: function(method, url){
        return new Promise(function(resolve, reject){
            var request = new XMLHttpRequest();
            request.open(method, url, true);

            request.onload = function () {
                if ( this.status === 200 ){
                    resolve(JSON.parse(request.response));
                }
                else{
                    self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);

                    reject({
                        status: this.status,
                        statusText: request.statusText
                    });
                }
            };

            request.onerror = function(){
                reject({
                    status: this.status,
                    statusText: request.statusText
                });
            };

            request.send();
        });
    },

    /* updateWeather(compliments)
     * Requests new data from openweather.org.
     * Calls processWeather on succesfull response.
     */
    updateWeather: function (officeData) {
        Log.log("Looking up current conditions from office URL: " + officeData.properties.forecast);

        var url = officeData.properties.forecastGridData;
        var self = this;
        var retry = true;
        var currentConditions = {};

        this.makeRequest("GET", url).then((response)=>{
            currentConditions = response;
            return self.makeRequest("GET", officeData.properties.forecastHourly);
        }).then((response)=>{
            self.processWeather(currentConditions, response, officeData);
        });
    },

	updateOfficeWeather: function(){
		Log.log("Looking up NOAA weather by lat/long");

		var url = this.config.apiBase + '/points/' + this.config.lat + "," + this.config.lon;
		var self = this;
		var retry = true;
        var officeData = {};

        var officePromise = this.makeRequest("GET", url)
                                .then(function(response){
                                    officeData = response;
                                    self.sendNotification("NOAAWEATHER_OFFICE_DATA", { data: response });
                                })
                                .catch(function(err){
                                    self.updateDom(self.config.animationSpeed);
                                    retry = true;
                                    Log.error("Failed to load NOAA office information for Lat/Lon: " + self.config.lat + "," + self.config.lon + ": " + err.statusText);
                                });

        var sunriseUrl = "https://api.sunrise-sunset.org/json?lat=" + this.config.lat + "&lng=" + this.config.lon + "&formatted=0";
        var sunrisePromise = this.makeRequest("GET", sunriseUrl)
                                .then(function(response){
                                    self.processSunrise(response);
                                })
                                .catch(function(err){
                                    Log.error("Failed to load sunrise/sunset information for Lat/Lon: " + self.config.lat + "," + self.config.lon + ": " + err.statusText);
                                });

        Promise.all([officePromise, sunrisePromise]).then((values)=>{
            Log.log("All prelim promises done, with values: " + values);
            self.updateWeather(officeData);
        })
	},

	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function (delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		Log.log("Scheduling update for weather at " + nextLoad);

		var self = this;
		setTimeout(function () {
			self.updateOfficeWeather();
		}, nextLoad);
	},

	findLatest: function(measurements){
		var latest = null;
		var now = new Date();

		measurements.forEach(measurement=>{
			var mdate = Date.parse(measurement.validTime.split('/')[0])
			if ( now > mdate ){
				latest = measurement.value;
			}
		});

		return latest;
	},

    findMatchingTime: (measurements)=>{
        var now = new Date();

        Log.log("Checking " + measurements.length + " measurements for the one capturing the current time...")
        return measurements.find(measurement=>{
            var start = Date.parse(measurement.startTime);
            var end = Date.parse(measurement.endTime);
            Log.log("Checking whether we're in the time period between: " + start + " and " + end);
            if ( now >= start && now < end ){
                Log.log("We are. Found a match.");
                return true;
            }

            return false;
        });
    },

	createMainDataStructure: function(data){
		data.main = {};
		now = new Date();

		data.main.temp = this.findLatest(data.properties.temperature.values);
		data.main.humidity = this.findLatest(data.properties.relativeHumidity.values);
		data.main.feelsLike = this.findLatest(data.properties.apparentTemperature.values);
		data.main.windSpeed = this.findLatest(data.properties.windSpeed.values);
		data.main.windDeg = this.findLatest(data.properties.windDirection.values);
	},

    processSunrise: function(data){
        var now = new Date();
        var sunrise = Date.parse(data.results.sunrise);
        var sunset = Date.parse(data.results.sunset);

        Log.log("Sunrise: " + sunrise + ", sunset: " + sunset);

        // The moment().format('h') method has a bug on the Raspberry Pi.
        // So we need to generate the timestring manually.
        // See issue: https://github.com/MichMich/MagicMirror/issues/181
        var sunriseSunsetDateObject = sunrise < now && sunset > now ? sunset : sunrise;
        var timeString = moment(sunriseSunsetDateObject).format("HH:mm");
        if (this.config.timeFormat !== 24) {
         //var hours = sunriseSunsetDateObject.getHours() % 12 || 12;
         if (this.config.showPeriod) {
             if (this.config.showPeriodUpper) {
                 //timeString = hours + moment(sunriseSunsetDateObject).format(':mm A');
                 timeString = moment(sunriseSunsetDateObject).format("h:mm A");
             } else {
                 //timeString = hours + moment(sunriseSunsetDateObject).format(':mm a');
                 timeString = moment(sunriseSunsetDateObject).format("h:mm a");
             }
         } else {
             //timeString = hours + moment(sunriseSunsetDateObject).format(':mm');
             timeString = moment(sunriseSunsetDateObject).format("h:mm");
         }
        }

        this.sunriseSunsetTime = timeString;
        this.sunriseSunsetIcon = sunrise < now && sunset > now ? "wi-sunset" : "wi-sunrise";
        this.sendNotification("NOAAWEATHER_SUNRISE_DATA", { data: data });
    },

	/* processWeather(data)
	 * Uses the received data to set the various values.
	 *
	 * argument data object - Weather information received form openweather.org.
	 */
	processWeather: function (data, hourlyData, officeData) {
		this.createMainDataStructure(data);

		if (!data || !data.main || typeof data.main.temp === "undefined") {
			// Did not receive usable new data.
			// Maybe this needs a better check?
			return;
		}

		this.humidity = parseFloat(data.main.humidity);
		this.temperature = this.roundValue(this.c2f(data.main.temp));
		this.feelsLike = this.roundValue(this.c2f(data.main.feelsLike));
		this.windSpeed = parseFloat(this.ms2Beaufort(data.main.windSpeed)).toFixed(0);
		this.windDirection = this.deg2Cardinal(data.main.windDeg);
		this.windDeg = data.main.windDeg;

        var citystate = officeData.properties.relativeLocation.properties;
        this.fetchedLocationName = citystate.city + ", " + citystate.state;


		this.weatherType = this.findMatchingTime(hourlyData.properties.periods).icon;

		this.show(this.config.animationSpeed, { lockString: this.identifier });
		this.loaded = true;
		this.updateDom(this.config.animationSpeed);

		this.sendNotification("NOAAWEATHER_CURRENT_DATA", { data: data });
        this.sendNotification("NOAAWEATHER_HOURLY_DATA", { data: data });
	},

    c2f: function(c){
        return 1.8*c+32;
    },

	/* ms2Beaufort(ms)
	 * Converts m2 to beaufort (windspeed).
	 *
	 * see:
	 *  https://www.spc.noaa.gov/faq/tornado/beaufort.html
	 *  https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
	 *
	 * argument ms number - Windspeed in m/s.
	 *
	 * return number - Windspeed in beaufort.
	 */
	ms2Beaufort: function (ms) {
		var kmh = (ms * 60 * 60) / 1000;
		var speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000];
		for (var beaufort in speeds) {
			var speed = speeds[beaufort];
			if (speed > kmh) {
				return beaufort;
			}
		}
		return 12;
	},

	deg2Cardinal: function (deg) {
		if (deg > 11.25 && deg <= 33.75) {
			return "NNE";
		} else if (deg > 33.75 && deg <= 56.25) {
			return "NE";
		} else if (deg > 56.25 && deg <= 78.75) {
			return "ENE";
		} else if (deg > 78.75 && deg <= 101.25) {
			return "E";
		} else if (deg > 101.25 && deg <= 123.75) {
			return "ESE";
		} else if (deg > 123.75 && deg <= 146.25) {
			return "SE";
		} else if (deg > 146.25 && deg <= 168.75) {
			return "SSE";
		} else if (deg > 168.75 && deg <= 191.25) {
			return "S";
		} else if (deg > 191.25 && deg <= 213.75) {
			return "SSW";
		} else if (deg > 213.75 && deg <= 236.25) {
			return "SW";
		} else if (deg > 236.25 && deg <= 258.75) {
			return "WSW";
		} else if (deg > 258.75 && deg <= 281.25) {
			return "W";
		} else if (deg > 281.25 && deg <= 303.75) {
			return "WNW";
		} else if (deg > 303.75 && deg <= 326.25) {
			return "NW";
		} else if (deg > 326.25 && deg <= 348.75) {
			return "NNW";
		} else {
			return "N";
		}
	},

	/* function(temperature)
	 * Rounds a temperature to 1 decimal or integer (depending on config.roundTemp).
	 *
	 * argument temperature number - Temperature.
	 *
	 * return string - Rounded Temperature.
	 */
	roundValue: function (temperature) {
		var decimals = this.config.roundTemp ? 0 : 1;
		return parseFloat(temperature).toFixed(decimals);
	}
});
