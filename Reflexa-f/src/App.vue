<template>
  <div id="app" class="App">
    <div 
  v-if="isMerging || isModifying" 
  class="mode-backdrop" 
  @click="handleCancelOperation">
</div>
  <div class="top-right-panel">
      <div class="panel-item">
        <label for="user-input">user:</label>
        <input id="user-input" type="text" v-model="userInput" placeholder="user id...">
      </div>
      <div class="panel-item">
        <select v-model="selectedTask">
          <option value="unselected">unselected</option>
          <option value="TaskA: Baseline">TaskA: Baseline</option>
          <option value="TaskB: Reflection">TaskB: Reflection</option>
        </select>
      </div>
      <div class="panel-item">
        <button @click="toggleTimer" :class="['timer-button', { 'active': timerState.isActive }]">
          {{ timerState.isActive ? '结束' : '开始' }}
        </button>
    </div>
    </div>
    <div class="top-left-actions">
  <div class="panel-item">
    <button @click="uiState.showClearConfirmModal = true" class="clear-button">Clear</button>
  </div>
</div>
    <div class="new-layout-container">
      <div class="top-section"  ref="versionGraphArea"  :class="{ 'reflection-mode-active': selectedTask === 'TaskB: Reflection' || selectedTask === 'TaskA: Baseline' }">
        <VersionGraph
         v-if="selectedTask === 'TaskB: Reflection' || selectedTask === 'TaskA: Baseline'"
          :nodes="nodes"
          :edges="edges"
          :current-node-id="currentNodeId"
          :saved-data="savedData"
          :dragging="graphState.dragging"
          :graph-offset="graphState.offset"
          :graph-scale="graphState.scale"
          :selected-node-ids="uiState.selectedNodeIds"
          @preview-opened="trackingData.previewClicks++"
          @show-merge-chat="handleShowMergeChat"
          @update-description="handleUpdateDescription"
          @wheel="handleWheel"
          @mouse-down="handleMouseDown"
          @mouse-move="handleMouseMove"
          @mouse-up="handleMouseUp"
          @mouse-leave="handleMouseUp"
          @node-click="handleNodeClick"
          @clear-selection="uiState.selectedNodeIds = []"
          @add-version="handleAddVersion"
          @delete-version="handleDeleteVersion"
          @close-add-version-modal="handleCloseAddVersionModal"
          @update:selectedRecommendation="val => uiState.selectedRecommendation = val"
          @confirm-add-version="handleConfirmAddVersion"
          :is-preview-disabled="selectedTask === 'TaskA: Baseline'"
        />
      </div>

      <div class="bottom-section">
        <div class="chat-column"  ref="chatArea">
          <ChatAssistant
            :messages="visibleMessages"
            :message-types="messageTypes"
            @apply-code="handleApplyCodeFromAI"
            @change-mode="handleChangeMessageMode"
            :nodes="nodes" 
            :saved-data="savedData" 
            :current-node-id="currentNodeId" 
            :is-reflection-mode="selectedTask === 'TaskB: Reflection'"
            :is-saving-new-version="isSavingNewVersion" 
          />
        </div>
        <div class="p5-editor-column" ref="p5EditorArea">
          <P5Editor
            :p5-code="p5Code"
            @update:p5Code="val => p5Code = val"
            @run-code="runP5Code"
            @save-code="handleSaveClick"
            @clear-code="handleClearCode" 
            ref="p5EditorRef"
            
          />
        </div>
      </div>
    </div>

    <MergeChatBox
  v-if="isMerging || isModifying"
  :mode="uiState.activeMode"
  :source-nodes="isMerging ? selectedNodes : [uiState.modifyingNode]"
  :input-text="uiState.operationInputText"
  :style-tags="uiState.modifyStyleTags"
  @refresh-styles="refreshStyleTags"  
  :message-types="messageTypes"
  :msg-type="uiState.msgType"
   @update:msgType="val => uiState.msgType = val"
  :is-loading="uiState.isAiResponding"
  @update:inputText="val => uiState.operationInputText = val"
  @submit:merge="handleMerge"
  @submit:modify="handleApplyStyle"
  @cancel="handleCancelOperation"
  ref="mergeChatBoxArea"
  :is-reflection-mode="selectedTask === 'TaskB: Reflection'"



  @unlockGraph="uiState.graphInteractionLocked = false"
/>

<ChatBox
  v-else
  :message-types="messageTypes"
  ref="chatBoxArea"
  :msg-type="uiState.msgType"
  :current-version="currentVersion"
  :input-text="uiState.inputText"
  :is-ai-responding="uiState.isAiResponding"
  @update:msgType="val => uiState.msgType = val"
  @update:inputText="val => uiState.inputText = val"
  @chat="chatWithAI"
  @show-reflection="handleShowReflectionBox"
   :is-reflection-mode="selectedTask === 'TaskB: Reflection'"
/>

    <div v-if="uiState.showSaveToast" class="save-toast">
      {{ uiState.saveToastMsg }}
    </div>
    <div v-if="uiState.showReflectionBox" class="reflection-modal-backdrop" @click="uiState.showReflectionBox = false">
        <div class="reflection-modal-content" @click.stop>
            <h3>版本描述</h3>
            <template v-if="!uiState.reflectionSaved">
                <textarea
                    v-model="description"
                    placeholder="请输入版本描述..."
                ></textarea>
                <div v-if="uiState.reflectionError" class="error-text">{{ uiState.reflectionError }}</div>
                <button @click="handleReflectionSubmit">保存</button>
            </template>
            <template v-else>
                <div class="reflection-display">
                    {{ description }}
                    <button @click="handleCopyReflection">复制</button>
                </div>
                <button @click="() => { uiState.showReflectionBox = false; uiState.reflectionSaved = false; }">关闭</button>
            </template>
        </div>
    </div>
    <div v-if="uiState.showClearConfirmModal" class="confirmation-modal-backdrop">
  <div class="confirmation-modal-content">
    <h3>确认操作</h3>
    <p>您确定要清除所有会话数据吗？</p>
    <div class="confirmation-modal-actions">
      <button @click="uiState.showClearConfirmModal = false" class="cancel-button">取消</button>
      <button @click="confirmClearSession" class="confirm-button">确认清除</button>
    </div>
  </div>
</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted,onBeforeUnmount,  } from 'vue';
import * as api from './services/api';
import * as persistence from './utils/persistence';
import VersionGraph from './components/VersionGraph.vue';
import P5Editor from './components/P5Editor.vue';
import ChatAssistant from './components/ChatAssistant.vue';
import ChatBox from './components/ChatBox.vue';
import MergeChatBox from './components/MergeChatBox.vue';



const tempMessageSourceNodeId = ref(null);
const hasUnsavedMessages = computed(() => tempMessageSourceNodeId.value !== null);
// --- Constants (Non-Reactive) ---
const messageTypes = [
  { value: 'general', label: 'General', color: '#a67c52' ,description: ''}, //Helps to develop a new perspective for reassessing orientation to perceiving, feeling, or acting.
  { value: 'explainable', label: 'R1: Explainable&Justified', color: '#1976d2',description: '帮助回顾并解释行动' },
  { value: 'explorative', label: 'R2: Explorative', color: '#ff9800',description: '帮助洞察信息之间的关联，以便从多个角度“看见更多事物”' },//Helps to revisit actions with explanations
  { value: 'transformative', label: 'R3: Transformative', color: '#8e24aa',description: ' 帮助建立新视角，重估个人在认知、情感与行为上的倾向' },
];                               // Helps to discern connections between pieces of information to ‘see more things’ from multiple perspectives
//
const p5EditorRef = ref(null);
//
const drawingReferenceLibrary = [
    // ... (content is identical and omitted for brevity)
];
//

const timerState = reactive({
  isActive: false,
  currentRegion: null, // 'versionGraph', 'chat', 'p5Editor'
  startTime: null,
  timingData: {
    versionGraph: [],
    chat: [],
    p5Editor: [],
  }
});
const isSavingNewVersion = ref(false)
// 用于绑定模板中区域DOM元素的引用
const versionGraphArea = ref(null);
const chatArea = ref(null);
const p5EditorArea = ref(null);
const mergeChatBoxArea = ref(null);
const chatBoxArea = ref(null);



// ‼️ 用下面的版本替换现有的 predecessorIds 计算属性
const predecessorIds = computed(() => {
    const allPredecessors = new Set();
    if (!currentNodeId.value) {
        return allPredecessors;
    }

    // 使用一个队列（Queue）来进行广度优先搜索（BFS）的变体，向上遍历图
    const queue = [currentNodeId.value];
    const visited = new Set(queue);

    // 1. 构建一个从子节点到父节点的快速查找映射
    // 对于合并节点，一个子节点可以有多个父节点
    const parentMap = new Map();
    edges.value.forEach(edge => {
        if (!parentMap.has(edge.to)) {
            parentMap.set(edge.to, []);
        }
        parentMap.get(edge.to).push(edge.from);
    });
    
    // 找到没有父节点的根节点（以防万一图不是完全连接的）
    const rootNodes = nodes.value.filter(node => !edges.value.some(edge => edge.to === node.id));
    rootNodes.forEach(node => {
        if (!parentMap.has(node.id)) {
            parentMap.set(node.id, []);
        }
    });


    while (queue.length > 0) {
        const currentId = queue.shift();
        allPredecessors.add(currentId);

        // 查找当前节点的所有父节点
        const parents = parentMap.get(currentId) || [];
        
        for (const parentId of parents) {
            if (!visited.has(parentId)) {
                visited.add(parentId);
                queue.push(parentId);
            }
        }
    }

    return allPredecessors;
});

