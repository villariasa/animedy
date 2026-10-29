<script lang="ts">
  import * as Select from "$lib/components/ui/select";

  export interface SelectOption {
    value: string;
    label: string;
  }

  let {
    value = $bindable(""),
    options,
    placeholder = "Select…",
    triggerClass = "",
    onValueChange
  }: {
    value?: string;
    options: SelectOption[];
    placeholder?: string;
    triggerClass?: string;
    onValueChange?: (value: string) => void;
  } = $props();

  // Hover-to-open: desktop menu-bar style — hovering the trigger (or the
  // open panel) reveals the options immediately, no click required. Click
  // and keyboard navigation still work normally via the underlying Select.
  let open = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function openNow(): void {
    clearTimeout(closeTimer);
    open = true;
  }

  function closeSoon(): void {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => (open = false), 150);
  }

  const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? placeholder);
</script>

<div onmouseenter={openNow} onmouseleave={closeSoon} role="presentation">
  <Select.Root
    type="single"
    {value}
    onValueChange={(v) => {
      value = v;
      onValueChange?.(v);
    }}
    bind:open
  >
    <Select.Trigger class={triggerClass}>
      <span class="truncate">{selectedLabel}</span>
    </Select.Trigger>
    <Select.Content onmouseenter={openNow} onmouseleave={closeSoon}>
      {#each options as option (option.value)}
        <Select.Item value={option.value} label={option.label} />
      {/each}
    </Select.Content>
  </Select.Root>
</div>
