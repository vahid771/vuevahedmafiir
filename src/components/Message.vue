<template>
  <div class="cl_msg">
    <h1>{{ msg }}</h1>
  </div>
</template>

<script>
export default {
  name: 'Message',
  props: {
    msg: String
  }
}
</script>

<style scoped>
.cl_msg {
  color: #42b983;
}
</style>
