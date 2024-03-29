importScripts('suncalc.js');

const getMoonDetails = ({ latitude, longitude }, date = new Date()) => {
  const { altitude, azimuth, distance } = SunCalc.getMoonPosition(
    date,
    latitude,
    longitude
  );

  const altitudeDeg = altitude * 180 / Math.PI
  const azimuthDeg = 360 + (azimuth * 180 / Math.PI) - 180

  const { fraction } = SunCalc.getMoonIllumination(date);

  return {
    altitude: Math.round(altitudeDeg),
    azimuth: Math.round(azimuthDeg),
    fraction: Math.round(fraction * 100),
    date,
  }
}

const getForecast = async ({ latitude, longitude }) => {
  const OWM_API_KEY = '0e4a70a7685b6e3d2e8e87cf4f8fe53c'
  const params = Object.entries({
    lat: latitude,
    lon: longitude,
    appid: OWM_API_KEY,
    mode: 'json',
    units: 'metric',
    lang: 'fi',
    cnt: 12
  })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const url = `https://api.openweathermap.org/data/2.5/forecast?${params}`
  const response = await fetch(url, { method: 'GET', cache: 'force-cache' })

  if (response.ok) {
    const result = await response.json()
    console.log(result)
    return result.list.map(simplifyForecast)
  } else {
    return null
  }
}

const simplifyForecast = (forecast) => ({
  date: new Date(forecast.dt * 1000),
  cloudiness: forecast.clouds.all,
  temperature: Math.round(forecast.main.temp),
  windSpeed: Math.round(forecast.wind.speed),
})

const compass = ['pohjoinen', 'koillinen', 'itä', 'kaakko', 'etelä', 'lounas', 'länsi', 'luode', 'pohjoinen']

const degreeToCompass = (deg) => {
  for (var i = 0; i < 8; i++) {
    const x = i * 45
    if (deg > -22.5 + x && deg <= Math.abs(-22.5 + 2 * 22.5) + x) {
      break
    }
  }
  return compass[i]
}

const getDateAfterHours = (hours) => {
  const date = new Date()
  date.setTime(date.getTime() + (hours * 60 * 60 * 1000))
  return date
}

const getNextMoonAboveHorizon = (coordinates) => {
  let moon = null
  let i = 0;
  do {
    moon = getMoonDetails(coordinates, getDateAfterHours(i++))
  } while(moon.altitude < 10)

  return moon
}

const getWeatherForDate = (desiredDate, forecast) => {
  return forecast.find(({ date }) => date <= desiredDate)
}

const notifyMoonPosition = async (cur, next) => {
  console.log('Current moon', cur)
  console.log('Next nice moon', next)

  const body1 = `Sijainnissa: ${cur.compass} ${cur.azimuth}°,
                korkeus ${cur.altitude}° (${cur.direction}),
                valaistu ${cur.fraction}%,
                pilvipeite ${cur.cloudiness}%,
                tuulisuus ${cur.windSpeed}m/s,
                lämpötila ${cur.temperature}°C`.replace(/\s+/g, ' ')

  const body2 = `${next.date.toLocaleString()}
                 sijainnissa: ${next.compass} ${next.azimuth}°,
                 valaistu ${next.fraction}%,
                 pilvipeite ${next.cloudiness || '?'}%`.replace(/\s+/g, ' ')

  await notify('Kuutilanne', body1)
  await notify('Kuu näkyvissä seuraavan kerran', body2)
}

const notify = (title, text) => {
  return self.registration.showNotification(title, {
    body: text,
    vibrate: [200, 400, 200, 400, 200, 400, 200],
    actions: [
      {
        action: 'STOP_NOTIFICATIONS',
        title: 'Pysäytä ilmoitukset',
      }
    ]
  })
}

const update = async (coordinates) => {
  console.log('Auto updating...')
  const moon = getMoonDetails(coordinates)
  const forecast = await getForecast(coordinates)
  const moonInThreeHours = getMoonDetails(coordinates, getDateAfterHours(3))

  const nextMoon = getNextMoonAboveHorizon(coordinates)
  const nextWeather = getWeatherForDate(nextMoon.date, forecast)

  await notifyMoonPosition(
    {
      ...forecast[0],
      ...moon,
      compass: degreeToCompass(moon.azimuth),
      direction: moon.altitude < moonInThreeHours.altitude ? 'nouseva' : 'laskeva',
    },
    {
      ...nextWeather,
      ...nextMoon,
      compass: degreeToCompass(nextMoon.azimuth),
    },
  )
}



const start = async (coordinates) => {
  console.log('Auto update started')
  update(coordinates)

  if ('periodicSync' in self.registration) {
    try {
      await self.registration.periodicSync.register('PERIODIC_UPDATE', {
        minInterval: 5 * 60 * 1000,
      })
      alert('Tausta-ajon käynnistys onnistui')
    } catch (error) {
      console.error(error)
      console.log('Periodic Sync could not be registered!');
      alert('Taustapäivitys ei ole käytössä. Olethan asentanut sovelluksen?')
    }
  } else {
    alert('Tausta-ajo ei ole tuettu')
  }
}

const stop = () => {
  self.registration.periodicSync.unregister('PERIODIC_UPDATE');
  console.log('Auto update stopped')
}

self.addEventListener("message", function(event) {
  console.log('Worker message received', event.data)

  if (event.data.type === 'START_NOTIFICATIONS') {
    start(event.data.location)
  }
  if (event.data.type === 'STOP_NOTIFICATIONS') {
    stop()
  }
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'PERIODIC_UPDATE') {
    event.waitUntil(update());
  }
});

self.addEventListener("install", event => {
  console.log("Service Worker installing.");
})

self.addEventListener("activate", event => {
  console.log("Service Worker activating.");
})
