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
 *
 * https://svelte.dev/docs/svelte-store#readable
 * @template T
 * @param {T} [value] initial value
 * @param {import('./public.js').StartStopNotifier<T>} [start]
 * @returns {import('./public.js').Readable<T>}
 */
export function readable (value, start) {
  const writ = writable(value, start)
  return {
    subscribe: writ.subscribe,
    get value () {
      return writ.value
    }
  }
}

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 *
 * https://svelte.dev/docs/svelte-store#writable
 * @template T
 * @param {T} [val] initial value
 * @param {import('./public.js').StartStopNotifier<T>} [start]
 * @returns {import('./public.js').Writable<T>}
 */
export function writable (val, start = noop) {
  /** @type {import('./public.js').Unsubscriber} */
  let stop
  /** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
  const subscribers = new Set()
  /**
   * @param {T} newValue
   * @returns {void}
   */
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

  /**
   * @param {import('./public.js').Updater<T>} fn
   * @returns {void}
   */
  function update (fn) {
    set(fn(val))
  }

  /**
   * @param {import('./public.js').Subscriber<T>} run
   * @param {import('./private.js').Invalidator<T>} [invalidate]
   * @returns {import('./public.js').Unsubscriber}
   */
  function subscribe (run, invalidate = noop) {
    /** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
    const subscriber = [run, invalidate]
    subscribers.add(subscriber)
    if (subscribers.size === 1) {
      stop = start(set, update) || noop
    }
    run(val)
    return () => {
      subscribers.delete(subscriber)
      if (subscribers.size === 0 && stop) {
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
export function derived (stores, fn, initialValue) {
  const single = !Array.isArray(stores)
  /** @type {Array<import('./public.js').Readable<any>>} */
  const storesArray = single ? [stores] : stores
  if (!storesArray.every(Boolean)) {
    throw new Error('derived() expects stores as input, got a falsy value')
  }
  const auto = fn.length < 2
  return readable(initialValue, (set, update) => {
    let inited = false
    const values = []
    let pending = 0
    let cleanup = noop
    const sync = () => {
      if (pending) {
        return
      }
      cleanup()
      const result = fn(single ? values[0] : values, set, update)
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
      // We need to set this to false because callbacks can still happen despite having unsubscribed:
      // Callbacks might already be placed in the queue which doesn't know it should no longer
      // invoke this derived store.
      inited = false
    }
  })
}

/**
 * Takes a store and returns a new one derived from the old one that is readable.
 *
 * https://svelte.dev/docs/svelte-store#readonly
 * @template T
 * @param {import('./public.js').Readable<T>} store  - store to make readonly
 * @returns {import('./public.js').Readable<T>}
 */
export function readonly (store) {
  return {
    subscribe: store.subscribe.bind(store),
    get value () {
      return store.value
    }
  }
}

/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 *
 * https://svelte.dev/docs/svelte-store#get
 * @template T
 * @param {import('./public.js').Readable<T>} store
 * @returns {T}
 */
export function get (store) {
  return store?.value
}
