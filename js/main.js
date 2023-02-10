const getServiceWorker = (() => {
  const workerPromise = navigator.serviceWorker.register("js/worker.js")
  return () => workerPromise
})()

const getLocation = async () => {
  try {
    const { coords } = await new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(resolve, reject)
      } else {
        reject('Selain ei tue sijaintia.')
      }
    })
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
    }
    return position
  } catch (error) {
    console.error(error)
    if (error.code) {
      switch(error.code) {
        case error.PERMISSION_DENIED:
          alert("Lupa sijainnin hakemiseen hylättiin.")
          break;
        case error.POSITION_UNAVAILABLE:
          alert("Laite ei löydä sijaintia.")
          break;
        case error.TIMEOUT:
          alert("Lupaa sijainnin tarkastamiseen ei myönnetty ajoissa.")
          break;
        case error.UNKNOWN_ERROR:
          alert("Tuntematon virhe.")
          break;
      }
    }
  }
}

const allowNotifications = async () => {
  try {
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      return true
    }
    throw result
  } catch (errorCode) {
    if (errorCode === 'denied') {
      alert('User denied the request for notifications.')
    } else if (errorCode === 'default') {
      alert('Notifications not accepted')
    } else {
      console.error(errorCode)
      alert('Notification permission error')
    }
  }
}

const allowBackgroundSync = async () => {
  try {
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync',
    })
    if (status.state === 'granted') {
      return true
    } else {
      console.log(status)
      throw new Error('Backround sync denied')
    }
  } catch (error) {
    console.error(error)
    alert('Tausta-ajoa ei ole sallittu. Ilmoituksia ei voida lähettää sovelluksen ollessa suljettuna.')
    return false;
  }
}

const notifyWorker = async (message) => {
  const worker = await getServiceWorker()
  if (!worker) {
    alert('Worker not activated')
    return
  }
  worker.active.postMessage(message)
}

const start = async () => {
  const notificationsAavailable = await allowNotifications()
  if (!notificationsAavailable) {
    alert('Ilmoitukset eivät ole käytössä :( Hyväksy ilmoitukset sovelluksen asetuksista.')
  }

  const location = await getLocation()
  if (!location) {
    alert('Sijainti ei ole saatavilla. Sovellus ei voi käynnistyä.')
    return
  }

  await allowBackgroundSync()

  notifyWorker({
    type: 'START_NOTIFICATIONS',
    location,
  })
}

const stop = async () => {
  notifyWorker({
    type: 'STOP_NOTIFICATIONS',
  })
}
