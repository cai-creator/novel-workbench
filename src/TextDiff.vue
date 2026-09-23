<template>
  <div class="text-diff">
    <div class="text-diff-legend"><span class="text-diff-removed">删去 {{ result.removedChars }} 字</span><span class="text-diff-added">新增 {{ result.addedChars }} 字</span><small v-if="result.coarse">改动较大的段落按整段标记</small></div>
    <div class="text-diff-columns">
      <section><strong>{{ beforeLabel }}</strong><div class="text-diff-copy" :aria-label="beforeLabel"><span v-for="(part, index) in result.before" :key="index" :class="part.kind === 'removed' ? 'text-diff-removed' : ''">{{ part.text }}</span></div></section>
      <section><strong>{{ afterLabel }}</strong><div class="text-diff-copy" :aria-label="afterLabel"><span v-for="(part, index) in result.after" :key="index" :class="part.kind === 'added' ? 'text-diff-added' : ''">{{ part.text }}</span></div></section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { diffText } from './text-diff'

const props = defineProps<{ before: string; after: string; beforeLabel: string; afterLabel: string }>()
const result = computed(() => diffText(props.before, props.after))
</script>
