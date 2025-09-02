<template>
  <div class="chat-section">
    <div class="chat-messages" ref="messagesContainer">
      <!-- 使用 template v-for 来处理条件渲染 -->
      <template v-for="msg in props.messages" :key="msg.id">
        <!-- 渲染版本分割线 -->
        <div v-if="msg.type === 'separator' && props.isReflectionMode" class="version-separator" :data-version-id="msg.versionId">
          <div class="separator-line"></div>
          <div
            class="separator-tag"
            :data-tooltip="getVersionDescription(msg.versionId)"
            
          >
            V{{ getVersionNumber(msg.versionId) }}
             <span class="detail" >Detail information</span>
          </div>
         
          <div class="separator-line"></div>
        </div>


        <!-- 渲染消息本体 (这部分代码保持不变) -->
        <div v-else :class="['message', msg.sender]">
          <div class="message-content">
            <!-- 用户消息 -->
            <template v-if="msg.sender === 'user'">
              <div class="message-version-tag" v-if="msg.versionId && props.isReflectionMode">
                V{{ getVersionNumber(msg.versionId) }}
              </div>
              <div class="message-text" v-html="marked(msg.text)"></div>
            </template>

            <!-- AI 消息 -->
            <template v-else-if="msg.sender === 'ai'">
              <template v-if="props.isReflectionMode">
              <div class="ai-message-header" @click="toggleDropdown(msg)" :class="{ 'is-disabled': !msg.originalRequestData }">
                <span class="ai-type-indicator" :style="{ backgroundColor: getMsgTypeColor(msg.currentType) }"></span>
                <span>{{ getMsgTypeLabel(msg.currentType) }}</span>
                <span v-if="msg.originalRequestData" class="arrow">▼</span>
                <span class="message-version-tag ai-tag" v-if="msg.versionId">
                  V{{ getVersionNumber(msg.versionId) }}
                </span>
              </div>
            </template>
              <div v-if="openDropdownId === msg.id" class="mode-dropdown-panel" v-click-outside="closeDropdown">
                <button
                  v-for="type in messageTypes.filter(t => t.value !== msg.currentType)"
                  :key="type.value"
                  class="mode-dropdown-item"
                  @click="selectMode(msg.id, type.value)"
                >
                  <span class="ai-type-indicator" :style="{ backgroundColor: type.color }"></span>
                  <span>{{ type.label }}</span>
                </button>
              </div>

              <div class="ai-message-divider"></div>

              <div v-if="msg.isLoading" class="loading-container">
                <div class="loader"></div>
                <span>正在生成中...</span>
              </div>

              <template v-else>
                
                <div class="message-text" v-if="currentResponse(msg)?.summary" v-html="marked(currentResponse(msg).summary)"></div>

                <div v-if="currentResponse(msg)?.code" class="code-block">
                  <div class="code-actions">
                    
                    <button @click="toggleCodeCollapse(msg.id)" class="button1">
                      <div  v-if="isCollapsed(msg.id)" >
                      <img src="../assets/unfold.svg" alt="Click to collapse" class="icon"></img>
                      <span> </span>
                      <span> 展开</span></div>
                      <div v-else > <img  src="../assets/fold.svg" alt="Click to expand" class="icon"></img>
                        <span>  </span>
                      <span> 折叠</span></div>
                     
                    </button>
                    <button @click="emits('apply-code', currentResponse(msg).code)" class="button2">使用代码</button>
                  </div>
                  <div :class="['editor-wrapper', { 'is-collapsed': isCollapsed(msg.id) }]">
                    <monaco-editor
                      class="code-display-editor"
                      :value="currentResponse(msg).code"
                      language="javascript"
                      :options="editorOptions"
                    />
                  </div>
                  
                </div>
                <div class="message-text" v-if="currentResponse(msg)?.rationale" v-html="marked(currentResponse(msg).rationale)"></div>
                <div class="message-text" v-if="currentResponse(msg)?.advice" v-html="marked(currentResponse(msg).advice)"></div>
                <div class="message-text" v-if="currentResponse(msg)?.exploration" v-html="marked(currentResponse(msg).exploration)"></div>
                <div class="message-text" v-if="currentResponse(msg)?.reflection" v-html="marked(currentResponse(msg).reflection)"></div>
              </template>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import MonacoEditor from 'monaco-editor-vue3';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';


