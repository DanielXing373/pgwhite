<template>
    <!-- Search bar section with label, input field, and clear button -->
    <section class="mb-4">
      <!-- Label for the search input -->
      <label
        class="block text-sm mb-2"
        style="color:#6b7280"
      >
        {{ label }}
      </label>
  
      <!-- Container for input and clear button, styled with flexbox -->
      <div class="flex gap-2" style="display:flex; gap:8px;">
        <!-- Text input bound to modelValue with input event handler -->
        <input
          :value="modelValue"
          @input="onInput"
          type="text"
          class="flex-1 px-3 py-2 rounded border"
          style="flex:1; padding:8px 12px; border:1px solid #e5e7eb; border-radius:6px;"
          :placeholder="placeholder"
        />
  
        <!-- Button to clear the input, triggers emitClear on click -->
        <button
          class="px-3 py-2 rounded border"
          style="border:1px solid #e5e7eb; border-radius:6px; padding:8px 12px; background-color:#ffffff; cursor:pointer;"
          @click="emitClear"
        >
          {{ clearText }}
        </button>
      </div>
    </section>
  </template>
  
  <script setup lang="ts">
  // Define the props accepted by this component.
  // These include the current input value, label text, placeholder text, and clear button text.
  // Future modifications might add validation or additional props for customization.
  const props = defineProps<{
    modelValue: string
    label: string
    placeholder: string
    clearText: string
  }>()
  
  // Define the events emitted by this component.
  // 'update:modelValue' is emitted when the input changes to enable v-model binding.
  // 'clear' is emitted when the clear button is clicked.
  // Additional events could be added here if needed in future.
  const emit = defineEmits<{
    (e: 'update:modelValue', v: string): void
    (e: 'clear'): void
  }>()
  
  // Event handler for input events on the text field.
  // Extracts the new value and emits 'update:modelValue' to update the parent component.
  // Keeping this function isolated improves readability and TypeScript support.
  function onInput(e: Event) {
    const target = e.target as HTMLInputElement
    emit('update:modelValue', target.value)
  }
  
  // Event handler for the clear button.
  // Emits the 'clear' event to notify the parent component to reset the input.
  // Future enhancements might include resetting internal state if added.
  function emitClear() {
    emit('clear')
  }
  </script>