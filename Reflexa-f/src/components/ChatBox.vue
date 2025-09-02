<template>
  <div class="floating-chat-input">
    <!-- 1. Dropdown Menu Section -->
    <div class="dropdown-container" v-if="props.isReflectionMode" >
      <button class="dropdown-toggle" :style="currentTypeStyle" @click="typeMenuOpen = !typeMenuOpen">
        <span class="color-dot" :style="{ backgroundColor: currentType.color }"></span>
        <span>{{ currentType.label }}</span>
        <span class="arrow">▼</span>
      </button>
      <div v-if="typeMenuOpen" class="dropdown-panel" >
        <!-- Loop through message types to create dropdown items -->
        <button
          v-for="t in props.messageTypes"
          :key="t.value"
          class="dropdown-item"
          @click="selectType(t.value)"
        >
          <!-- Main content of the item -->
          <div class="item-content">
            <span class="color-dot" :style="{ backgroundColor: t.color }"></span>
            <span>{{ t.label }}</span>
          </div>
          <!-- Description tooltip that appears on hover -->
          <div class="mode-description">{{ t.description || 'No description available.' }}</div>
        </button>
      </div>
    </div>
     
    <!-- 2. Version Tag -->
    <button class="version-tag" v-if="props.isReflectionMode" >
      {{ props.currentVersion }}
    </button>

    <!-- 3. Main Input Section -->
    <div class="main-input-area">
      <!-- The new auto-sizing textarea -->
      <textarea
        ref="textareaRef"
        :value="props.inputText"
        @input="handleInput"
        @keydown.enter.exact.prevent="onEnterPress"
        @keydown.shift.enter.exact.prevent="handleShiftEnter"
        placeholder="输入消息..."
        rows="1"
        class="chat-textarea"
      ></textarea>
      <button class="send-button" :disabled="props.isAiResponding" @click="emit('chat')">
        <div v-if="props.isAiResponding" class="loader"></div>
        <!-- It's better to require assets or use a public path -->
        <img src="../assets/send_button.svg" alt="Click to send">
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';

// --- Props and Emits Definition ---
const props = defineProps({
  messageTypes: Array,
  msgType: String,
  currentVersion: String,
  inputText: String,
  isAiResponding: Boolean,
  isReflectionMode: Boolean, 
});

const emit = defineEmits(['update:msgType', 'update:inputText', 'chat']);

// --- Reactive State ---
const typeMenuOpen = ref(false);
const textareaRef = ref(null); // Ref for the textarea element

// --- Computed Properties ---
const currentType = computed(() => {
  return props.messageTypes.find(t => t.value === props.msgType) || {};
});

const currentTypeStyle = computed(() => {
    return {
        background: `${currentType.value.color || '#ccc'}22`,
        color: currentType.value.color || '#333',
    }
});

// --- Methods ---
const selectType = (type) => {
  emit('update:msgType', type);
  typeMenuOpen.value = false;
};

const onEnterPress = () => {
    if (props.inputText.trim()) {
        emit('chat');
    }
};

/**
 * Adjusts the textarea's height based on its content.
 */
const adjustTextareaHeight = async () => {
  // Wait for the DOM to update after an input event
  await nextTick();
  const textarea = textareaRef.value;
  if (textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'; 
    // Set the height to the scrollHeight to fit the content
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
};

/**
 * Handles the input event from the textarea.
 * Updates the parent component's state and adjusts height.
 * @param {Event} event - The input event object.
 */
const handleInput = (event) => {
  emit('update:inputText', event.target.value);
  adjustTextareaHeight();
};

/**
 * Handles Shift+Enter keydown to insert a newline.
 * @param {KeyboardEvent} event - The keydown event object.
 */
const handleShiftEnter = (event) => {
  const textarea = event.target;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  
  // Insert newline at the cursor position
  textarea.value = value.substring(0, start) + "\n" + value.substring(end);
  
  // Move cursor to after the newline
  textarea.selectionStart = textarea.selectionEnd = start + 1;

  // Manually trigger input event to update v-model and adjust height
  handleInput({ target: textarea });
};


// --- Lifecycle Hooks and Watchers ---
onMounted(() => {
  adjustTextareaHeight();
});

watch(() => props.inputText, (newValue) => {
  // When the parent component clears the inputText (e.g., after sending a message),
  // we need to reset the textarea height.
  if (newValue === '') {
    // Use nextTick to ensure the value has been updated in the DOM
    nextTick(() => {
        adjustTextareaHeight();
    });
  }
});

</script>

<style scoped>
.floating-chat-input {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
   align-items: flex-end; 
  gap: 8px;
  background: #fff;
  border-radius: 24px; /* Slightly smaller radius for a tighter look */
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 8px 8px; /* Adjusted padding */
  width: 80vw;
  max-width: 640px;
  transition: all 0.2s ease-in-out;
}

/* Dropdown */
.dropdown-container {
  position: relative;
}
.dropdown-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  padding: 0 10px;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  transition: background 0.2s;
}
.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.arrow {
  margin-left: auto;
  font-size: 12px;
  color: #888;
  padding-left: 2px;
}
.dropdown-panel {
  position: absolute;
  bottom: 110%;
  left: 0;
  z-index: 10;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 6px;
  min-width: 220px;
  overflow: visible;
}

.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  gap: 0px;
}
.dropdown-item:hover {
  background: #f5f5f5;
}

.item-content {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #333;
}

.mode-description {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  left: 102%;
  top: 50%;
  transform: translateY(-50%);
  padding: 8px 12px;
  background-color: #fff;
  color: #121112;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  z-index: 20;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
}

.dropdown-item:hover .mode-description {
  visibility: visible;
  opacity: 1;
}


/* Version Tag */
.version-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
   color: #4d4d4d;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: 400;
  padding: 19px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.18s;
  height: 36px;
  flex-shrink: 0; /* Prevent tag from shrinking */
}

/* Main Input Area */
.main-input-area {
  flex: 1;
  display: flex;
  align-items: fl; /* Align textarea and button to the bottom */
  background: transparent; /* Slightly different background for contrast */
  border-radius: 18px;
  /* Key Change: Height is now flexible */
  height: auto;
  min-height: 30px;
  padding-right: 40px;
  
}

/* New Textarea Styles */
.chat-textarea {
  flex: 1;
  width: 70%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #292929;
  
  /* --- Key styles for auto-sizing --- */
  resize: none; /* Disable manual resize handle */
  overflow-y: hidden; /* Hide scrollbar initially */
  line-height: 1.4; /* Adjust line height for better readability */
  padding: 11px 10px; /* Vertical and horizontal padding */
  max-height: 180px; /* Set a max height */
  overflow-y: auto; /* Show scrollbar if max-height is exceeded */
  box-sizing: border-box;
  font-family: Arial, Helvetica, sans-serif; /* Inherit font from parent */
  
}

.send-button {
  height: 38px;
  width: 38px;
  min-width: 38px;
  padding: 0;
  border: none;
  border-radius: 50%; /* Make it circular */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform:scale(1.2);
  /* Key Change: Align to the bottom right */
  position: absolute;
   right: 10px;
  bottom: 2px;
  margin: 0; 
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(1);
}
.send-button:not(:disabled):hover {
  transform: scale(1.1);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
