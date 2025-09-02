<template>
  <!-- wrapper的类名绑定保持不变 -->
  <div class="version-graph-wrapper" :class="{ 'is-expanded': isExpanded }">
    <div
      class="version-graph-container"
      @wheel.prevent="onWheel"
      @mousedown="onContainerMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
    >
      <div class="graph-info-overlay">按住鼠标拖拽，滚轮缩放</div>
      <svg ref="svg" width="100%" height="100%">
        <g :transform="`translate(${props.graphOffset.x},${props.graphOffset.y}) scale(${props.graphScale})`">
          <!-- Edges -->
          <path
            v-for="edge in props.edges"
            :key="'path-' + edge.from + '-' + edge.to"
            :d="generatePathD(edge)"
            class="edge-path"
          />

          <!-- Nodes are now rendered using the computed property that handles the merge-mode offset. -->
          <g v-for="node in processedNodes" :key="node.id" class="node-group" @click="e => onNodeClick(node, e)">
            <!-- Highlight ring -->
            <circle
              v-if="props.selectedNodeIds.includes(node.id) || props.currentNodeId === node.id"
              :cx="node.x * HORIZONTAL_SPACING"
              :cy="node.y * VERTICAL_SPACING"
              :r="props.selectedNodeIds.includes(node.id) ? 23 : 21"
              fill="none"
              :stroke="props.selectedNodeIds.includes(node.id) ? '#0d6efd' : '#77b5fe'"
              :stroke-width="props.selectedNodeIds.includes(node.id) ? 3.5 : 2"
              class="node-highlight"
              :class="{ 'is-current': props.currentNodeId === node.id && !props.selectedNodeIds.includes(node.id) }"
            />
            <!-- Node body -->
            <circle
              :cx="node.x * HORIZONTAL_SPACING"
              :cy="node.y * VERTICAL_SPACING"
              r="10"
              :fill="node.color || '#1976d2'"
              class="node-circle"
            />
            <!-- Version label -->
            <text
              :x="node.x * HORIZONTAL_SPACING + 16"
              :y="node.y * VERTICAL_SPACING + 16"
              :transform="`rotate(45, ${node.x * HORIZONTAL_SPACING + 18}, ${node.y * VERTICAL_SPACING + 18})`"
              class="node-version-label"
            >
              {{ node.version }}
            </text>
          </g>
        </g>
      </svg>
      <div class="expand-handle" @click="toggleExpand" title="展开/收起视图">
          <div v-if="isExpanded">  <img  src="../assets/fold.svg" alt="Click to expand"></img></div>
          <div v-else>  <img  src="../assets/unfold.svg" alt="Click to expand"></img></div>
      </div>
    </div>

    <!-- Popover and Modal sections -->
    <div
      v-for="(node,index) in selectedNodes"
      :key="'popover-' + node.id"
      class="action-popover"
      :style="getPopoverPosition(node)"
      @click.stop
      @mousedown.stop
      :ref="el => { if (el) popoverRefs[index] = el }"
      v-if="!props.isPreviewDisabled"
    >
       <button class="close-popover-btn" @click.stop="emits('clear-selection')">
  &times; <!-- 这是 '×' 乘号的HTML实体，常用于关闭图标 -->
