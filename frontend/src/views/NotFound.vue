<!-- 存在しないページ（S03） -->
<script setup>
import { MSG } from '../messages.js';
</script>

<template>
  <div class="list">
    <p class="empty">{{ MSG.S03 }}<br><RouterLink to="/records">記録一覧画面へ</RouterLink></p>
  </div>
</template>
