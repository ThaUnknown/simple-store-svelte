'use strict'

Object.defineProperty(exports, '__esModule', { value: true })

function noop () { }

function safeNotEqual (a, b) {
  // eslint-disable-next-line eqeqeq, no-self-compare
  return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function')
}
function isFunction (thing) {
  return typeof thing === 'function'
}
function runAll (fns) {
  fns.forEach(run)
}
function run (fn) {
  return fn()
}

function subscribe (store, ...callbacks) {
  if (store == null) {
    return noop
  }
  const unsub = store.subscribe(...callbacks)
  return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub
}

const subscriberQueue = []
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable (value, start) {
  return {
    subscribe: writable(value, start).subscribe
  }
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}val initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable (val, start = noop) {
  let stop
  const subscribers = new Set()
  function set (newValue) {
    if (safeNotEqual(val, newValue)) {
      val = newValue
      if (stop) { // store is ready
        const runQueue = !subscriberQueue.length
        for (const subscriber of subscribers) {
          subscriber[1]()
          subscriberQueue.push(subscriber, val)
        }
        if (runQueue) {
          for (let i = 0; i < subscriberQueue.length; i += 2) {
            subscriberQueue[i][0](subscriberQueue[i + 1])
          }
          subscriberQueue.length = 0
        }
      }
    }
  }
  function update (fn) {
    set(fn(val))
  }
  function subscribe (run, invalidate = noop) {
    const subscriber = [run, invalidate]
    subscribers.add(subscriber)
    if (subscribers.size === 1) {
      stop = start(set) || noop
    }
    run(val)
    return () => {
      subscribers.delete(subscriber)
      if (subscribers.size === 0) {
        stop()
        stop = null
      }
    }
  }
  return {
    set,
    update,
    subscribe,
    set value (newValue) {
      set(newValue)
    },
    get value () {
      return val
    }
  }
}
function derived (stores, fn, initialValue) {
  const single = !Array.isArray(stores)
  const storesArray = single
    ? [stores]
    : stores
  const auto = fn.length < 2
  return readable(initialValue, (set) => {
    let inited = false
    const values = []
    let pending = 0
    let cleanup = noop
    const sync = () => {
      if (pending) {
        return
      }
      cleanup()
      const result = fn(single ? values[0] : values, set)
      if (auto) {
        set(result)
      } else {
        cleanup = isFunction(result) ? result : noop
      }
    }
    const unsubscribers = storesArray.map((store, i) => subscribe(store, (value) => {
      values[i] = value
      pending &= ~(1 << i)
      if (inited) {
        sync()
      }
    }, () => {
      pending |= (1 << i)
    }))
    inited = true
    sync()
    return function stop () {
      runAll(unsubscribers)
      cleanup()
    }
  })
}

Object.defineProperty(exports, 'get', {
  enumerable: true,
  get: function (store) {
    return store.value
  }
})
exports.derived = derived
exports.readable = readable
exports.writable = writable