// 找到并用下面的版本替换现有的 visibleMessages 计算属性
const visibleMessages = computed(() => {
    // [!code focus:13]
    // --- 模式A: Baseline (消息隔离) ---
    if (selectedTask.value === 'TaskA: Baseline') {
        // 直接返回所有消息，不做任何过滤
        return messages.value;
    }

    // --- 模式B: Reflection (显示上下文历史) ---
    // (这部分逻辑保持不变)
    const relevantIds = new Set([
        ...predecessorIds.value,
        ...descendantIds.value
    ]);

    const relevantMessages = messages.value.filter(msg => 
        relevantIds.has(msg.versionId) ||
        (msg.versionId === 'temp' && currentNodeId.value === tempMessageSourceNodeId.value)
    );
    
    const result = [];
    for (let i = 0; i < relevantMessages.length; i++) {
        const currentMsg = relevantMessages[i];
        const prevMsg = relevantMessages[i - 1];

        if (currentMsg.versionId !== 'temp') {
            if (i === 0 || currentMsg.versionId !== prevMsg.versionId) {
                const node = nodes.value.find(n => n.id === currentMsg.versionId);
                if (node) {
                    result.push({
                        type: 'separator',
                        id: `sep-start-${currentMsg.versionId}`,
                        versionId: currentMsg.versionId
                    });
                }
            }
        }
        result.push(currentMsg);
    }
    return result;
});
const trackingData = reactive({
  totalVersions: 0,
  versionConversations: {}, // { '1-0': [{...}], '1-1': [{...}] }
  previewClicks: 0,
  actionCounts: {
    delete: 0,
    modify: 0,
    merge: 0,
    duplicate: 0,
  },
  versionCodes: {}, 
})
const versionChatState = reactive({});
const maxBranchNumber = ref(0); // 用于记录已创建的最大主版本号
// --- Core Reactive State ---
const sessionId = ref(null);
const messages = ref([]);
const nodes = ref([]);
const edges = ref([]);
const currentNodeId = ref('1-0');
const p5Code = ref('');
const savedData = reactive({});
const description = ref('');
// --- 新增的状态，用于控制右上角面板 ---
const selectedTask = ref('unselected');
const userInput = ref(''); // 用于存储用户输入框的值


// 在 predecessorIds 计算属性之后，添加以下代码
const descendantIds = computed(() => {
    const descendants = new Set();
    if (!currentNodeId.value) return descendants;

    // 使用队列进行广度优先搜索 (BFS) 来查找所有后代
    const queue = [currentNodeId.value];
    const visited = new Set([currentNodeId.value]);

    // 构建一个从父节点到子节点的快速查找映射
    const childMap = new Map();
    edges.value.forEach(edge => {
        if (!childMap.has(edge.from)) childMap.set(edge.from, []);
        childMap.get(edge.from).push(edge.to);
    });

    let head = 0;
    while (head < queue.length) {
        const currentId = queue[head++];
        const children = childMap.get(currentId) || [];
        for (const childId of children) {
            if (!visited.has(childId)) {
                visited.add(childId);
                descendants.add(childId);
                queue.push(childId);
            }
        }
    }
    return descendants;
});


 

// --- Grouped UI State ---
const uiState = reactive({
  inputText: "",
  
  msgType: 'general',
  showSaveToast: false,
  saveToastMsg: '',
  selectedNodeIds: [],
  graphInteractionLocked: false,
  activeMode: null, // 'merge' or 'modify'
  operationInputText: "", // 通用的输入框文本
  modifyingNode: null, // 正在被修改的节点
  modifyStyleTags: [], // 从后端获取的推荐标签

  showReflectionBox: false,
  reflectionError: '',
  reflectionSaved: false,
  isAiResponding: false,
  showClearConfirmModal: false,
});

// --- Grouped Graph Interaction State ---
const graphState = reactive({
  scale: 1,
  offset: { x: 40, y: 40 },
  dragging: false,
  lastPos: { x: 0, y: 0 },
});

// --- Computed Properties ---
const currentVersion = computed(() => {
  const node = nodes.value.find(n => n.id === currentNodeId.value);
  return node ? node.version : '';
});

const isMerging = computed(() => uiState.selectedNodeIds.length === 2);

const isModifying = computed(() => uiState.activeMode === 'modify' && uiState.modifyingNode !== null);

// selectedNodes 计算属性现在依赖 isMerging
const selectedNodes = computed(() => {
    if (!isMerging.value) return [];
    return uiState.selectedNodeIds.map(id => nodes.value.find(n => n.id === id));
});



// --- Watchers for State Persistence ---
watch(
  () => ({
    messages: messages.value,
    nodes: nodes.value,
    edges: edges.value,
    currentNodeId: currentNodeId.value,
    p5Code: p5Code.value,
    savedData: savedData,
    description: description.value,
    versionChatState: versionChatState, 
    maxBranchNumber: maxBranchNumber.value 
  }),
  (newState) => {
    persistence.saveStateToSessionStorage(newState);
  },
  { deep: true }
);

// 在 App.vue 的 <script setup> 中
watch(currentNodeId, (newNodeId) => {
     handleClearCode();
    // 检查新节点是否有已保存的代码 (使用更严谨的检查方式)
    if (savedData[newNodeId] && typeof savedData[newNodeId].code === 'string') {
        // 如果有，则加载该版本的代码
        p5Code.value = savedData[newNodeId].code;
    } else {
        // 如果新版本没有任何已保存的代码，则加载默认的初始代码
        // 这确保了每次切换版本，编辑器都有一个明确、可预期的状态
        p5Code.value = persistence.getDefaultCode(); 
    }
});


// --- Initialization Logic (replaces created hook) ---
sessionId.value = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
console.log("Generated new Session ID:", sessionId.value);

const persistedState = persistence.loadStateFromSessionStorage(); // [!code focus] // 修正：添加了这一行来加载状态

// 找到 `persistedState` 的处理逻辑，并用以下代码替换
const initialAiMessage = {
    id: 1,
    sender: 'ai',
    userQuery: '', // 初始消息没有对应的用户输入
    responses: {
        'general': {
            rationale: "你好！我是你的AI助手，有什么可以帮助你的吗？",
            code: null,
            next_step: null,
            summary: null
        }
    },
    currentType: 'general',
    isLoading: false,
     versionId: '1-0' ,
    originalRequestData: null // 初始消息不可切换模式
};

const initialNode = { 
    id: '1-0', 
    x: 1, 
    y: 0, 
    version: '1.0', // 使用新的用户版本号
    parent: null,
    color: '#1976d2', // 确保初始节点有颜色
    description: '一个灰色背景的画布',
    
};

if (persistedState) {
    messages.value = persistedState.messages || [initialAiMessage];
    // 确保从持久化存储加载时，如果nodes不存在，则使用新的初始节点
    nodes.value = persistedState.nodes && persistedState.nodes.length > 0 ? persistedState.nodes : [initialNode];
    edges.value = persistedState.edges || [];
    currentNodeId.value = persistedState.currentNodeId || '1-0';
    p5Code.value = persistedState.p5Code || persistence.getDefaultCode();
    Object.assign(savedData, persistedState.savedData || {});
    description.value = persistedState.description || '';
    Object.assign(versionChatState, persistedState.versionChatState || {}); 
    
} else {
    messages.value = [initialAiMessage];
    nodes.value = [initialNode]; // 使用新的初始节点
    p5Code.value = persistence.getDefaultCode();
}

if (nodes.value.length > 0) {
    const allMajors = nodes.value.map(n => {
        const versionString = n.version.startsWith('M-') ? n.version.substring(2) : n.version;
        return parseInt(versionString.split('.')[0], 10) || 0;
    });
    maxBranchNumber.value = Math.max(...allMajors, 0);
} else {
    // 如果没有任何节点，则基数为0，下一个创建的将是版本1.0
    maxBranchNumber.value = 0;
}

if (!savedData[initialNode.id]) {
    savedData[initialNode.id] = {
        code: p5Code.value, // 此时 p5Code 是默认代码
        image: null,
        description: initialNode.description ,
        save_count: 1 // // 从 initialNode 获取初始描述
    };
}

// --- Lifecycle Hooks ---
onMounted(() => {
  runP5Code();
});



const regionRefs = {
  versionGraph: versionGraphArea,
  chat: [chatArea, mergeChatBoxArea, chatBoxArea], // 将所有聊天相关区域组合
  p5Editor: p5EditorArea,
};

