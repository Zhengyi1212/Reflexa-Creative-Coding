<template>
  <div class="p5-section">
    <div class="p5-container">
      <!-- 代码编辑器区域 -->
      <div class="editor-pane">
        <!-- 修改后的两层Header -->
        <div class="header-container">
          <div class="header-top">
            <!-- 已修正: 调用一个专门的函数来触发事件 -->
            <button class="run-button" title="运行代码" @click="triggerRunCode">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill="#DEDFDE" />
                <path d="M9 7L17 12L9 17V7Z" fill="#454545" />
              </svg>
            </button>
            <button class="stop-button" title="暂停 (清除画布)" @click="triggerClearCode">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill="#DEDFDE" />
                <rect x="8" y="8" width="8" height="8" fill="#454545" />
              </svg>
            </button>
          </div>
          <div class="header-bottom">
            <span>Sketch.js</span>
          </div>
        </div>
        <div class="editor-wrapper">
          <monaco-editor
            ref="monaco"
            class="editor"
            :value="localCode"
            language="javascript"
            :options="editorOptions"
          />
        </div>
      </div>
      <!-- 运行结果区域 -->
      <div class="output-pane">
        <!-- 修改后的两层Header -->
        <div class="header-container">
          <div class="header-top">
            <!-- 已修正: 调用一个专门的函数来触发事件 -->
            <button class="save-button" title="保存代码" @click="triggerSaveCode" :class="{ 'is-flashing': isFlashing }">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill="#5DC2FB"/>
                <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" fill="white" />
              </svg>
            </button>
             <span v-if="isHintVisible" class="save-status-hint">尚未保存，请点击保存</span>
            <!--
            <div :class="{ 'is-flashing': isFlashing }">
              <span>请先保存当前版本代码</span>
            </div>
            -->
          </div>
          <div class="header-bottom">
            <span>Preview</span>
          </div>
        </div>
        <iframe
          id="p5-iframe"
          title="p5.js Canvas"
          class="p5-canvas"
          src="/p5-runner.html"
          sandbox="allow-scripts allow-same-origin"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
// 导入Vue 3兼容的Monaco Editor组件
import MonacoEditor from 'monaco-editor-vue3';

const props = defineProps({
  p5Code: String,
});

// [修改] 在emits数组中增加 'clear-code'
const emits = defineEmits(['update:p5Code', 'run-code', 'save-code', 'clear-code']);

// --- 核心修正点 ---
function triggerRunCode() {
  emits('run-code');
}
const isFlashing = ref(false);


// [!code ++] 使用 defineExpose 将方法暴露给父组件
defineExpose({
  flashSaveButton
});
// [新增] 定义触发清除事件的函数
function triggerClearCode() {
  emits('clear-code');
}
const isHintVisible = ref(false);
let flashTimeout = null; // 用于存储 setTimeout 的 ID
function triggerSaveCode() {
  emits('save-code');
  // 当用户点击保存时，立即停止并清除所有提示
  if (flashTimeout) clearTimeout(flashTimeout);
  isFlashing.value = false;
  isHintVisible.value = false;
}
// --- 修正结束 ---
function flashSaveButton() {
  // 如果当前有定时器在运行，先清除，防止重复触发
  if (flashTimeout) clearTimeout(flashTimeout);

  isFlashing.value = true;
  isHintVisible.value = true; // 显示提示

  // 设置一个定时器，在动画结束后同时隐藏按钮闪烁和提示文本
  flashTimeout = setTimeout(() => {
    isFlashing.value = false;
    isHintVisible.value = false; // 隐藏提示
  }, 2000); // 持续时间与闪烁动画一致
}
const localCode = ref(props.p5Code);
const monaco = ref(null);

const editorOptions = {
  theme: 'default',
  automaticLayout: true,
  fontSize: 14,
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
};

function handleCodeChange(newValue) {
  if (newValue !== props.p5Code) {
    console.log("Native event triggered: Code has changed!");
    // 这里在脚本内部使用 emits 函数是正确的
    emits('update:p5Code', newValue);
  }
}

