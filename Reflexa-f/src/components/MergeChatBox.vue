<template>
  <!-- 根容器，统一处理定位和布局 -->
  <div class="operation-panel-wrapper">
    <!-- 1. [Modify Mode Only] 浮动推荐标签区域 -->
    <!-- MergeChatBox.vue -> <template> -->

<!-- 1. [Modify Mode Only] 浮动推荐标签区域 -->
   <!-- MergeChatBox.vue -> <template> -->

<!-- 找到这个 div -->
<div v-if="isModifyMode && props.styleTags.length > 0 && tagsVisible" class="floating-tags-container">

  <div
    v-for="style in props.styleTags"
    :key="style.tag"
    class="style-tag-wrapper"
  >
    <!-- 预览图浮动窗口 (这部分代码保持不变) -->
    <div class="style-preview">
      <img :src="style.image" :alt="`预览图: ${style.tag}`" />
    </div>

    <!-- 原始的标签按钮 (这部分代码也保持不变) -->
    <button
      class="style-tag"
      @click="handleTagClick(style.tag)"
      :disabled="props.isLoading"
    >
      {{ style.tag }}
    </button>
  </div>

  <!-- Part 2: 手动添加刷新按钮 -->
  <div class="style-tag-wrapper">
    <!-- 这是一个新的按钮，没有预览图 -->
    <button
      class="style-tag refresh-button"
      @click="handleRefreshClick"
      :disabled="props.isLoading"
      title="换一批风格"
    >
       <img  src="../assets/refresh.svg" alt="Click to expand"></img>
    </button>
  </div>

</div>

    <!-- 2. 主聊天框 -->
    <div class="floating-chat-input" :class="modeClass">
      <!-- 回复模式下拉菜单 -->
      <div class="dropdown-container" v-if="props.isReflectionMode">
        <button class="dropdown-toggle" :style="currentTypeStyle" @click="typeMenuOpen = !typeMenuOpen">
          <span class="color-dot" :style="{ backgroundColor: currentType.color }"></span>
          <span>{{ currentType.label }}</span>
          <span class="arrow">▼</span>
        </button>
        <div v-if="typeMenuOpen" class="dropdown-panel">
          <button
            v-for="t in props.messageTypes"
            :key="t.value"
            class="dropdown-item"
            @click="selectType(t.value)"
          >
            <div class="item-content">
              <span class="color-dot" :style="{ backgroundColor: t.color }"></span>
              <span>{{ t.label }}</span>
            </div>
            <div class="mode-description">{{ t.description || 'No description available.' }}</div>
          </button>
        </div>
      
      </div>
        <template v-if="props.isReflectionMode">
        <span v-if="isMergeMode" class="merge-node-tag node-1">Merge</span>
        <span v-if="isModifyMode" class="merge-node-tag node-1">Modify</span>
        <span class="merge-node-tag node-2">{{ node1.version }}</span>
        <span v-if="isMergeMode" class="merge-node-tag node-2">{{ node2.version }}</span>
      <!-- 输入区域 -->
       </template>
      <div class="main-input-area">
      
        
        <textarea
          ref="textareaRef"
          :value="localInputText"
          @input="handleInput"
          @keydown.enter.exact.prevent="handleSubmit"
          @keydown.shift.enter.exact.prevent="handleShiftEnter"
          :placeholder="inputPlaceholder"
          :disabled="props.isLoading"
          @focus="hideTags"
          rows="1"
          class="chat-textarea"
        ></textarea>
      </div>

      <!-- 提交按钮 -->
      <button 
        :class="submitButtonClass" 
        @click="handleSubmit"
        :disabled="props.isLoading || (isModifyMode && !localInputText.trim())"
      >
        <img src="../assets/send_button.svg" alt="Click to send">
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

// --- Props and Emits Definition ---
const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (value) => ['merge', 'modify'].includes(value),
  },
  sourceNodes: {
    type: Array,
    required: true,
  },
  styleTags: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  inputText: {
    type: String,
    default: '',
  },
  messageTypes: {
    type: Array,
    default: () => [],
  },
  msgType: {
    type: String,
    default: 'general',
  },
  isReflectionMode: { // 新增点: 接收prop
    type: Boolean,
    default: true // 默认为true以保持旧行为
  },
});
const handleRefreshClick = () => {
  // 如果正在加载，则不执行任何操作
  if (props.isLoading) return;
  // 发出 'refresh-styles' 事件，通知父组件 (App.vue)
  emit('refresh-styles');
};
const emit = defineEmits([
  'update:inputText',
  'update:msgType',
  'submit:merge',
  'submit:modify',
  'unlockGraph' ,
  'refresh-styles'
]);