// --- 事件处理器 ---
const handleRegionEnter = (regionName) => {
  if (!timerState.isActive || timerState.currentRegion === regionName) return;
  
  // 停止上一个计时器（如果有）
  stopCurrentRegionTimer();
  
  // 开始新区域的计时
  timerState.currentRegion = regionName;
  timerState.startTime = Date.now();
  console.log(`[Enter] 开始计时区域: ${regionName}`);
};

const handleRegionLeave = () => {
  if (!timerState.isActive) return;
  stopCurrentRegionTimer();
  console.log(`[Leave] 暂停计时`);
};


// --- 核心控制函数 ---
function stopCurrentRegionTimer() {
  if (timerState.currentRegion && timerState.startTime) {
    const endTime = Date.now();
    const duration = endTime - timerState.startTime;
    timerState.timingData[timerState.currentRegion].push({ start: timerState.startTime, end: endTime, duration });
    console.log(`区域 ${timerState.currentRegion} 本次计时结束，时长: ${duration}ms`);
  }
  timerState.currentRegion = null;
  timerState.startTime = null;
}

function manageEventListeners(action) { // action can be 'add' or 'remove'
  const method = action === 'add' ? 'addEventListener' : 'removeEventListener';
  
  for (const regionName in regionRefs) {
    const refs = Array.isArray(regionRefs[regionName]) ? regionRefs[regionName] : [regionRefs[regionName]];
    refs.forEach(ref => {
      // Vue 3 中，组件的 ref 需要访问 .$el
      const element = ref.value?.$el || ref.value; 
      if (element) {
        element[method]('mouseenter', () => handleRegionEnter(regionName));
        element[method]('mouseleave', handleRegionLeave);
      }
    });
  }
}

async function toggleTimer() {
  if (timerState.isActive) {
    // --- 结束计时 ---
    stopCurrentRegionTimer();
    timerState.isActive = false;
    manageEventListeners('remove'); // 移除监听器
    
    // --- 埋点数据最终处理与发送 ---
    // 1. 更新最终的版本总数
    trackingData.totalVersions = nodes.value.length;
    

    // 2. [!code ++] 新增：填充每个版本的代码
    trackingData.versionCodes = {}; // 先清空，确保是最新数据
    for (const node of nodes.value) {
      if (savedData[node.id] && savedData[node.id].code) {
        trackingData.versionCodes[node.id] = savedData[node.id].code;
      }
    }
    // 2. 准备最终的载荷 (payload)
    const finalSessionData = {
      session_id: sessionId.value,
      user_id: userInput.value,
      task: selectedTask.value,
      timingData: JSON.parse(JSON.stringify(timerState.timingData)),
      usageData: JSON.parse(JSON.stringify(trackingData)) // 我们新加的埋点数据
    };

    console.log('即将发送的最终会话数据:', finalSessionData);
    
    // 3. 发送数据 (假设你有一个新的API端点来接收)
    try {
      // 你可能需要在 api.js 中创建一个新的函数，例如 sendFinalSessionData
      await api.sendTimingData(finalSessionData); // 这里暂时复用旧的API函数，你可以改为新的
      //alert('计时与埋点数据已成功发送！');
    } catch (error) {
      console.error('发送最终会话数据失败:', error);
      alert('发送最终会话数据失败，请查看控制台。');
    }

  } else {
    // --- 开始计时 ---
    timerState.timingData = { versionGraph: [], chat: [], p5Editor: [] };
    timerState.currentRegion = null;
    timerState.startTime = null;
    timerState.isActive = true;
    
    // 延迟一点添加监听器，确保所有元素都已渲染
    setTimeout(() => manageEventListeners('add'), 100); 
    console.log('计时器已激活！现在将通过鼠标悬停来计时。');
  }
}

// 3. 更新 onBeforeUnmount 清理逻辑
onBeforeUnmount(() => {
  // 组件销毁前，确保移除所有监听器
  manageEventListeners('remove');
});





// --- Functions (replaces methods) ---
async function handleChangeMessageMode({ messageId, newMode }) {
    const messageToUpdate = messages.value.find(m => m.id === messageId);

    // 如果消息不存在，正在加载中，或它是不可切换的初始消息，则直接返回
    if (!messageToUpdate || messageToUpdate.isLoading || !messageToUpdate.originalRequestData) return;

    // 如果该模式的结果已存在，直接切换视图，无需请求API
    if (messageToUpdate.responses[newMode]) {
        messageToUpdate.currentType = newMode;
        return;
    }

    // 设置加载状态，并立即切换当前类型，以便UI能正确显示加载动画和新的模式标题
    messageToUpdate.isLoading = true;
    messageToUpdate.currentType = newMode;

    // 构建新的请求数据
    const requestData = {
        ...messageToUpdate.originalRequestData,
        user_question: messageToUpdate.userQuery,
        type: newMode, // [!code focus] 使用新的模式
        interaction_count : 1
    };

    console.log("Re-sending data to backend with new mode:", requestData);

    try {
        const data = await api.postChatMessage(requestData);
        // 存储新模式的结果
    

        messageToUpdate.responses[newMode] = {
            rationale: data.rationale,
            code: data.code || null,
            summary: data.summary || "以下是修改后的代码:",
            rationale: data.rationale || null,
            reflection: data.reflection || null,
            exploration: data.exploration || null,
            advice: data.advice || null,
        };
        console.log(data)
    } catch (err) {
        messageToUpdate.responses[newMode] = {
            text: `加载此模式时出错: ${err.message}`,
        };
    } finally {
        // 关闭加载状态
        messageToUpdate.isLoading = false;
    }
}
function handleSaveClick() {
  if (selectedTask.value === 'TaskA: Baseline') {
    handleBaselineSave();
  } else {
    handleSave();
  }
}
async function refreshStyleTags() {
  // 安全检查，确保我们正处于修改模式
  if (!uiState.modifyingNode) return;

  uiState.isAiResponding = true; // 开启加载状态，防止用户重复点击
  try {
    // 再次调用获取推荐样式的API
    const styles = await api.getModifyStyleTags();
    // 用API返回的全新数据，直接覆盖旧的 styleTags 数组
    uiState.modifyStyleTags = styles;
  } catch (err) {
    console.error("刷新风格推荐失败:", err);
    // 这里可以添加一个用户提示，例如一个短暂的Toast
  } finally {
    uiState.isAiResponding = false; // 关闭加载状态
  }
}

async function chatWithAI() {
  if (!uiState.inputText.trim() || uiState.isAiResponding) return;

  if (!hasUnsavedMessages.value) {
    tempMessageSourceNodeId.value = currentNodeId.value;
  }

  const userMessage = {
    id: Date.now(),
    text: uiState.inputText,
    sender: "user",
    // [!code --] versionId: currentNodeId.value,
    // [!code ++] 将 versionId 设为 'temp'，表示暂存状态
    versionId: 'temp',
  };
  messages.value.push(userMessage);

  const userQuestion = uiState.inputText;
  const currentMsgType = uiState.msgType;
  uiState.inputText = "";
  
let interaction_count = 0;
const nodeId = currentNodeId.value;
const mode = currentMsgType;
  // 仅在反思模式下启用计数器
  if (['explainable', 'explorative', 'transformative'].includes(mode)) {
    // 获取或初始化当前节点的聊天状态
    const state = versionChatState[nodeId] || { lastMode: '', count: 0 };

    if (state.lastMode === mode) {
      // 如果模式未变，计数器增加
      state.count++;
    } else {
      // 如果模式改变，重置计数器
      state.count = 1;
    }
    // 更新当前模式为最后一次使用的模式
    state.lastMode = mode;
    
    // 更新全局状态
    versionChatState[nodeId] = state;

    console.log(`[前端计数器] 版本: ${nodeId}, 模式: ${mode}, 次数: ${state.count}`);

    // 检查是否触发深度反思
    interaction_count = state.count
  }


  const requestData = {
    session_id: sessionId.value,
    version_id: currentNodeId.value,
    code: p5Code.value,
    code_description: savedData[currentNodeId.value]?.description || '',
    short_term_history: messages.value.slice(-6).map(msg => {
      if (msg.sender === 'user') {
        return { role: 'user', content: msg.text };
      }
      // 从新的数据结构中正确获取AI回复文本
      const resp = msg.responses?.[msg.currentType];
      return { role: 'chatgpt', content: resp?.text || '' };
    }),short_term_history: messages.value.slice(-6).map(msg => {
      if (msg.sender === 'user') {
        return { role: 'user', content: msg.text };
      }
      
      // 对于 AI 消息，正确地组合其所有文本内容
      const resp = msg.responses?.[msg.currentType];
      if (!resp) {
        return { role: 'assistant', content: '' }; // 使用 'assistant' 作为 role
      }

      // 将所有可能的文本部分收集到一个数组中
      const contentParts = [
        resp.summary,
        resp.rationale,
        resp.advice,
        resp.exploration,
        resp.reflection,
      ].filter(part => part); // 过滤掉所有 null, undefined 或空字符串

      // 用换行符将它们连接成一个完整的字符串
      const fullContent = contentParts.join('\n\n'); 

      return { role: 'assistant', content: fullContent }; // 使用 'assistant' 作为 role
    }),
    user_question: userQuestion,
    type: currentMsgType, // [!code focus] 将当前模式传递给API
    interaction_count: interaction_count
  };

  console.log("Sending aligned data to backend:", requestData);
  uiState.isAiResponding = true;

  const aiMessageId = Date.now() + 1;
  const aiMessage = {
    id: aiMessageId,
    sender: 'ai',
    userQuery: userQuestion,
    responses: {},
    // [!code --] versionId: currentNodeId.value,
    // [!code ++] AI回复同样设为 'temp'
    versionId: 'temp',
    currentType: currentMsgType,
    isLoading: true,
    originalRequestData: { session_id: requestData.session_id,
        version_id: requestData.version_id,
        code: requestData.code,
        code_description: requestData.code_description,
        short_term_history: requestData.short_term_history, }
  };
  messages.value.push(aiMessage);
  try {
    const data = await api.postChatMessage(requestData);

    const versionIdForTracking = tempMessageSourceNodeId.value;
  if (!trackingData.versionConversations[versionIdForTracking]) {
    trackingData.versionConversations[versionIdForTracking] = [];
  }
  trackingData.versionConversations[versionIdForTracking].push({
    operationName: 'chat', // [!code ++]
    mode: currentMsgType,
    userPrompt: userQuestion,
    aiResponse: data,
    timestamp: new Date().toISOString(),
  });

    const messageToUpdate = messages.value.find(m => m.id === aiMessageId);
    if (messageToUpdate) {
        let summary_em = ''
        if (interaction_count >=2) {
          summary_em = ''
        } else {
          summary_em = '以下是修改后的代码:'
        }
        // 将返回结果存入对应模式的 "responses" 中
        messageToUpdate.responses[currentMsgType] = {
            rationale: data.rationale,
            code: data.code || null,
            summary: data.summary || summary_em,
            rationale: data.rationale || null,
            reflection: data.reflection || null,
            exploration: data.exploration || null,
            advice: data.advice || null,
        };
    }
  } catch (err) {
    const messageToUpdate = messages.value.find(m => m.id === aiMessageId);
    if (messageToUpdate) {
        messageToUpdate.responses[currentMsgType] = {
            rationale: `AI回复异常。请重新请求。`,
        };
    }
  } finally {
    const messageToUpdate = messages.value.find(m => m.id === aiMessageId);
    if (messageToUpdate) messageToUpdate.isLoading = false; // [!code focus] 关闭加载状态
    uiState.isAiResponding = false;
  }
}

