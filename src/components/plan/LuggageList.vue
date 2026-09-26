<script setup>
import { computed, ref } from 'vue'
import { useTravelStore } from '../../stores/travel'
import { LUGGAGE_CATEGORIES } from '../../constants'
import {
  itemPackedCount,
  itemQuantity,
  luggageCompletionRate,
} from '../../services/luggage'
import ProgressBar from '../common/ProgressBar.vue'

const props = defineProps({
  planId: { type: String, required: true },
  memberId: { type: String, required: true },
  memberName: { type: String, required: true },
})

const store = useTravelStore()

const plan = computed(() => store.planById(props.planId))
const list = computed(
  () => plan.value?.luggage.find((l) => l.memberId === props.memberId) || { items: [] }
)

const grouped = computed(() =>
  LUGGAGE_CATEGORIES.map((cat) => ({
    cat,
    items: (list.value.items || []).filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0)
)

// 完成率与件数统计均基于响应式数据，修改数量或件数后自动重算
const rate = computed(() => luggageCompletionRate(list.value.items))
const totals = computed(() => {
  const items = list.value.items || []
  return {
    packed: items.reduce((sum, i) => sum + itemPackedCount(i), 0),
    total: items.reduce((sum, i) => sum + itemQuantity(i), 0),
  }
})

const isFullyPacked = (item) => itemPackedCount(item) >= itemQuantity(item)
const isPartiallyPacked = (item) => {
  const count = itemPackedCount(item)
  return count > 0 && count < itemQuantity(item)
}

const showAdd = ref(false)
const newName = ref('')
const newCategory = ref(LUGGAGE_CATEGORIES[0])
const newQuantity = ref(1)

function addCustom() {
  const name = newName.value.trim()
  if (!name) return
  store.addCustomItem(props.planId, props.memberId, name, newCategory.value, newQuantity.value)
  newName.value = ''
  newQuantity.value = 1
  showAdd.value = false
}

function onQuantityInput(item, event) {
  store.setQuantity(props.planId, props.memberId, item.id, event.target.value)
}
</script>

<template>
  <div class="luggage-list">
    <div class="luggage-head">
      <strong>{{ memberName }}</strong>
      <span class="head-side">
        <span class="pieces text-muted">已装 {{ totals.packed }}/{{ totals.total }} 件</span>
        <span class="tag" :class="rate === 100 ? 'tag-green' : 'tag-blue'">{{ rate }}%</span>
      </span>
    </div>

    <ProgressBar :value="rate" :show-label="false" />

    <div class="groups">
      <div v-for="group in grouped" :key="group.cat" class="group">
        <div class="group-title">{{ group.cat }}</div>
        <ul class="item-list">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="item"
            :class="{ packed: isFullyPacked(item) }"
          >
            <label class="item-label">
              <input
                type="checkbox"
                :checked="isFullyPacked(item)"
                :indeterminate="isPartiallyPacked(item)"
                @change="store.togglePack(planId, memberId, item.id)"
              />
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.custom" class="item-custom">自定义</span>
            </label>
            <div class="item-controls">
              <span class="stepper" title="已打包件数">
                <button
                  type="button"
                  class="step-btn"
                  :disabled="itemPackedCount(item) <= 0"
                  @click="store.setPackedCount(planId, memberId, item.id, itemPackedCount(item) - 1)"
                >−</button>
                <span class="step-val">{{ itemPackedCount(item) }}/{{ itemQuantity(item) }}</span>
                <button
                  type="button"
                  class="step-btn"
                  :disabled="itemPackedCount(item) >= itemQuantity(item)"
                  @click="store.setPackedCount(planId, memberId, item.id, itemPackedCount(item) + 1)"
                >+</button>
              </span>
              <label class="qty-edit" title="物品数量">
                ×<input
                  type="number"
                  class="qty-input"
                  min="1"
                  max="999"
                  :value="itemQuantity(item)"
                  @input="onQuantityInput(item, $event)"
                />
              </label>
              <button
                type="button"
                class="item-remove"
                title="移除"
                @click="store.removeItem(planId, memberId, item.id)"
              >×</button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="add-custom">
      <template v-if="showAdd">
        <input v-model="newName" class="input" placeholder="物品名称" @keyup.enter="addCustom" />
        <select v-model="newCategory" class="select">
          <option v-for="c in LUGGAGE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <input
          v-model.number="newQuantity"
          type="number"
          class="input qty-new"
          min="1"
          max="999"
          title="数量"
          placeholder="数量"
        />
        <button type="button" class="btn btn-primary btn-sm" @click="addCustom">添加</button>
        <button type="button" class="btn btn-ghost btn-sm" @click="showAdd = false">取消</button>
      </template>
      <button v-else type="button" class="btn btn-ghost btn-sm" @click="showAdd = true">
        + 添加自定义物品
      </button>
    </div>
  </div>
</template>

<style scoped>
.luggage-list {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.luggage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.head-side {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pieces {
  font-size: 12px;
}

.groups {
  margin-top: 12px;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 12px 0 6px;
}

.item-list {
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 4px;
  border-radius: 6px;
}

.item:hover {
  background: var(--bg);
}

.item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.item-label input {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.item.packed .item-name {
  text-decoration: line-through;
  color: var(--text-muted);
}

.item-custom {
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-light);
  padding: 0 6px;
  border-radius: 4px;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.step-btn {
  border: none;
  background: var(--bg);
  color: var(--text-secondary);
  width: 22px;
  height: 22px;
  font-size: 14px;
  line-height: 1;
  display: grid;
  place-items: center;
}

.step-btn:hover:not(:disabled) {
  background: var(--primary-light);
  color: var(--primary);
}

.step-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.step-val {
  min-width: 36px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.qty-edit {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.qty-input {
  width: 44px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  color: var(--text);
  -moz-appearance: textfield;
  appearance: textfield;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.qty-input:focus {
  border-color: var(--primary);
  outline: none;
}

.item-remove {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  opacity: 0;
  transition: opacity 0.15s;
}

.item:hover .item-remove {
  opacity: 1;
}

.item-remove:hover {
  color: var(--danger);
}

.add-custom {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.add-custom .input {
  flex: 1;
  min-width: 120px;
}

.add-custom .qty-new {
  flex: 0 0 72px;
  min-width: 0;
  width: 72px;
}

.add-custom .select {
  width: auto;
}
</style>