// 自定义指令：用于检测点击外部区域
const vClickOutside = {
  mounted(el, binding) {
    el.__ClickOutsideHandler__ = event => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    setTimeout(() => {
        document.body.addEventListener('click', el.__ClickOutsideHandler__);
    }, 0);
  },
  unmounted(el) {
    document.body.removeEventListener('click', el.__ClickOutsideHandler__);
  },
};

// ‼️ --- 修复: 状态管理逻辑 --- ‼️
const collapsedStates = ref({});
// 只有在状态明确为 true 时才折叠，默认为展开 (undefined === true -> false)
const isCollapsed = (messageId) => collapsedStates.value[messageId] === false;
// 切换状态
const toggleCodeCollapse = (messageId) => {
  // 简化切换逻辑，将 undefined/false 切换为 true，true 切换为 false
  collapsedStates.value[messageId] = !collapsedStates.value[messageId];
};


const props = defineProps({
  messages: Array,
  messageTypes: Array,
  nodes: Array,
  savedData: Object,
  currentNodeId: String,
  isReflectionMode: Boolean ,
  isSavingNewVersion: Boolean, 
});

const emits = defineEmits(['apply-code', 'change-mode']);

const messagesContainer = ref(null);
const openDropdownId = ref(null);

const editorOptions = {
  readOnly: true,
  automaticLayout: true,
  fontSize: 13,
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  theme: 'vs',
  scrollbar: {
    vertical: 'auto',
  },
};

// 通过 versionId 获取版本号
const getVersionNumber = (versionId) => {
  if (!versionId || !props.nodes) return '';
  const node = props.nodes.find(n => n.id === versionId);
  return node ? node.version : '';
};

// 通过 versionId 获取版本描述
const getVersionDescription = (versionId) => {
  if (!versionId || !props.savedData || !props.savedData[versionId]) {
    return '暂无描述 (No description available)';
  }
  const desc = '版本描述: '+props.savedData[versionId].description;
  return (desc && desc !== '请先保存代码...' && desc !== '生成版本总结中...')
    ? desc
    : '暂无描述 (No description available)';
};


const currentResponse = (msg) => {
  if (!msg.responses || !msg.currentType) return null;
  return msg.responses[msg.currentType];
};

const toggleDropdown = (msg) => {
  if (!msg.originalRequestData) return;
  openDropdownId.value = openDropdownId.value === msg.id ? null : msg.id;
};

const closeDropdown = () => {
  openDropdownId.value = null;
}

const selectMode = (msgId, newMode) => {
  emits('change-mode', { messageId: msgId, newMode: newMode });
  closeDropdown();
};

const getMsgType = (type) => {
  return props.messageTypes.find(t => t.value === type) || {};
};

const getMsgTypeColor = (type) => {
  return getMsgType(type).color || '#bbb';
};

const getMsgTypeLabel = (type) => {
  return getMsgType(type).label || type;
};

// ChatAssistant.vue -> <script setup>

// ChatAssistant.vue -> <script setup>