// App.vue -> runP5Code function
// App.vue -> <script setup>

// [!code ++] 新增：将所有暂存消息的 versionId 更新为新节点的 ID
function commitTempMessages(newNodeId) {
  if (!hasUnsavedMessages.value) return; // 如果没有暂存消息，则直接返回

  messages.value.forEach(msg => {
    if (msg.versionId === 'temp') {
      msg.versionId = newNodeId;
    }
  });

  // 重置暂存状态
  tempMessageSourceNodeId.value = null;
  console.log(`暂存消息已全部提交至新版本: ${newNodeId}`);
}


// App.vue -> <script setup>

// [!code ++]
async function handleBaselineSave() {
    const currentId = currentNodeId.value;
    const fromNode = nodes.value.find(n => n.id === currentId);
    if (!fromNode) {
        console.error("Cannot save, current node not found.");
        return;
    }

    // 步骤 1: 将当前编辑器的代码和暂存消息，保存到【当前节点】
    if (!savedData[currentId]) {
        savedData[currentId] = {};
    }
    savedData[currentId].code = p5Code.value;
    commitTempMessages(currentId); // 将暂存消息提交到当前节点

    // 步骤 2: 为【新节点】生成位置和版本信息
    const newVersionInfo = generateNewVersion('duplicate', fromNode);
    const { id: newId, x, y, version: newVersion } = newVersionInfo;

    // 步骤 3: 创建【新节点】的视觉元素 (无连线)
    nodes.value.push({
        id: newId,
        x: x,
        y: y,
        version: newVersion,
        parent: null, // 确保没有父节点连接
        color: '#1976d2'
    });

    // 步骤 4: 为【新节点】创建数据，并载入【默认代码】
    savedData[newId] = {
        code: persistence.getDefaultCode(), // 关键：新节点使用默认代码
        image: null,
        description: 'Baseline Mode',
        save_count: 0
    };
    
    // 步骤 5: 将应用的焦点切换到【新节点】
    // (watch(currentNodeId) 会自动更新编辑器中的 p5Code.value)
    currentNodeId.value = newId;

    // 步骤 6: 显示操作成功的提示
    uiState.saveToastMsg = `版本 ${fromNode.version} 已保存, 新建版本 ${newVersion}！`;
    uiState.showSaveToast = true;
    setTimeout(() => uiState.showSaveToast = false, 2200);
}




function runP5Code() {
    const p5iframe = document.querySelector('iframe.p5-canvas');
    if (p5iframe) {
        console.log('App.vue: Reloading iframe to ensure a clean state...');
        
        // 关键步骤 1: 设置一个一次性监听器，等待iframe重新加载完成
        p5iframe.onload = () => {
            console.log('App.vue: Iframe reloaded. Sending new code.');
            if (p5iframe.contentWindow) {
                // 关键步骤 2: 在加载完成后，再发送新的代码
                p5iframe.contentWindow.postMessage({ type: 'P5_CODE', code: p5Code.value }, '*');
                console.log('App.vue: Code sent!');
            }
            // 关键步骤 3: 移除监听器，避免下次非我们主动触发的加载也发送代码
            p5iframe.onload = null; 
        };

        // 关键步骤 4: 触发iframe重新加载其src
        p5iframe.src = p5iframe.src;

    } else {
        console.error('App.vue: Could not find iframe.');
    }
}
// App.vue

async function handleSave(isFinalizationSave = false) {
    // 步骤 1: 捕获 p5.js 画布的快照，此操作对两种保存逻辑都通用
    console.log("123123123")
    const p5iframe = document.querySelector('iframe.p5-canvas');
    let imgData = null;
    if (p5iframe && p5iframe.contentWindow) {
        try {
            const canvas = p5iframe.contentWindow.document.querySelector('canvas');
            if (canvas) imgData = canvas.toDataURL('image/png');
        } catch (e) {
            console.error("无法为保存操作获取画布数据。", e);
        }
    }

    const currentId = currentNodeId.value;
    const fromNode = nodes.value.find(n => n.id === currentId);
    if (!fromNode) {
        console.error("无法保存，未找到当前节点。");
        return;
    }

    // 步骤 2: 初始化或增加当前节点的保存计数器
    if (!savedData[currentId]) {
        savedData[currentId] = {};
    }
    const currentSaveCount = (savedData[currentId].save_count || 0) + 1;
    savedData[currentId].save_count = currentSaveCount;

    // 步骤 3: 根据保存次数决定执行“更新”逻辑还是“复制”逻辑
    if (currentSaveCount <= 1 || isFinalizationSave) { // [!code focus]
        // --- 首次保存逻辑：更新当前节点 ---
        // (此代码块内部逻辑保持不变)
        const existingDescription = savedData[currentId]?.description || '请先保存代码...';
        savedData[currentId] = {
            ...savedData[currentId],
            code: p5Code.value,
            image: imgData,
            description: '生成版本总结中...'
        };
        try {
            const response = await api.addVersionNode({
                session_id: sessionId.value,
                version_id: currentId,
                code: p5Code.value,
                description: (existingDescription !== '请先保存代码...' && existingDescription !== '生成版本总结中...') ? existingDescription : ''
            });
            if (response && response.summary) {
                savedData[currentId].description = response.summary;
            } else {
                savedData[currentId].description = existingDescription;
                throw new Error("API 未返回有效的摘要。");
            }
        } catch (err) {
            console.error("保存版本并获取摘要失败:", err);
            savedData[currentId].description = existingDescription;
            uiState.saveToastMsg = '保存失败，请检查控制台';
        }

    } else {
        // --- 多次保存逻辑：创建新节点副本 ---
        trackingData.actionCounts.duplicate++;
        // 1. 立即在图中生成并显示新节点（UI乐观更新）
        const newVersionInfo = generateNewVersion('duplicate', fromNode);
        const { id: newId, x, y, version: newVersion } = newVersionInfo;
        const autoDuplicateMessage = {
      id: Date.now(),
      sender: 'user',
      text: `从版本 ${fromNode.version} 创建副本，生成新版本 ${newVersion}`,
      versionId: newId, // 关键：将消息关联到新创建的版本节点
    };
    messages.value.push(autoDuplicateMessage);
        if (!trackingData.versionConversations[newId]) {
          trackingData.versionConversations[newId] = [];
        }
        trackingData.versionConversations[newId].push({
          operationName: 'duplicate',
          userPrompt: `Auto-duplicate from version ${fromNode.version} (ID: ${fromNode.id}) on save`,
          mode: 'none',
          aiResponse: 'none',
          timestamp: new Date().toISOString(),
        });
        nodes.value.push({
            id: newId,
            x: x,
            y: y,
            version: newVersion,
            parent: currentId,
            color: '#d32f2f' // 为复制的节点设置一个醒目的颜色
        });
        edges.value.push({ from: currentId, to: newId });
        commitTempMessages(newId);
        // 2. 为新节点设置占位数据
        savedData[newId] = {
            code: p5Code.value,
            image: imgData,
            description: '生成版本总结中...',
            save_count: 0 // 新节点的保存计数器从0开始
        };

        // 3. 将应用的焦点切换到新创建的节点
        isSavingNewVersion.value = true; // <-- 在切换ID前，举起旗帜
        currentNodeId.value = newId;
        nextTick(() => {
            isSavingNewVersion.value = false; // <-- 在DOM更新后，放下旗帜
        });
        // 4. 在后台调用API为新节点生成摘要
        try {
            const response = await api.addVersionNode({
                session_id: sessionId.value,
                version_id: newId, // 关键：使用新节点的ID
                code: p5Code.value,
                description: '摘要生成中...' // 新节点没有前置描述
            });

            // 5. API响应后，更新新节点的描述
            if (response && response.summary) {
                savedData[newId].description = response.summary;
                //uiState.saveToastMsg = `新版本 ${newVersion} 已创建！`;
            } else {
                savedData[newId].description = '获取描述失败，请手动添加。';
                throw new Error("API 未为新节点返回摘要。");
            }
        } catch (err) {
            console.error("为新版本获取摘要失败:", err);
            savedData[newId].description = '获取描述失败，请手动添加。';
            uiState.saveToastMsg = '新版本已创建，但摘要生成失败';
        }
    }

    // 步骤 4: 显示操作结果的Toast提示，此操作对两种逻辑都通用
    uiState.showSaveToast = true;
    setTimeout(() => uiState.showSaveToast = false, 1800);
}
// =================================================================
// =================================================================
// =================================================================



