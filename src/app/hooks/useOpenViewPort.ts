import { useEffect } from "react"

import { UI_PORT_NAME } from "~core/messages"

// Lets the service worker know this view is open, so the toolbar icon stays in color.
// Chrome can stop an idle service worker, which drops the port, so reconnect when that happens.
export const useOpenViewPort = () => {
  useEffect(() => {
    let port: chrome.runtime.Port
    let closed = false
    const connect = () => {
      port = chrome.runtime.connect({ name: UI_PORT_NAME })
      port.onDisconnect.addListener(() => {
        if (!closed) connect()
      })
    }
    connect()
    return () => {
      closed = true
      port.disconnect()
    }
  }, [])
}