</button>
        <div class="popover-main-content">
            <img v-if="props.savedData[node.id] && props.savedData[node.id].image" :src="props.savedData[node.id].image" alt="版本快照" class="snapshot-image" />
            <div v-else class="snapshot-placeholder">暂无快照(请保存)</div>
            <div  class="action-buttons" v-if="props.selectedNodeIds.length < 2">
                <button class="version-action-btn duplicate" @click="emits('add-version', 'duplicate', node)">
                  <img src="../assets/dup.svg" alt="Click to duplicate"></img>
                  <span>Duplicate</span></button>
                <button class="version-action-btn modify" @click="emits('add-version', 'modify', node)">
                  <img src="../assets/mod.svg" alt="Click to modify"></img>
                  <span>Modify</span></button>
                <button v-if="!hasSuccessor(node.id)" class="version-action-btn delete" @click="emits('delete-version', node)">
                  <img src="../assets/del.svg" alt="Click to delete"></img>
                  <span>Delete</span></button>
            </div>
        </div>
        <div class="popover-description-area">
            <template v-if="editingNodeId === node.id">
                <textarea
                ref="descriptionTextarea"
                v-model="editingText"
                class="description-textarea"
                placeholder="输入描述... (Ctrl+Enter 保存)"
                @blur="saveDescription(node)"
                @keydown.ctrl.enter.prevent="saveDescription(node)"
                @keydown.meta.enter.prevent="saveDescription(node)"
                @keydown.esc.prevent="cancelEdit"
            ></textarea>
            </template>
            <template v-else>
                <div @click="startEditing(node)" class="description-display" title="点击修改描述">
                    <p>
                        <strong>版本描述: </strong>
                        <span v-if="props.savedData[node.id] && props.savedData[node.id].description">{{ props.savedData[node.id].description }}</span>
                        <span v-else class="no-description">请先保存代码...</span>
                    </p>
                </div>
            </template>
        </div>
    </div>
    <button
      v-if="rightmostSelectedNode"
      class="merge-prompt-btn"
      :style="getMergeButtonPosition"
      @click.stop="emits('show-merge-chat')"
    ><img src="../assets/meg.svg" alt="Click to delete"></img>
      <span>Merge</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick ,watch,onUnmounted} from 'vue';

// ‼️ 新增: 定义独立的水平和垂直间距常量
const HORIZONTAL_SPACING = 60; // 从 80 增加到 120，拉大水平间距
const VERTICAL_SPACING = 90;   // 保持原有的垂直间距

const isExpanded = ref(false);

const props = defineProps({
  nodes: Array,
  edges: Array,
  currentNodeId: String,
  savedData: Object,
  dragging: Boolean,
  graphOffset: Object,
  graphScale: Number,
  selectedNodeIds: Array,
  isPreviewDisabled: {
    type: Boolean,
    default: false
  },
});

const emits = defineEmits([
    'wheel', 'mouse-down', 'mouse-move', 'mouse-up', 'mouse-leave', 'node-click', 
    'clear-selection', 'add-version', 'delete-version', 'update-description','update:expanded', 'show-merge-chat','preview-opened',
]);
const popoverRefs = ref([]); 
const editingNodeId = ref(null);
const editingText = ref('');
const svg = ref(null);
const descriptionTextarea = ref([]);

// This computed property will be the source for rendering nodes.
const EXTEND_X_OFFSET = 2; // This value corresponds to an 80px shift in the SVG view (1 * 80).

const processedNodes = computed(() => {
  // Only apply the offset logic when exactly two nodes are selected (merge mode).
  if (props.selectedNodeIds.length !== 2) {
    return props.nodes;
  }

  const [id1, id2] = props.selectedNodeIds;
  const node1 = props.nodes.find(n => n.id === id1);
  const node2 = props.nodes.find(n => n.id === id2);

  if (!node1 || !node2) {
    return props.nodes; // Safeguard, should not happen in normal flow.
  }

  // Determine which node to shift. The one with the larger x-coordinate.
  let nodeToShiftId;
  if (node1.x > node2.x) {
    nodeToShiftId = node1.id;
  } else if (node2.x > node1.x) {
    nodeToShiftId = node2.id;
  } else {
    // Tie-breaker for when x-coordinates are equal: shift the one with the larger y-coordinate.
    nodeToShiftId = node1.y > node2.y ? node1.id : node2.id;
  }
  
  // Return a new array with the modified node position for rendering.
  // This avoids mutating the original props.
  return props.nodes.map(node => {
    if (node.id === nodeToShiftId) {
      return { ...node, x: node.x + EXTEND_X_OFFSET };
    }
    return node;
  });
});


// This ensures the popovers are positioned relative to the visually displayed nodes (which may be offset).
const selectedNodes = computed(() => {
  return props.selectedNodeIds.map(id => {
    // Find the node from the processed list to get the correct display coordinates.
    return processedNodes.value.find(n => n.id === id);
  }).filter(Boolean); // filter(Boolean) removes any undefined results if a node isn't found.
});