function handleApplyCodeFromAI(codeToApply) {
    if (codeToApply) {
        p5Code.value = codeToApply;
        uiState.saveToastMsg = 'Code applied to editor section';
        uiState.showSaveToast = true;
        setTimeout(() => uiState.showSaveToast = false, 1800);
    }
}


function handleClearCode() {
    const p5iframe = document.querySelector('iframe.p5-canvas');
    if (p5iframe) {
        // 这是一段极简的p5代码，用于覆盖当前画布
        const clearCode = `
            function setup() {
                createCanvas(635, 720);
                background(220); // 绘制一个灰色背景
            }
            function draw() {
                // draw函数为空，所以动画会停止
                noLoop(); // 明确停止绘制循环
            }
        `;

        console.log('App.vue: Reloading iframe to clear canvas...');
        
        // 使用与 runP5Code 相同的安全重载机制
        p5iframe.onload = () => {
            console.log('App.vue: Iframe reloaded. Sending clear code.');
            if (p5iframe.contentWindow) {
                p5iframe.contentWindow.postMessage({ type: 'P5_CODE', code: clearCode }, '*');
                console.log('App.vue: Clear code sent!');
            }
            p5iframe.onload = null; 
        };

        p5iframe.src = p5iframe.src; // 触发iframe重载

    } else {
        console.error('App.vue: Could not find iframe to clear.');
    }
}


function handleWheel(e) {
    e.preventDefault();
    
    // 1. 定义一个灵敏度常量，值越小，缩放越慢
    const ZOOM_SENSITIVITY = 0.05; 

    // 2. 计算缩放量。e.deltaY 是滚动的幅度，我们用它来计算一个小的、成比例的缩放值
    //    乘以 -1 是因为向下滚动 (deltaY 为正) 应该是缩小，向上滚动 (deltaY 为负) 应该是放大
    const scaleAmount = e.deltaY * -ZOOM_SENSITIVITY * 0.01;

    // 3. 将计算出的缩放量应用到当前 scale
    let newScale = graphState.scale + scaleAmount;
    
    // 4. 限制缩放的最大和最小值 (这部分逻辑保持不变)
    graphState.scale = Math.max(0.3, Math.min(3, newScale));
}
function handleMouseDown(e) {
    graphState.dragging = true;
    graphState.lastPos = { x: e.clientX, y: e.clientY };
}

function handleMouseMove(e) {
    if (!graphState.dragging) return;
    graphState.offset.x += (e.clientX - graphState.lastPos.x);
    graphState.offset.y += (e.clientY - graphState.lastPos.y);
    graphState.lastPos = { x: e.clientX, y: e.clientY };
}

function handleMouseUp() {
    graphState.dragging = false;
}

function handleNodeClick(node, event) {
    if (uiState.graphInteractionLocked) { // 只检查交互锁定状态
    return;
  }
    const { id } = node;
    //
    if (hasUnsavedMessages.value && id !== tempMessageSourceNodeId.value) {
    console.warn("操作被阻止：请先保存当前版本的修改，再切换到其他版本。");
    p5EditorRef.value?.flashSaveButton(); // 调用 P5Editor 的方法
    return;
  }

  if (selectedTask.value === 'TaskA: Baseline') {
        currentNodeId.value = id;
        return; // 直接返回，跳过下面的所有选中逻辑
    }
  //
    const isSelected = uiState.selectedNodeIds.includes(id);

    // --- ‼️ 修改点 ---
    // 如果当前在修改模式，则不允许切换节点
    if (isModifying.value) {
        return;
    }

    if (event.shiftKey) {
        if (isSelected) {
            uiState.selectedNodeIds = uiState.selectedNodeIds.filter(nodeId => nodeId !== id);
        } else if (uiState.selectedNodeIds.length < 2) {
            uiState.selectedNodeIds.push(id);
        }
    } else {
        // 如果只点击一个节点，则清除之前的选择，只选中当前节点
        uiState.selectedNodeIds = [id];
    }

    // --- ‼️ 新增逻辑：判断是否进入 merge 模式 ---
   if (uiState.selectedNodeIds.length < 2) {
    uiState.activeMode = null;
 }
    
    currentNodeId.value = id;
}
// App.vue -> <script setup>
function handleShowMergeChat() {
  if (uiState.selectedNodeIds.length === 2) {
    uiState.activeMode = 'merge';
  }
}

// App.vue -> <script setup>

// ‼️ 用下面的版本完整替换现有的 generateNewVersion 函数
function generateNewVersion(type, fromNode1, fromNode2 = null) {
    // --- 合并节点的逻辑 ---
    if (type === 'merge' && fromNode1 && fromNode2) {
    const newX = Math.max(fromNode1.x, fromNode2.x) + 1;
    const idealY = (fromNode1.y + fromNode2.y) / 2; // 首先计算理想的Y坐标 (两个父节点中间)
    let newY = idealY; // 最终Y坐标，默认为理想值

    // 检查理想位置是否已被占用 (使用一个单位的容差来避免视觉重叠)
    const isOccupied = nodes.value.some(n => n.x === newX && Math.abs(n.y - idealY) < 1);

    // 如果理想位置被占用，则执行您的新期望逻辑
    if (isOccupied) {
        // 1. 找到目标列 (newX) 中所有节点的Y坐标范围
        let minYinColumn = Infinity;
        let maxYinColumn = -Infinity;
        
        nodes.value.forEach(node => {
            if (node.x === newX) {
                minYinColumn = Math.min(node.y, minYinColumn);
                maxYinColumn = Math.max(node.y, maxYinColumn);
            }
        });

        // 2. 定义两个备选位置：最上方 (现有最顶节点之上) 和最下方 (现有最底节点之下)
        const topAlternative = minYinColumn - 1;
        const bottomAlternative = maxYinColumn + 1;

        // 3. 决策：计算理想位置到这两个备选位置的距离，选择更近的那个
        if (Math.abs(idealY - topAlternative) <= Math.abs(bottomAlternative - idealY)) {
            newY = topAlternative; // 去最上方更近 (或距离相等)
        } else {
            newY = bottomAlternative; // 去最下方更近
        }
    }

    const newId = `merge-${newX}-${newY.toFixed(2)}`; // 使用toFixed避免ID过长
    // 【核心命名逻辑】保持不变
    const newMajorVersion = maxBranchNumber.value + 1;
    const newVersion = `${newMajorVersion}.0`;
    maxBranchNumber.value = newMajorVersion; 
    return { version: newVersion, id: newId, x: newX, y: newY };
}

    // --- 'duplicate' 和 'modify' 的逻辑 ---
    if ((type === 'duplicate' || type === 'modify') && fromNode1) {
        const fromNode = fromNode1;

        // 判断当前节点是否已有后继者（从而判断本次操作是创建分支还是线性延伸）
        const hasSuccessor = edges.value.some(edge => {
            if (edge.from !== fromNode.id) {
                return false; 
            }
            const toNode = nodes.value.find(n => n.id === edge.to);
            if (!toNode) return false;
            
            // 【关键逻辑优化】一个节点如果是合并节点（有多个输入边），则它不被视为一个“线性”的后继者
            const isMergeNode = edges.value.filter(e => e.to === toNode.id).length > 1;
            return !isMergeNode;
        });

        let newX, newY, newDisplayVersion;

        if (hasSuccessor) {
            // --- 分支逻辑 ---
            newX = fromNode.x + 1; // 在父节点右侧创建
            // 寻找一个可用的Y坐标
            let maxYinColumn = -Infinity;
            nodes.value.forEach(node => {
                if (node.x === newX) maxYinColumn = Math.max(node.y, maxYinColumn);
            });
            newY = (maxYinColumn === -Infinity) ? fromNode.y + 1 : maxYinColumn + 1;
            while(nodes.value.some(n => n.x === newX && Math.abs(n.y - newY) < 1)) {
        newY += 1; // 如果位置被占，就继续向下移动一个单位
    }
            // 【核心命名逻辑】创建新分支，使用全局计数器生成主版本号
            const newMajorVersion = maxBranchNumber.value + 1;
newDisplayVersion = `${newMajorVersion}.0`;
maxBranchNumber.value = newMajorVersion;

        } else {
            // --- 线性逻辑 ---
            newX = fromNode.x + 1;
            newY = fromNode.y;
            
            // 【核心命名逻辑】保持当前主版本号，只增加次版本号，符合用户预期
            const [parentMajor, parentMinor] = fromNode.version.split('.').map(Number);
            newDisplayVersion = `${parentMajor}.${(parentMinor || 0) + 1}`;
        }

        const newInternalId = `${newX}-${newY}`;
        return { version: newDisplayVersion, id: newInternalId, x: newX, y: newY };
    }

    // Fallback，正常情况下不应执行
    console.error("generateNewVersion called with invalid arguments", { type, fromNode1, fromNode2 });
    return null; 
}