// --- Reactive State ---
const typeMenuOpen = ref(false);
const selectedTag = ref(null);
const localInputText = ref(props.inputText);
const textareaRef = ref(null); // [ADD] 添加 textarea 的 ref

// --- Watchers ---
watch(() => props.inputText, (newValue) => {
  localInputText.value = newValue;
  // 当父组件清空文本时，也调整高度
  if (newValue === '') {
    adjustTextareaHeight();
  }
});

const adjustTextareaHeight = async () => {
  await nextTick();
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
};

// --- Computed Properties ---
const isMergeMode = computed(() => props.mode === 'merge');
const isModifyMode = computed(() => props.mode === 'modify');

const modeClass = computed(() => ({
  'merge-mode': isMergeMode.value,
  'modify-mode': isModifyMode.value,
}));
const tagsVisible = ref(true); // 
const node1 = computed(() => props.sourceNodes[0] || {});
const node2 = computed(() => isMergeMode.value ? (props.sourceNodes[1] || {}) : {});

const inputPlaceholder = computed(() => 
  isMergeMode.value 
    ? '输入指令 (如:保留1-0的颜色)...' 
    : '输入消息...'
);

const submitButtonClass = computed(() => [
  isMergeMode.value ? 'merge-button' : 'apply-button',
  { 'loading': props.isLoading }
]);

const currentType = computed(() => 
  props.messageTypes.find(t => t.value === props.msgType) || props.messageTypes[0] || {}
);

const currentTypeStyle = computed(() => ({
  background: `${currentType.value.color || '#ccc'}22`,
  color: currentType.value.color || '#333',
}));

const handleInput = (event) => {
  updateInputText(event.target.value);
  adjustTextareaHeight();
};

// [ADD] 新增 handleShiftEnter 方法
const handleShiftEnter = (event) => {
  const textarea = event.target;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.substring(0, start) + "\n" + value.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + 1;
  handleInput({ target: textarea }); // 触发更新
};

const updateInputText = (value) => {
  localInputText.value = value;
  emit('update:inputText', value);
};


const hideTags = () => {
  if (tagsVisible.value) {
    tagsVisible.value = false;
    emit('unlockGraph'); // 发出解锁信号
  }
};


const selectTag = (tag) => {
  selectedTag.value = selectedTag.value === tag ? null : tag;
};

const selectType = (type) => {
  emit('update:msgType', type);
  typeMenuOpen.value = false;
};

const handleTagClick = (tag) => {
  // 如果正在加载中，则不执行任何操作
  if (props.isLoading) return;

  // 构建载荷，文本为空，因为是直接点击标签触发的
  const payload = {
    tag: tag,
    text: '',
    type: props.msgType,
  };

  // 立即发出事件
  emit('submit:modify', payload);
};

const handleSubmit = () => {
  if (props.isLoading) return;

  if (isMergeMode.value) {
     const payload = {
      instruction: localInputText.value,
      mode : props.msgType
     }
      emit('submit:merge', payload);
    
  } else if (isModifyMode.value) {
    const tagPart = selectedTag.value ? selectedTag.value.trim() : '';
    const textPart = localInputText.value.trim();
    
    if (tagPart || textPart) {
      const payload = {
        tag: null,
        type: props.msgType,
        text: textPart
      };
      emit('submit:modify', payload);
    }
  }
};
</script>

<style scoped>
/* Styles are identical to the previous version and have been omitted for brevity */
.operation-panel-wrapper {
  position: fixed;
  left: 50%;
  bottom: 0px;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 90vw;
  max-width: 640px;
}

.floating-tags-container {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 65px;
  gap: 6px;
}

.style-tag {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  color: #393939;
  padding: 6px 12px;
  bottom: 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  font-family: Arial, Helvetica, sans-serif;
}

.style-tag:hover {
  background-color: #f5f5f5;
  border-color: #cccccc;
}

.style-tag.selected {
  background-color: #8e24aa;
  color: #fff;
  border-color: #8e24aa;
  box-shadow: 0 2px 8px rgba(142, 36, 170, 0.3);
}

.style-tag:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.floating-chat-input {
   display: flex;
  /* 关键样式 */
  align-items: flex-end;
  gap: 10px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 6px 6px;
  width: 100%;
}