function getNodeById(id) {
  // This helper function still correctly pulls from the original `props.nodes`.
  // It's used by `generatePathD` to ensure edges connect to the original, non-offset positions.
  return props.nodes.find(n => n.id === id) || {};
}

// VersionGraph.vue -> <script setup>

// 新增：找到最右侧的选中节点，用于定位Merge按钮
const rightmostSelectedNode = computed(() => {
  if (props.selectedNodeIds.length !== 2) {
    return null;
  }
  // 从 processedNodes (已处理偏移的节点) 中找到对应的节点
  const node1 = processedNodes.value.find(n => n.id === props.selectedNodeIds[0]);
  const node2 = processedNodes.value.find(n => n.id === props.selectedNodeIds[1]);

  if (!node1 || !node2) return null;

  // 比较x坐标，如果相同则比较y坐标
  if (node1.x > node2.x) return node1;
  if (node2.x > node1.x) return node2;
  return node1.y > node2.y ? node1 : node2;
});

const getMergeButtonPosition = computed(() => {
  const node = rightmostSelectedNode.value;
  if (!node || !svg.value) return null;
  
  const popoverWidth = 245; // popover的宽度
  const buttonOffsetX = 10; // 按钮与popover的水平间距

  const popoverStyle = getPopoverPosition(node);
  if (!popoverStyle) return null;

  const popoverTop = parseFloat(popoverStyle.top);
  const leftValue = parseFloat(popoverStyle.left) + popoverWidth + buttonOffsetX;
  
  // 核心修改：计算垂直中心点
  // 弹窗有8px的内边距(padding)，预览图高度为120px。
  // 我们目标是与预览图的中心对齐。
  // 中心点Y = 弹窗顶部位置 + 内边距 + (图片高度 / 2)
  const centerY = popoverTop + 8 + (120 / 2);

  return {
    left: `${leftValue}px`,
    top: `${centerY}px`, // 关键：将top设置为我们计算出的中心点
  };
});

function toggleExpand() {
    isExpanded.value = !isExpanded.value;
}