function confirmClearSession() {
  console.log("Clearing session and reloading...");
  // 如果计时器正在运行，先强制停止并移除监听器
  if (timerState.isActive) {
    timerState.isActive = false;
    manageEventListeners('remove');
  }
  // 调用持久化工具中的清除函数
  persistence.clearSessionStorage();
  // 重新加载页面，应用将恢复到初始状态
  window.location.reload();
}

function handleUpdateDescription({ id, text }) {
    if (!savedData[id]) {
      savedData[id] = {};
    }
    // ‼️【修改点】: reflection -> summary
    savedData[id].description = text; 
}
/** 
function searchSimilarExamples(currentCode) {
    if (!currentCode) return [];
    const codeText = currentCode.toLowerCase();
    const keywords = [];
    if (codeText.includes('ellipse')) keywords.push('shapes', 'geometric');
    if (codeText.includes('line')) keywords.push('lines', 'drawing');
    if (codeText.includes('mouse')) keywords.push('interactive', 'mouse');
    if (codeText.includes('noise')) keywords.push('noise', 'patterns');
    if (codeText.includes('sin') || codeText.includes('cos')) keywords.push('waves', 'animation');

    return drawingReferenceLibrary
        .map(example => {
            let score = 0;
            example.tags.forEach(tag => {
                if (keywords.includes(tag)) score += 2;
            });
            return { ...example, score };
        })
        .filter(ex => ex.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}
*/
async function handleAddVersion(type, node) {
  if (type === 'duplicate' && hasUnsavedMessages.value) {
    trackingData.actionCounts.duplicate++; 
    console.warn("操作被阻止：请先保存当前版本的修改，再创建副本。");
    p5EditorRef.value?.flashSaveButton();
    return;
  }
  if (type === 'duplicate') {
    trackingData.actionCounts.duplicate++; 
    const newVersionInfo = generateNewVersion(type, node);

    const duplicateMessage = {
    id: Date.now(), // 使用时间戳确保ID唯一
    sender: 'user', // 可以设为 'user' 或其他你定义过的角色
    text: `从版本 ${node.version} 创建副本，新版本为 ${newVersionInfo.version}`, // 你想要显示的消息内容
    versionId: newVersionInfo.id, // 关键：将消息关联到新创建的版本节点
  };
  messages.value.push(duplicateMessage);



    const versionId = newVersionInfo.id;
    if (!trackingData.versionConversations[versionId]) {
      trackingData.versionConversations[versionId] = [];
    }
    trackingData.versionConversations[versionId].push({
      operationName: 'duplicate',
      userPrompt: `Duplicate from version ${node.version} (ID: ${node.id})`,
      mode: 'none',
      aiResponse: 'none',
      timestamp: new Date().toISOString(),
    });
    handleConfirmAddVersion({ type, fromNode: node, versionInfo: newVersionInfo });
    return;
  }

  if (type === 'modify') {
    trackingData.actionCounts.modify++; 
     uiState.graphInteractionLocked = true; // 锁
    // --- ‼️ 这是新的 Modify 流程 ---
    console.log("Starting new modify flow for node:", node.id);
    const description = savedData[node.id]?.description;
    if (!description || description === '请先保存代码...') {
      alert("无法开始修改：请先为该版本保存并生成描述。");
      uiState.graphInteractionLocked = false; 
      return;
    }

    uiState.isAiResponding = true; // 开始加载
    uiState.activeMode = 'modify';
    uiState.modifyingNode = node;
    uiState.selectedNodeIds = [node.id]; // 同时选中该节点
    currentNodeId.value = node.id; // 切换到该节点

    try {
      // ‼️【修改点】调用新的API方法，它现在返回 [{tag, image}, ...]
      // 假设您的 api.js 中有 recommendModificationStyles 方法
      const styles = await api.getModifyStyleTags ();
      // 将整个对象数组存入 state
      uiState.modifyStyleTags = styles; 
    } catch (err) {
      console.error("Failed to get modify style recommendations:", err);
      // 出错时重置状态
      handleCancelOperation(); // 使用取消函数来重置状态
    } finally {
      uiState.isAiResponding = false; // 结束加载
    }
  }
}



// App.vue -> <script setup>
// ‼️ 这是一个核心函数，用于重置所有操作模式的状态
function handleCancelOperation() {
    console.log("Cancelling operation, resetting state.");
    uiState.activeMode = null;
    uiState.modifyingNode = null;
    uiState.modifyStyleTags = [];
    uiState.selectedNodeIds = [];
    uiState.operationInputText = "";
    uiState.graphInteractionLocked = false; // 确保图交互解锁
}
// App.vue -> <script setup>


// App.vue -> <script setup>

async function handleApplyStyle(payload) {
    const { tag, text, type } = payload;

    // 分支 B: 文本输入，执行常规聊天 (逻辑不变)
    if (!tag && text) {
        uiState.inputText = text;
        await chatWithAI();
        handleCancelOperation();
        return;
    }

    // 分支 A: 标签选择，执行“修改风格”流程
    if (tag) {
        if (!isModifying.value || uiState.isAiResponding) return;
        const fromNode = uiState.modifyingNode;

        // --- 步骤 1: 乐观更新UI ---
        // 立即生成新版本信息，并在图中创建占位节点
        const newVersionInfo = generateNewVersion('modify', fromNode);
        nodes.value.push({
            id: newVersionInfo.id,
            x: newVersionInfo.x,
            y: newVersionInfo.y,
            version: newVersionInfo.version,
            parent: fromNode.id,
            color: '#FFB937', // modify 节点的颜色
        });
        edges.value.push({ from: fromNode.id, to: newVersionInfo.id });
         commitTempMessages(newVersionInfo.id);
        // 为新节点设置占位数据，并立即切换焦点
        savedData[newVersionInfo.id] = {
            code: `// Applying style "${tag}"...\nPlease wait.`,
            image: null,
            description: 'AI 正在应用新风格，请稍候...',
        };
        currentNodeId.value = newVersionInfo.id;
        
        // --- 步骤 2: 准备并发送后端请求 ---
        const userApplyStyleMessage = {
            id: Date.now() - 1,
            sender: 'user',
            text: `用户选择 "${tag}" 进行迭代`,
            versionId: newVersionInfo.id, // 关联到新节点
        };
        messages.value.push(userApplyStyleMessage);
        
        uiState.isAiResponding = true;
        const loadingMessageId = Date.now() + '_modify';
        messages.value.push({
            id: loadingMessageId,
            sender: 'ai',
            isLoading: true,
            userQuery: `修改风格: ${tag}`,
            versionId: newVersionInfo.id,
            currentType: type,
            responses: {},
        });

        const requestData = {
            code: savedData[fromNode.id]?.code || p5Code.value, // 使用源节点的代码
            style_tag: tag,
            mode: type
        };
        console.log("Sending apply style request:", requestData);

        try {
            // --- 步骤 3: 处理后端响应 ---
            const result = await api.applyModificationStyle(requestData);
            const versionId = newVersionInfo.id;
            if (!trackingData.versionConversations[versionId]) {
              trackingData.versionConversations[versionId] = [];
            }
            trackingData.versionConversations[versionId].push({
              operationName: 'modify', 
              userPrompt: `Applied style: ${payload.tag}`,
              aiResponse: result,
              timestamp: new Date().toISOString(), 
              mode: payload.type
            });
            // 成功后，更新占位节点的数据
            p5Code.value = result.code;
            savedData[newVersionInfo.id].code = result.code;
            savedData[newVersionInfo.id].description = '请先保存代码...'; // 重置描述，待 handleSave 生成
            
            // 更新聊天消息
            const rationaleMessage = {
                id: loadingMessageId, // 重用ID替换加载动画
                sender: 'ai',
                userQuery: `修改风格: ${tag}`,
                responses: {
                    [type]: {
                        rationale: result.rationale,
                        code: result.code,
                        summary: '根据灵感标签modify后生成的如下：',
                        advice: null,
                        exploration: null,
                        reflection: result.reflection,
                    }
                },
                currentType: type,
                isLoading: false,
                versionId: newVersionInfo.id,
                originalRequestData: null,
            };
            const loadingMsgIndex = messages.value.findIndex(m => m.id === loadingMessageId);
            if (loadingMsgIndex !== -1) {
                messages.value.splice(loadingMsgIndex, 1, rationaleMessage);
            }
            
            // 自动运行并保存
            runP5Code();
            setTimeout(() => handleSave(true), 500);

        } catch (error) {
            console.error("Modification failed:", error);
            // --- 步骤 4: 失败回滚 ---
            // 移除占位节点
            nodes.value = nodes.value.filter(n => n.id !== newVersionInfo.id);
            edges.value = edges.value.filter(e => e.to !== newVersionInfo.id);
            delete savedData[newVersionInfo.id];
            
            // 切换回源节点
            currentNodeId.value = fromNode.id;

            // 更新聊天错误信息
            const errorMsg = {
                 id: loadingMessageId,
                 sender: 'ai',
                 responses: { 'general': { rationale: `抱歉网络错误，请重新生成` } },
                 currentType: 'general',
                 isLoading: false,
                 versionId: fromNode.id,
            };
            const loadingMsgIndex = messages.value.findIndex(m => m.id === loadingMessageId);
            if (loadingMsgIndex !== -1) {
                messages.value.splice(loadingMsgIndex, 1, errorMsg);
            }
        } finally {
            // --- 步骤 5: 清理状态 ---
            handleCancelOperation(); // 这个函数会重置模式和选择等
            uiState.isAiResponding = false;
        }
    }
}