// 找到并用下面的版本替换现有的 watch 逻辑
watch(
  () => [props.messages.length, props.currentNodeId],
  ([newLength, newNodeId], [oldLength, oldNodeId]) => {
    nextTick(() => {
      const container = messagesContainer.value;
      if (!container) return;

      const isNewMessageAdded = newLength > (oldLength || 0);
      const isNodeChanged = newNodeId !== oldNodeId;

      if (isNodeChanged&& !props.isSavingNewVersion && props.isReflectionMode){
        // 优先处理场景1: 用户点击了新节点，滚动到该版本的分割线
        const targetSeparator = container.querySelector(`[data-version-id='${newNodeId}']`);
        if (targetSeparator) {
          targetSeparator.scrollIntoView({
            behavior: 'smooth',
            block: 'start' // 'start' 表示将元素顶部与容器顶部对齐
          });
        }
      } else if (isNewMessageAdded) {
        // 场景2: 节点未变，但有新消息加入，滚动到底部
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  },
  { deep: true }
);
</script>

<style scoped>
/* 保持大部分原有样式不变 */
.chat-section {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  padding: 40px 15px 15px 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.message {
  display: flex;
  width: 100%;
}

.message.user {
  justify-content: flex-end;
}

.message.ai {
  justify-content: flex-start;
}

.message-content {
  max-width: 90%;
  padding: 12px 18px;
  border-radius: 18px;
  word-wrap: break-word;
  line-height: 1.3;
  font-size: 14px;
  position: relative;
}

.message.user .message-content {
  background: #DEF1FF;
  color: #333;
  border-bottom-right-radius: 5px;
  padding-top: 28px;
}

.message.ai .message-content {
  background: #f0f2f5;
  color: #333;
  border-bottom-left-radius: 5px;
  width: 100%;
  box-sizing: border-box;
}

.message-text {
    white-space: pre-wrap;
    text-align: left;
}

.code-block {
    margin-top: 10px;
    border: 1px solid #ddd;
    border-radius: 8px;
  
    overflow: hidden;
    background: #fff;
}

.editor-wrapper {
    height: 400px;
    overflow: hidden;
    transition: max-height 0.4s ease-in-out;
}

.editor-wrapper.is-collapsed {
    max-height: 40px;
}

.code-block ::v-deep(.code-display-editor) {
    height: 400px;
}

.code-actions {
  
    padding: 6px 10px;
    background-color: rgba(210, 210, 210, 0.25);
       display: flex;
    justify-content: flex-end;
    font-family: Arial, Helvetica, sans-serif;
    gap: 8px;
}
.button1 {
    background: transparent;
    color: grey;
    border:0px solid #ddd; 
    border-radius: 36px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    gap:2px

}
.button2 {
    background: white;
    color: #626365;
    border: none;
    border:1px solid #888888; 
    border-radius: 6px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    gap:2px

}


.detail {
  color:#dee2e6
}
/* ChatAssistant.vue -> <style scoped> */

/* --- 优化 Markdown 渲染间距 --- */
.message-text ::v-deep(p) {
  margin-top: 0;
  margin-bottom: 0.1em; /* 减小段落间距，em单位随字体大小缩放 */
}
.message-text ::v-deep(p:last-child) {
  margin-bottom: 0; /* 最后一个段落无下边距 */
}
.message-text ::v-deep(ul),
.message-text ::v-deep(ol) {
  padding-left: 20px; /* 优化列表缩进，视觉效果更好 */
  margin-top: 0.2em;
  margin-bottom: 0.2em;
}
.message-text ::v-deep(li) {
  margin-bottom: 0.12em; /* 极大地减小列表项之间的间距 */
}
/* 关键修复: 移除列表项内部段落的边距，防止双重边距问题 */
.message-text ::v-deep(li p:last-child) {
  margin-bottom: 0;
}
.message-text ::v-deep(strong) {
  font-weight: 600;
}
.message-text ::v-deep(code) {
  background-color: rgba(0,0,0,0.06);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
}

.version-separator {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
  gap: 12px;
}

.separator-line {
  flex-grow: 1;
  height: 1px;
  background-color: #e0e0e0;
}

.separator-tag {
  background-color: transparent;
  color: #495057;
  padding: 4px 12px;
  border-radius: 16px;

  font-size: 12px;
  font-weight: 600;
  cursor: default;
  position: relative;
  border: 0px solid #dee2e6;
}

.separator-tag[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #fbfbfb;
  color: #0f0f0f;
  font-weight: 500;
  font-size: 13px;
  text-align: left;
  white-space: pre-wrap;
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  width: 300px;
  max-width: 80vw;
  z-index: 100;
  opacity: 1;
  visibility: visible;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
}

.separator-tag[data-tooltip]:hover::before {
    content: '';
    position: absolute;
    bottom: calc(120% - 5px);
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: #343a40 transparent transparent transparent;
    z-index: 101;
}


.message-version-tag {
  position: absolute;
  top: 6px;
  right: 12px;
  font-size: 11px;
  background-color: rgba(255, 255, 255, 0.25);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.message-version-tag.ai-tag {
  background-color: rgba(0, 0, 0, 0.08);
  color: #555;
  right: 28px;
}

.ai-message-header {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #555;
    user-select: none;
    padding: 2px 4px;
    border-radius: 5px;
    max-width: 160px;
    transition: background-color 0.2s;
}
.ai-message-header:not(.is-disabled):hover {
    background-color: #e0e0e0;
}
.ai-message-header.is-disabled {
    cursor: default;
}

.ai-type-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

.ai-message-header .arrow {
    font-size: 10px;
    margin-left: auto;
    padding-right: 4px;
    color: #888;
}

.ai-message-divider {
    height: 1px;
    background: #e0e0e0;
    margin: 8px 0;
}

.mode-dropdown-panel {
    position: absolute;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10;
    top: 35px;
    left: 12px;
    padding: 6px;
    border: 1px solid #eee;
    min-width: 80px;
}
.icon {
  transform: scale(0.8);
}
.mode-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #333;
    transition: background-color 0.15s;
}

.mode-dropdown-item:hover {
    background-color: #f5f5f5;
}

.loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 20px 0;
    color: #555;
    font-size: 14px;
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