// Path generation logic remains unchanged. It correctly uses original node data via getNodeById.
function generatePathD(edge) {
    const fromNode = getNodeById(edge.from);
    const toNode = getNodeById(edge.to);
    if (!fromNode.id || !toNode.id) return '';

    // ‼️ 修改: 使用新的间距常量
    const x1 = fromNode.x * HORIZONTAL_SPACING;
    const y1 = fromNode.y * VERTICAL_SPACING;
    const x2 = toNode.x * HORIZONTAL_SPACING;
    const y2 = toNode.y * VERTICAL_SPACING;

    if (y1 === y2) {
        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    
    const mx = x1 + dx * 0.5;
    const my = y1 + dy * 0.5;

    const normal = Math.sqrt(dx * dx + dy * dy);
    if (normal === 0) return `M ${x1},${y1} L ${x2},${y2}`;
    
    let offset = 30; 
    if (dy < 0) offset = -30;

    const n_x = -dy / normal;
    const n_y = dx / normal;
    const cx = mx + n_x * offset;
    const cy = my + n_y * offset;

    return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
}

// Popover position logic now receives nodes from the modified `selectedNodes` computed property.
function getPopoverPosition(node) {
  if (!node || !svg.value) return null;
  const svgRect = svg.value.getBoundingClientRect();
  
  // ‼️ 修改: 使用新的间距常量
  // node.x and node.y will be the potentially offset values, which is correct for popover positioning.
  const nodeX = node.x * HORIZONTAL_SPACING * props.graphScale + props.graphOffset.x;
  const nodeY = node.y * VERTICAL_SPACING * props.graphScale + props.graphOffset.y;
  
  return {
    left: `${svgRect.left + nodeX + 30 * props.graphScale}px`,
    top: `${svgRect.top + nodeY - 100}px`,
  };
}

// Event Handlers
const onWheel = (e) => emits('wheel', e);
const onMouseMove = (e) => emits('mouse-move', e);
const onMouseUp = (e) => emits('mouse-up', e);
const onMouseLeave = (e) => emits('mouse-leave', e);
const onNodeClick = (node, e) => {
    e.stopPropagation();
    // The emitted node object might have modified coordinates, but App.vue primarily uses the `id`,
    // so this is safe and does not affect the main application logic.
    emits('node-click', node, e);
    emits('preview-opened'); 
};
const onContainerMouseDown = (e) => {
    emits('mouse-down', e);
};
function hasSuccessor(nodeId) {
  // props.edges 数组包含了所有的连接关系
  // 如果任何一条边的 'from' 字段等于传入的 nodeId，说明该节点有后继者
  return props.edges.some(edge => edge.from === nodeId);
}
const handleClickOutside = (event) => {
  // 检查点击是否发生在任何一个弹窗内部
  const isClickInsidePopover = popoverRefs.value.some(popover => popover && popover.contains(event.target));
  
  // 检查点击是否发生在一个节点上 (因为点击节点是合法操作，不应立即关闭)
  const isClickInsideNode = event.target.closest('.node-group');

  if (!isClickInsidePopover && !isClickInsideNode) {
    emits('clear-selection');
  }
};
watch(() => props.selectedNodeIds, (newVal, oldVal) => {
  // 当弹窗首次出现时，添加全局监听器
  if (newVal.length > 0 && oldVal.length === 0) {
    document.addEventListener('mousedown', handleClickOutside);
  } 
  // 当弹窗消失时，移除全局监听器
  else if (newVal.length === 0 && oldVal.length > 0) {
    document.removeEventListener('mousedown', handleClickOutside);
  }
}, { flush: 'post' }); // flush: 'post' 确保DOM更新后再执行

// --- ‼️ 新增: 组件卸载时清理监听器，防止内存泄漏 ---
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});


// In-place editing methods
function startEditing(node) {
  editingNodeId.value = node.id;
  editingText.value = props.savedData[node.id]?.description || '';
  nextTick(() => {
    if (descriptionTextarea.value && descriptionTextarea.value[0]) {
      descriptionTextarea.value[0].focus();
    }
  });
}

function saveDescription(node) {
  if (editingNodeId.value === null) return;
  emits('update-description', { id: node.id, text: editingText.value });
  editingNodeId.value = null;
}

function cancelEdit() {
  editingNodeId.value = null;
}
</script>

<style scoped>
/* --- Styles --- */
.version-graph-wrapper {
    width: 100%;
    height: 100%;
    position: relative; 
    padding-bottom: 14px;
    box-sizing: border-box;
}

.version-graph-container {
  background: white;
  border-radius: 14px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  position: relative; 
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 5;
}

.version-graph-wrapper.is-expanded .version-graph-container {
    height: 40vh;
    min-height: 300px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.expand-handle {
    width: 80px;
    height: 16px;
    background-color: #e9ecef;
    border-radius: 0 0 10px 10px;
    position: absolute;
    bottom: -16px;
    left: 50%;
    transform: translateX(-50%);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    z-index: 10; 
}

.expand-handle:hover {
    background-color: #ced4da;
}

.handle-icon {
    width: 24px;
    height: 4px;
    background-color: #868e96;
    border-radius: 2px;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.is-expanded .handle-icon {
    transform: rotate(180deg);
}
.is-expanded .handle-icon::before,
.is-expanded .handle-icon::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 4px;
    background-color: #868e96;
    border-radius: 2px;
    top: 6px;
}
.is-expanded .handle-icon::before {
    transform: translateX(-6px) rotate(45deg);
}
.is-expanded .handle-icon::after {
    transform: translateX(6px) rotate(-45deg);
}

.graph-info-overlay {
  position: absolute;
  top: 12px;
  right: 90px;
  color: #aaa;
  font-size: 13px;
  z-index: 2;
  user-select: none;
  pointer-events: none;
}
svg {
  background: none;
  display: block;
  
}

.edge-path {
  stroke: #ced4da;
  stroke-width: 2px;
  fill: none;
  transition: stroke 0.3s ease;
}

.node-group {
    transition: transform 0.2s ease;
}

.node-circle {
  transition: all 0.2s ease;
  stroke: rgba(0,0,0,0.05);
  stroke-width: 1;
}
.merge-prompt-btn::before {
  content: '';
  position: absolute;
  /* 通过负值向外扩展区域，上下左右各扩展10px */
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  /* 这个伪元素是完全透明的，不影响视觉 */
  background-color: transparent; 
}
.close-popover-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background-color: #e9ecef;
  color: #495057;
  font-size: 18px;
  line-height: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  left:120px;
  z-index: 10; /* 确保在内容之上 */
}