async function handleConfirmAddVersion({ type, fromNode, versionInfo, recommendation }) {
    const finalType = type || uiState.addType;
    const finalFromNode = fromNode || uiState.addFromNode;
    const finalVersionInfo = versionInfo || uiState.pendingVersionInfo;
    const finalRecommendation = recommendation || uiState.selectedRecommendation;

    if (!finalVersionInfo || !finalFromNode) return;

    const { version: newVersion, id: newId, x, y } = finalVersionInfo;
    let color = '#1976d2';
    if (finalType === 'duplicate') color = '#d32f2f';
    if (finalType === 'modify') color = '#FFB937';
    if (finalType === 'merge') color = '#9400D3';

    nodes.value.push({ id: newId, x, y, version: newVersion, parent: finalFromNode.id, color });
    edges.value.push({ from: finalFromNode.id, to: newId });

    let newCode = savedData[finalFromNode.id]?.code || '';
    if (finalType === 'modify' && finalRecommendation) {
        newCode = finalRecommendation.code;
    }
    
    savedData[newId] = { 
        code: newCode, 
        image: null, 
        description: '请先保存代码...' // 设置初始占位符
    };
    currentNodeId.value = newId;
    currentNodeId.value = newId;

   
    
    handleCloseAddVersionModal();
}

function handleCloseAddVersionModal() {
    uiState.showAddVersionModal = false;
    uiState.modifyRecommendations = [];
    uiState.selectedRecommendation = null;
    uiState.pendingVersionInfo = null;
    uiState.selectedNodeIds = [];
}

async function handleDeleteVersion(nodeToDelete) {
  const deletedVersionString = nodeToDelete.version.startsWith('M-') ? nodeToDelete.version.substring(2) : nodeToDelete.version;
const deletedMajorVersion = parseInt(deletedVersionString.split('.')[0], 10) || 0;
    trackingData.actionCounts.delete++;
    if (nodes.value.length <= 1) {
        alert("Cannot delete the last remaining node.");
        return;
    }

    try {
        api.deleteVersionNode({
            session_id: sessionId.value,
            version_id: nodeToDelete.id,
        });
    } catch (err) {
       // console.error("Failed to sync deletion with backend:", err);
    }

    nodes.value = nodes.value.filter(n => n.id !== nodeToDelete.id);
    edges.value = edges.value.filter(e => e.from !== nodeToDelete.id && e.to !== nodeToDelete.id);
    
    delete savedData[nodeToDelete.id];
    // ▼▼▼ 在这里添加 ▼▼▼
// 核心逻辑：如果我们删除了持有最大版本号的节点，就需要重新扫描以找到新的最大值
if (deletedMajorVersion === maxBranchNumber.value) {
    if (nodes.value.length > 0) {
        const allMajors = nodes.value.map(n => {
            const versionString = n.version.startsWith('M-') ? n.version.substring(2) : n.version;
            return parseInt(versionString.split('.')[0], 10) || 0;
        });
        maxBranchNumber.value = Math.max(...allMajors, 0);
    } else {
        // 如果所有节点都被删除了，将最大版本号重置为0
        maxBranchNumber.value = 0;
    }
}
// ▲▲▲ 添加结束 ▲▲▲
    if (currentNodeId.value === nodeToDelete.id) {
        const parentNode = nodes.value.find(n => n.id === nodeToDelete.parent);
        currentNodeId.value = parentNode ? parentNode.id : (nodes.value[0]?.id || null);
    }
    
    uiState.selectedNodeIds = [];
}



async function handleMerge(payload) {
    trackingData.actionCounts.merge++; 
    if (!isMerging.value || uiState.isAiResponding) return;

    const node1 = selectedNodes.value[0];
    const node2 = selectedNodes.value[1];

    // --- 步骤 1: 乐观更新UI ---
    // 立即在前端生成新节点的ID和版本信息
    const newVersionInfo = generateNewVersion('merge', node1, node2);
    
    // 立即在图中创建占位节点和边
    nodes.value.push({
        id: newVersionInfo.id,
        x: newVersionInfo.x,
        y: newVersionInfo.y,
        version: newVersionInfo.version,
        parent: null,
        color: '#9400D3', // 合并节点的专属颜色
    });
    edges.value.push({ from: node1.id, to: newVersionInfo.id });
    edges.value.push({ from: node2.id, to: newVersionInfo.id });
    commitTempMessages(newVersionInfo.id);
    // 立即为新节点创建占位数据，并切换当前版本
    savedData[newVersionInfo.id] = {
        code: `// Merging V${node1.version} and V${node2.version}...\nPlease wait.`,
        image: null,
        description: 'AI 正在合并中，请稍候...',
    };
    currentNodeId.value = newVersionInfo.id; // 立即切换焦点

    // --- 步骤 2: 准备并发送后端请求 ---
    const userMergeMessage = {
        id: Date.now() - 1,
        sender: 'user',
        text: `我要Merge V${node1.version} 和 V${node2.version}`,
        versionId: newVersionInfo.id, // 关联到新创建的占位节点
    };
    messages.value.push(userMergeMessage);

    uiState.isAiResponding = true;
    const loadingToastId = Date.now();
    messages.value.push({
        id: loadingToastId,
        sender: 'ai',
        isLoading: true,
        versionId: newVersionInfo.id, // 同样关联到新节点
        currentType: payload.mode,
        responses: {},
    });

    const requestData = {
        session_id: sessionId.value,
        version_id_1: node1.id,
        code_1: savedData[node1.id]?.code || '',
        description_1: savedData[node1.id]?.description || '无描述',
        version_id_2: node2.id,
        code_2: savedData[node2.id]?.code || '',
        description_2: savedData[node2.id]?.description || '无描述',
        instruction: payload.instruction,
        mode : payload.mode
    };

    console.log("正在发送合并请求:", requestData);

    try {
        // --- 步骤 3: 处理后端响应 ---
        const mergeResult = await api.postMergeRequest(requestData);
        const versionId = newVersionInfo.id;
        if (!trackingData.versionConversations[versionId]) {
          trackingData.versionConversations[versionId] = [];
        }
        trackingData.versionConversations[versionId].push({
          mode: payload.mode,
          userPrompt: `Merge ${node1.id} and ${node2.id}`,
          aiResponse: mergeResult,
          timestamp: new Date().toISOString(),
          operationName: 'merge',
        });
        // 成功后，用真实数据更新占位节点和聊天记录
        p5Code.value = mergeResult.code;
        
        savedData[newVersionInfo.id].code = mergeResult.code;
        savedData[newVersionInfo.id].description = '请先保存代码...'; // 准备让 handleSave 生成新描述
        
        const rationaleMessage = {
            id: Date.now(),
            sender: 'ai',
            userQuery: `合并指令: ${payload.instruction}`,
            responses: {
                [payload.mode]: {
                    rationale: mergeResult.rationale,
                    code: mergeResult.code,
                    summary: null,
                    advice: null,
                    exploration: null,
                    reflection: mergeResult.reflection,
                }
            },
            currentType: payload.mode,
            isLoading: false,
            versionId: newVersionInfo.id,
            originalRequestData: null,
        };
        const loadingMsgIndex = messages.value.findIndex(m => m.id === loadingToastId);
        if (loadingMsgIndex !== -1) {
            messages.value.splice(loadingMsgIndex, 1, rationaleMessage);
        } else {
            messages.value.push(rationaleMessage);
        }
        
        // 自动运行并保存新代码
        runP5Code();
        setTimeout(() => handleSave(true), 1000);

    } catch (error) {
        console.error("合并失败:", error);
        
        // --- 步骤 4: 失败回滚 ---
        // 如果API失败，从图中移除之前乐观创建的占位节点
        nodes.value = nodes.value.filter(n => n.id !== newVersionInfo.id);
        edges.value = edges.value.filter(e => e.to !== newVersionInfo.id);
        delete savedData[newVersionInfo.id];
        
        // 恢复到之前的某个节点
        currentNodeId.value = node1.id;

        // 更新聊天窗口的错误信息
        const errorMsg = {
             id: loadingToastId, // 重用ID以替换加载动画
             sender: 'ai',
             responses: { 'general': { rationale: `抱歉，合并操作失败了。请重新生成。` } },
             currentType: 'general',
             isLoading: false,
             versionId: node1.id, // 关联回源节点
        };
        const loadingMsgIndex = messages.value.findIndex(m => m.id === loadingToastId);
        if (loadingMsgIndex !== -1) {
            messages.value.splice(loadingMsgIndex, 1, errorMsg);
        }
    } finally {
        // --- 步骤 5: 清理状态 ---
        uiState.selectedNodeIds = [];
        uiState.operationInputText = "";
        uiState.isAiResponding = false;
    }
}