watch(() => props.p5Code, (newValue) => {
  if (newValue !== localCode.value) {
    localCode.value = newValue;
  }
});

onMounted(() => {
  nextTick(() => {
    const editorInstance = monaco.value;
    if (editorInstance) {
        const editor = editorInstance.getEditor ? editorInstance.getEditor() : editorInstance.editor;
        if (editor) {
            editor.onDidChangeModelContent(() => {
                const currentValue = editor.getValue();
                handleCodeChange(currentValue);
            });
        }
    }
  });
});
</script>

<style scoped>
/* 整体布局样式 */
.p5-section {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.p5-container {
  display: flex;
  flex-direction: row;
  gap: 6px;
  height: 100%;
  width: 100%;
}

/* 编辑器和输出区域的通用面板样式 */
.editor-pane, .output-pane {
  flex: 1;
  min-width: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 新的Header容器样式 */
.header-container {
  display: flex;
  flex-direction: column;
  padding: 8px 20px 4px 20px; /* 调整内边距以适应两层结构 */
  background: #f0f2f5;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
}



/* Header底部（标题层）样式 */
.header-bottom {
  display: flex;
  align-items: center;
  color: #333;
  font-size: 15px;
  font-weight: 400;
  margin-top: 8px; /* 稍微增加与按钮层的间距 */
  padding-top: 8px; /* 在虚线上方增加一些内边距 */
  border-top: 1px dashed #dcdfe6; /* 添加1像素的灰色虚线上边框 */
}
/* 按钮通用样式 */

.header-top {
  display: flex;
  justify-content: flex-start; /* 按钮靠左对齐 */
  align-items: center;
  height: 38px; /* 与按钮高度保持一致 */
  gap: 30px; /* [新增] 使用gap属性为按钮之间提供8px的间距 */
}

/* [修改] 按钮通用样式，加入 .stop-button */
.run-button,  .stop-button {
  padding: 0;
  width: 38px;
  height: 38px;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: transparent;
   box-shadow: none;
   transform: scale(1.6);

}
.save-button{
  padding: 0;
  width: 38px;
  height: 38px;
  background: transparent;
  border: none;
  cursor: pointer;
  outline: transparent;
   box-shadow: none;
  transform: scale(1.4);
}

/* [修改] 为 .stop-button 添加过渡效果 */
.run-button svg, .save-button svg, .stop-button svg {
    transition: transform 0.2s ease-in-out;
}
/* [修改] 为 .stop-button 添加Hover效果 */
.run-button:hover svg, .save-button:hover svg, .stop-button:hover svg {
    border: 0px solid red;
    transform: scale(1.1);
    box-shadow: none;
}

.stop-button {
  margin-top: 10px;
}

/* 编辑器包裹层样式 */
.editor-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.editor {
  width: 100%;
  height: 100%;
}
.save-button.is-flashing {
  animation: flash-animation 0.5s 4; /* 闪烁 4 次，总计 2 秒 */
}

@keyframes flash-animation {
  0% {
    box-shadow: 0 0 8px 4px rgba(224, 41, 41, 0.7);
    background-color: #ce3939;
  }
  50% {
    box-shadow: none;
    background-color: #007bff; /* 恢复原色 */
  }
  100% {
    box-shadow: 0 0 8px 4px rgba(224, 41, 41, 0.7);
    background-color: #ce3939;
  }
}
/* p5 Canvas iframe样式 */
.p5-canvas {
  flex: 1;
  border: none;
  width: 100%;
  background: white;
}
.run-button:focus-visible, .save-button:focus-visible, .stop-button:focus-visible {
    outline: none !important;
    box-shadow: none !important;
}
.save-status-hint {
  margin-left: -18px; /* 调整与按钮的间距 */
  font-size: 14px;
  font-weight: 500;
  color: #868585; /* 提示为红色 */
}
</style>
