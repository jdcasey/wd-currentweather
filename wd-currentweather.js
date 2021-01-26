/* Magic Mirror
 * Module: NOAACurrent
 * By John Casey https://github.com/jdcasey
 *
 * Based on Module: CurrentWeather,
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("wd-currentweather", {
    // Default module config.
    defaults: {
        animationSpeed: 1000,
        timeFormat: config.timeFormat,
        lang: config.language,
        decimalSymbol: ".",
        degreeLabel: true,

        showPeriod: true,
        showPeriodUpper: false,
        showWindDirection: true,
        showWindDirectionAsArrow: false,
        showHumidity: true,
        showSun: true,
        showFeelsLike: true,

        calendarClass: "calendar",
        tableClass: "large",

        onlyTemp: false,
        hideTemp: false,
        roundTemp: false,
    },

    // create a variable for the first upcoming calendar event. Used if no location is specified.
    firstEvent: false,

    // Define required scripts.
    getScripts: function () {
        return ["moment.js"];
    },

    // Define required scripts.
    getStyles: function () {
        return ["weather-icons.css", "wd-currentweather.css"];
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
        this.weatherType = null;
        this.feelsLike = null;
        this.loaded = false;

        this.weatherData = null;
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
        if (this.weatherData.config.units === "metric" || this.weatherData.config.units === "imperial") {
            degreeLabel += "°";
        }
        if (this.config.degreeLabel) {
            switch (this.weatherData.config.units) {
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

        if (this.config.hideTemp === false && this.loaded == true) {
            const weatherIconSpan = document.createElement("span");
            const weatherClass = this.weatherClass;
            weatherIconSpan.className = "wi weathericon dimmed " + weatherClass;

            large.appendChild(weatherIconSpan);

            var temperature = document.createElement("span");
            temperature.className = "bright";
            temperature.innerHTML = " " + this.temperature.replace(".", this.config.decimalSymbol) + degreeLabel;
            large.appendChild(temperature);
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
        if (this.config.useLocationAsHeader && this.config.location !== false) {
            return this.config.location;
        }

        return this.data.header;
    },

    // Override notification handler.
    notificationReceived: function (notification, payload, sender) {
        switch(notification){
            case "DOM_OBJECTS_CREATED":
                if (this.config.appendLocationNameToHeader) {
                    this.hide(0, { lockString: this.identifier });
                }
                break;

            case "WEATHER_REFRESHED":
                this.weatherData = payload;
                Log.log("LOG", "Current weather / RECV: " + notification);
                this.processWeather();
                break;

        }
    },

    findMatchingTime: (measurements)=>{
        var now = new Date();

        // Log.log("Checking " + measurements.length + " measurements for the one capturing the current time...")
        return measurements.find(measurement=>{
            var start = Date.parse(measurement.startTime);
            var end = Date.parse(measurement.endTime);
            // Log.log("Checking whether we're in the time period between: " + start + " and " + end);
            if ( now >= start && now < end ){
                // Log.log("We are. Found a match.");
                return true;
            }

            return false;
        });
    },

    processSunrise: function(){
        const now = new Date().getTime();
        const tzOff = this.weatherData.timezone_offset;
        const sunTimes = {
          sunrise: (this.weatherData.current.sunrise) * 1000,
          sunset: (this.weatherData.current.sunset) * 1000,
        };

        this.sunriseData = sunTimes;

        // Log.log("Sunrise: " + sunrise + ", sunset: " + sunset + "\n\nData: " + JSON.stringify(this.sunriseData));

        // The moment().format('h') method has a bug on the Raspberry Pi.
        // So we need to generate the timestring manually.
        // See issue: https://github.com/MichMich/MagicMirror/issues/181
        var sunriseSunsetDateObject = sunTimes.sunrise < now && sunTimes.sunset > now ? sunTimes.sunset : sunTimes.sunrise;
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
        this.sunriseSunsetIcon = sunTimes.sunrise < now && sunTimes.sunset > now ? "wi-sunset" : "wi-sunrise";
    },

    /* processWeather(data)
     * Uses the received data to set the various values.
     *
     * argument data object - Weather information received form openweather.org.
     */
    processWeather: function () {
        if ( this.weatherData == null ){
            Log.log("We don't have all the information needed for a weather update yet. Waiting...");
            return;
        }

        this.processSunrise();

        var data = this.weatherData.current;

        if (!data || typeof data.temp === "undefined") {
            // Did not receive usable new data.
            // Maybe this needs a better check?
            return;
        }

        this.humidity = Math.round(parseFloat(data.humidity));
        this.temperature = this.roundValue(data.temp);
        this.feelsLike = this.roundValue(data.feels_like);
        this.windSpeed = parseFloat(data.wind_speed).toFixed(0);
        this.windDirection = this.deg2Cardinal(data.wind_deg);
        this.windDeg = data.wind_deg;

        this.weatherClass = data.weather[0].weatherClass;

        this.loaded = true;
        // Log.log("Sunrise data: " + JSON.stringify(this.sunriseData));

        this.show(this.config.animationSpeed, { lockString: this.identifier });
        this.updateDom(this.config.animationSpeed);
    },

    c2f: function(c){
        return 1.8*c+32;
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