// Modal and UI Functions
function handleShowReflectionBox() {
    description.value = savedData[currentNodeId.value]?.reflection || '';
    uiState.reflectionSaved = false;
    uiState.showReflectionBox = true;
}

function handleReflectionSubmit() {
    if (!description.value.trim()) {
        uiState.reflectionError = '反思内容不能为空';
        return;
    }
    
    if (!savedData[currentNodeId.value]) {
      savedData[currentNodeId.value] = {};
    }
    savedData[currentNodeId.value].reflection = description.value;

    uiState.reflectionSaved = true;
    uiState.reflectionError = '';
}

function handleCopyReflection() {
    navigator.clipboard.writeText(description.value);
}

</script>

<style>
/* Styles are identical to the original file and have been omitted for brevity */
/* --- Global Styles & Layout --- */
html, body {
  margin: 0;
  padding: 0;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.App {
  text-align: center;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  position: relative;
}

.new-layout-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 20px;
}

.top-section {
  
  min-height: 100px;
  display: flex;
}

.bottom-section {
  flex: 1;
  display: flex;
  gap: 8px;
  min-height: 0;
}

.chat-column {
  flex: 1;
  display: flex;
  min-width: 0;
}

.p5-editor-column {
  flex: 2;
  min-width: 0;
  display: flex;
}

/* --- Component Containers --- */
.version-graph-container {
  width: 100%;
  height: 100% !important;
}

.chat-column .chat-section {
  width: 100%;
  height: 100%;
}

.p5-editor-column .p5-section {
  width: 100%;
  height: 100%;
}

/* --- Modals & Toasts --- */
/* 在这个区域或文件末尾添加 */

/* ‼️ 新增: 用于退出模式的背景遮罩层样式 */
.mode-backdrop {
  position: fixed; /* 固定定位，覆盖整个视口 */
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.05); /* 轻微的暗色，给予视觉反馈 */
  z-index: 1999; /* ‼️ 关键: 这个值必须低于 MergeChatBox (z-index: 2000)，但高于页面其他内容 */
  cursor: pointer;
}

/* --- Floating Chat Inputs (Shared Styles) --- */
.floating-chat-input {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 8px 12px;
  width: 90vw;
  max-width: 900px;
}
.floating-chat-input input[type="text"] {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  padding: 0 12px;
  height: 100%;
  box-sizing: border-box;
}

/* --- P5 Editor & Output --- */
.p5-container {
  display: flex;
  gap: 20px;
  height: 100%;
}
.p5-code-editor, .p5-output {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 10px;
  overflow: hidden;
}
.code-header, .output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: #e9ecef;
  color: #222;
  font-weight: 600;
  border-bottom: 1px solid #e9ecef;
  border-radius: 10px 10px 0 0;
  height: 48px;
  flex-shrink: 0;
}
.panel-item .timer-button {
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid #007bff;
  background-color: #fff;
  color: #007bff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.panel-item .timer-button:hover {
  background-color: #f0f8ff;
}

.panel-item .timer-button.active {
  background-color: #dc3545;
  color: #fff;
  border-color: #dc3545;
}

.panel-item .clear-button {
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid #dc3545;
  background-color: transparent;
  color: #721c24;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;


}

.panel-item .clear-button:hover {
  background-color: transparent;
  color: #fff;
}

/* 确认模态框样式 */
.confirmation-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6000; /* 比其他模态框层级更高 */
}

.confirmation-modal-content {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 24px 32px;
  width: 90%;
  max-width: 420px;
  text-align: center;
}

.confirmation-modal-content h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #333;
}

.confirmation-modal-content p {
  font-size: 15px;
  color: #666;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.confirmation-modal-actions {
  display: flex;
  gap: 12px;
}

.confirmation-modal-actions button {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.confirmation-modal-actions .cancel-button {
  background: #e9ecef;
  color: #495057;
}
.confirmation-modal-actions .cancel-button:hover {
  background: #dee2e6;
}

.confirmation-modal-actions .confirm-button {
  background: #dc3545;
  color: #fff;
}
.confirmation-modal-actions .confirm-button:hover {
  background: #c82333;
}
/* ‼️ 新增代码结束 */
.panel-item .timer-button.active:hover {
  background-color: #c82333;
}
.run-button, .save-button {
  padding: 8px;
  width: 38px;
  height: 38px;
  background: #007bff;
  color: #fff;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.run-button:hover, .save-button:hover {
  background: #0056b3;
}
.code-textarea {
  flex: 1;
  background: white;
  border: none;
  outline: none;
  padding: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  resize: none;
}
.p5-canvas {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: white;
}

/* --- Modals & Toasts --- */
.save-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%,-50%);
    z-index: 9999;
    background: #222;
    color: #fff;
    padding: 18px 38px;
    border-radius: 24px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    font-size: 18px;
    font-weight: 500;
}
.reflection-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5000;
}
.reflection-modal-content {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    padding: 32px;
    min-width: 400px;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.reflection-modal-content h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 20px 0;
}
.reflection-modal-content textarea {
    width: 100%;
    min-height: 150px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #ccc;
    margin-bottom: 15px;
    font-size: 15px;
    resize: vertical;
}
.reflection-modal-content .error-text {
    color: #d32f2f;
    font-size: 14px;
    margin-bottom: 10px;
}
.reflection-modal-content button {
    width: 100%;
    background: #1976d2;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px 0;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}
.reflection-modal-content button:hover {
    background: #0056b3;
}
.reflection-display {
    width: 100%;
    min-height: 80px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    padding: 12px;
    font-size: 15px;
    white-space: pre-wrap;
    user-select: text;
    margin-bottom: 15px;
    position: relative;
}
.reflection-display button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: auto;
    background: #e0e0e0;
    color: #333;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 13px;
}

/* --- Responsive Design --- */
@media (max-width: 768px) {
  .bottom-section {
    flex-direction: column;
  }
  .p5-container {
    flex-direction: column;
  }
  .floating-chat-input {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 20px;
    max-width: 95vw;
  }
  .floating-chat-input > * {
      width: 100%;
  }
}


/* --- 右上角控制面板的样式 --- */
.top-right-panel {
  position: absolute;
  top: 0px;
  left:10px;
  z-index: 1000; /* 确保在顶层 */
  display: flex;
  gap: 10px;
  background-color: #ffffff;
  padding: 6px 6px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
}

.panel-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.panel-item label {
  font-weight: 500;
  font-size: 10px;
  color: #333;
}

.panel-item input, .panel-item select {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 10px;
}

.panel-item input:focus, .panel-item select:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

/* --- VersionGraph 隐藏时的占位符样式 --- */
.graph-placeholder {
  width: 100%;
  height: 0%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  background-color: #f0f0f0;
  border-radius: 10px;
  font-size: 16px;
}
.top-left-actions {
  position: absolute;
  top: 0px;
  right: 40px; /* 关键：定位到右上角 */
  z-index: 1000;
  display: flex;
  background-color: #ffffff;
  padding: 6px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
}
/* App.vue */
.top-section {
  /* 核心: 添加过渡动画 */
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden; /* 隐藏溢出内容，确保动画流畅 */
  min-height: 100px;
  display: flex;
}

/* 当非反思模式时，top-section 的样式 */
.top-section:not(.reflection-mode-active) {
  min-height: 0;
  height: 0;
  /* 在折叠时移除内外边距和边框，使布局更紧凑 */
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
  border: none;
}
</style>