.dropdown-container { position: relative;height: 42px; }
.dropdown-toggle { display: flex; align-items: center; gap: 4px; height: 42px; padding: 4px 12px; border-radius: 24px; border: none; cursor: pointer; font-weight: 700; font-size: 15px; transition: background 0.2s; }
.color-dot { width: 10px; height: 10px; border-radius: 50%; }
.arrow { margin-left: auto; font-size: 12px; color: #888; padding-left: 6px; }

.dropdown-panel {
  position: absolute;
  bottom: 100%; /* 核心属性，将面板置于按钮之上 */
  left: 0;
  margin-bottom: 8px; /* (推荐) 增加8px的间距，避免紧贴 */
  
  z-index: 10;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 6px;
  width: 220px; /* (建议) 根据你的内容适当加宽 */
  
  /* --- 以下是关键改动 --- */
  /* 移除了 height: 30px; */
  /* overflow: visible; 在这种情况下也不再是必需的了 */
}
.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 16px;
  transition: background 0.15s;
}
.dropdown-item:hover { background: #f5f5f5; }

.item-content {
    display: flex;
    align-items: center;
    gap: 6px;
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
  color: #121111;
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

.main-input-area {
  flex: 1;
  display: flex;
  align-items: center;
  background: transparent;
  border-radius: 12px;
  height: auto; /* 关键：移除固定的 height: 44px */
  min-height: 36px;
  padding-left: 4px;
  gap: 3px
  ;
}

.chat-textarea {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #333;
  resize: none;
  overflow-y: hidden;
  line-height: 1.5;
  padding: 10px 2px; /* 调整内边距 */
  max-height: 200px;
  overflow-y: auto;
  font-family: Arial, Helvetica, sans-serif;
  box-sizing: border-box;
}
.merge-node-tag {
  color: #565555;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 2px 0px;
  margin-right: 0px;
  flex-shrink: 0;
   height: 32px; /* 和其他按钮高度保持一致 */
  display: flex; /* 用于垂直居中文字 */
  gap: 0px;
  align-items: center; 
}

.merge-node-tag.node-2 { background: white; margin-bottom: 3px; }
.merge-node-tag.node-1 { background:  white; border: 1px solid #EEEEEE;padding: 5px 4px;}



.main-input-area input:disabled {
  background-color: #f4f5f6;
  cursor: not-allowed;
}

.merge-button {
  background: transparent;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  padding: 0px 0px;
  height: 44px;
  flex-shrink: 0;
  transition: background 0.2s;
  transform: scale(1.1)
}


.apply-button {
  background: transparent;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  padding: 0 0px;
  height: 44px;
  flex-shrink: 0;
  transition: background 0.2s;
  transform: scale(1.2)
}

.merge-button:disabled, .apply-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.merge-button:disabled:hover, .apply-button:disabled:hover {
    background: initial;
}
/* MergeChatBox.vue -> <style scoped> */

/* 新增：标签和预览图的包裹容器 */
.style-tag-wrapper {
  position: relative; /* 为绝对定位的预览图提供上下文 */
  display: inline-block;
}

/* 新增：预览图容器的样式 */
.style-preview {
  position: absolute;
  bottom: calc(100% + 12px); /* 定位在标签按钮上方，并留出12px间距 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 2100; /* 确保在其他元素之上 */
  
  /* 默认隐藏，通过悬停显示 */
  visibility: hidden;
  opacity: 0;
  
  /* 外观样式 */
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  padding: 6px;
  border: 1px solid #e0e0e0;
  
  /* 动画效果 */
  transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out, transform 0.2s ease-in-out;
  
  /* 防止预览图干扰鼠标事件 */
  pointer-events: none; 
}

/* 新增：预览图内图片的样式 */
.style-preview img {
  display: block;
  width: 200px;  /* 设置一个固定的预览宽度 */
  height: auto;  /* 高度自适应 */
  border-radius: 5px; /* 让图片边角更柔和 */
}

/* 新增：当鼠标悬停在包裹容器上时，显示预览图 */
.style-tag-wrapper:hover .style-preview {
  visibility: visible;
  opacity: 1;
  transform: translateX(-50%) translateY(-5px); /* 轻微向上移动，增加动态感 */
}

/* 对原始 style-tag 稍作调整，确保它在需要时可以被点击 */
.style-tag {
  position: relative;
  z-index: 1; /* 确保按钮在预览图下方时仍可交互 */
}
</style>
