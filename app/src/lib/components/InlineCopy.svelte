<script lang="ts">
  import { parseInlineCode } from '$lib/lesson-copy';

  let { text }: { text: string } = $props();
  let segments = $derived(parseInlineCode(text));
</script>

{#each segments as segment}{#if segment.kind === 'code'}<code class="inline-code">{segment.value}</code>{:else}{segment.value}{/if}{/each}