.close-popover-btn:hover {
  background-color: #ced4da;
  transform: rotate(90deg);
}
.node-highlight {
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.node-version-label {
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
    fill: #6c757d;
    pointer-events: none;
    user-select: none;
    font-weight: 600;
}

/* --- Popover Styles Start Here --- */
.action-popover {
  position: fixed;
  z-index: 2500;
  background: transparent;
  border-radius: 12px;
  box-shadow: none;
  padding: 8px; /* 整体内边距，制造呼吸感 */
  width: 245px; /* 稍微加宽以适应新布局 */
  box-sizing: border-box;
  border: none;
  
}

/* ‼️【修改】: 主内容区现在是横向flex布局 */
.popover-main-content {
    display: flex;
    align-items: flex-start;
    gap: 2px; /* 图像和右侧栏之间的间距，实现“紧挨”感 */
}
/* VersionGraph.vue -> <style scoped> */
/* 文件: VersionGraph.vue */
/* 位置: <style scoped> */

/* 用这个版本替换你现有的 .merge-prompt-btn 和 .merge-prompt-btn:hover 样式 */
.merge-prompt-btn {
  position: fixed;
  z-index: 2600;
  justify-content: flex-start;
  width: 100px;
  height: 45px;
  padding: 8px 4px;
   border-radius: 6px;
  border: 1px solid #ced4da;
  font-size: 13px;
  font-weight: 500;
  color: #212529;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease-in-out;
  /* 关键：添加 transform 属性 */
 
  gap: 8px
}

.merge-prompt-btn:hover {
  background-color: #f8f9fa;
  /* 关键：在 hover 状态下保持 transform */
  transform: scale(1.05);
}
.snapshot-image, .snapshot-placeholder {
    width: 140px;
    height: 120px;
    object-fit: cover;
    border-radius: 8px;
    border: none;
    background: #f5f6f8;
    flex-shrink: 0; /* 防止图片被压缩 */
}
.snapshot-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #aaa;
    font-size: 12px;
}

/* ‼️【新增】: 右侧栏的样式 */
.popover-right-column {
    display: flex;
    flex-direction: column;
    gap: 8px; /* 按钮组和描述区之间的间距 */
    flex: 1; /* 占据剩余空间 */
    min-width: 0; /* 防止内容溢出 */
}

.action-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.version-action-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 8px 4px;
  border-radius: 6px;
  border: 1px solid #ced4da;
  font-size: 13px;
  font-weight: 500;
  color: #212529;
  background: #fff;
  width: 80px;
  cursor: pointer;
  transition: background-color 0.18s;
  outline: none;
  gap: 8px;
}

.version-action-btn:hover {
    background-color: #f8f9fa;
}

.popover-description-area {
    padding: 10px;
    background-color: #f1f3f5;
    border-radius: 8px;
}

.description-display {
    cursor: pointer;
    padding: 0;
}

.description-display p {
    margin: 0;
    font-size: 13px;
    color: #212529;
    max-height: 100px;
  
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
}

.description-textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #1976d2;
    border-radius: 6px;
    padding: 8px;
    font-family: inherit;
    font-size: 13px;
    height: 100px;
    resize: vertical;
    outline: none;
    background-color: #fff;
}

.no-description {
    color: #6c757d;
    font-style: italic;
}
</style>
