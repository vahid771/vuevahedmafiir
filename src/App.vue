<template>
  <object data="python.svg" type="image/svg+xml"></object>
  <Message msg="به وبسایت من خوش آمدید"/>
</template>

<script>
import Message from './components/Message.vue'

export default {
  name: 'App',
  components: {
    Message
  }
}
</script>

<style>
#app {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
