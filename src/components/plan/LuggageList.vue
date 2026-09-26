<script setup>
import { computed, ref } from 'vue'
import { useTravelStore } from '../../stores/travel'
import { LUGGAGE_CATEGORIES } from '../../constants'
import {
  luggageCompletionRate,
  luggagePieceCounts,
  normalizeQuantity,
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

const rate = computed(() => luggageCompletionRate(list.value.items))
const counts = computed(() => luggagePieceCounts(list.value.items))

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

function changeQuantity(item, delta) {
  store.setItemQuantity(
    props.planId,
    props.memberId,
    item.id,
    normalizeQuantity(item.quantity) + delta
  )
}
</script>

<template>
  <div class="luggage-list">
    <div class="luggage-head">
      <strong>{{ memberName }}</strong>
      <span class="head-right">
        <span class="piece-count text-muted">{{ counts.packed }}/{{ counts.total }} 件</span>
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
            :class="{ packed: item.packed }"
          >
            <label class="item-label">
              <input
                type="checkbox"
                :checked="item.packed"
                @change="store.togglePack(planId, memberId, item.id)"
              />
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.custom" class="item-custom">自定义</span>
            </label>
            <div class="item-side">
              <div class="qty-stepper" title="数量">
                <button
                  type="button"
                  class="qty-btn"
                  :disabled="normalizeQuantity(item.quantity) <= 1"
                  @click="changeQuantity(item, -1)"
                >−</button>
                <span class="qty-value">{{ normalizeQuantity(item.quantity) }}</span>
                <button
                  type="button"
                  class="qty-btn"
                  @click="changeQuantity(item, 1)"
                >+</button>
              </div>
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
        <input v-model="newName" class="input" placeholder="物品名称（可写 袜子×3）" @keyup.enter="addCustom" />
        <input
          v-model.number="newQuantity"
          type="number"
          min="1"
          class="input qty-input"
          title="数量"
          @keyup.enter="addCustom"
        />
        <select v-model="newCategory" class="select">
          <option v-for="c in LUGGAGE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
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

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.piece-count {
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
}

.item-label input {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
}

.item.packed .item-name {
  text-decoration: line-through;
  color: var(--text-muted);
}

.item-side {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty-stepper {
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1px;
}

.qty-btn {
  border: none;
  background: transparent;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1;
  display: grid;
  place-items: center;
}

.qty-btn:hover:not(:disabled) {
  background: var(--primary-light);
  color: var(--primary);
}

.qty-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.qty-value {
  min-width: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.item-custom {
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-light);
  padding: 0 6px;
  border-radius: 4px;
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

.add-custom .qty-input {
  flex: none;
  width: 72px;
}

.add-custom .select {
  width: auto;
}
</style>
