# simple-store-svelte

A <b>drop in replacement</b> for `svelte/store` which uses setters/getters to write/read the store's value.

Now you can do:
```js
// stores.js
import { writable } from 'simple-store-svelte'

const store = writable(null)

store.value = 'Hello world!'

const { value } = store

console.log(value) // 'new value!'
```
Instead of:
```js
// stores.js
import { writable, get } from 'svelte/store'

const store = writable(null)

store.set('Hello world!')

const value = get(store)

console.log(value) // 'new value!'
```
Other than the example above, the store is identical as the Svelte one, which means you can use it as you always did.

```svelte
<!-- App.svelte -->
<script>
  import { store } from './stores.js'

  $store = 'Goodbye world!'
</script>

<div>
  { $store } 
  <!-- null -->
  <!-- Hello world! -->
  <!-- Goodbye world! -->
</div>
```
