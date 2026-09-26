import { defineStore } from 'pinia'
import { planStorage } from '../services/storage'
import {
  clampItemQuantity,
  generateLuggageTemplate,
  getDestinationType,
  itemPackedCount,
  itemQuantity,
  migratePlans,
} from '../services/luggage'
import { generateDefaultTodos } from '../services/todo'
import { computeAchievements, TOTAL_ACHIEVEMENTS } from '../services/achievements'
import { computeDashboardStats, computeMemberLeaderboard } from '../services/stats'
import { daysBetween } from '../utils/format'
import { uid } from '../utils/id'

// 根据出行人数与可选姓名生成成员列表
function buildMemberNames(input) {
  const count = Math.max(1, Number(input.memberCount) || 1)
  const provided = (input.memberNames || []).map((s) => String(s).trim()).filter(Boolean)
  return Array.from({ length: count }, (_, i) => provided[i] || `成员${i + 1}`)
}

export const useTravelStore = defineStore('travel', {
  state: () => ({
    plans: [],
  }),

  getters: {
    achievements: (state) => computeAchievements(state.plans),
    totalAchievements: () => TOTAL_ACHIEVEMENTS,
    dashboardStats: (state) => computeDashboardStats(state.plans),
    leaderboard: (state) => computeMemberLeaderboard(state.plans),
    planById: (state) => (id) => state.plans.find((p) => p.id === id),
  },

  actions: {
    // ===== 持久化 =====
    load() {
      // 读取后先做行李物品结构迁移（数量字段），有变更则立即落盘
      const { plans, migrated } = migratePlans(planStorage.read([]))
      this.plans = plans
      if (migrated) this.persist()
    },
    persist() {
      planStorage.write(this.plans)
    },

    // ===== 出行计划 =====
    createPlan(input) {
      const days = daysBetween(input.startDate, input.endDate)
      const destinationType = getDestinationType(input.tripType)
      const memberNames = buildMemberNames(input)
      const members = memberNames.map((name) => ({ id: uid(), name }))
      const luggage = members.map((m) => ({
        memberId: m.id,
        items: generateLuggageTemplate({ tripType: input.tripType, days }),
      }))

      const plan = {
        id: uid(),
        name: input.name,
        destination: input.destination,
        destinationType,
        tripType: input.tripType,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        memberCount: members.length,
        transport: input.transport,
        accommodation: input.accommodation,
        budget: Number(input.budget) || 0,
        notes: input.notes,
        photo: input.photo || '',
        members,
        luggage,
        todos: generateDefaultTodos(),
        records: [],
        summary: null,
        createdAt: new Date().toISOString(),
      }
      this.plans.unshift(plan)
      return plan.id
    },

    updatePlan(id, input) {
      const plan = this.planById(id)
      if (!plan) return
      const days = daysBetween(input.startDate, input.endDate)
      Object.assign(plan, {
        name: input.name,
        destination: input.destination,
        destinationType: getDestinationType(input.tripType),
        tripType: input.tripType,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        transport: input.transport,
        accommodation: input.accommodation,
        budget: Number(input.budget) || 0,
        notes: input.notes,
        photo: input.photo || '',
      })
    },

    deletePlan(id) {
      this.plans = this.plans.filter((p) => p.id !== id)
    },

    // ===== 行李清单 =====
    _findLuggageList(plan, memberId) {
      let list = plan.luggage.find((l) => l.memberId === memberId)
      if (!list) {
        list = { memberId, items: [] }
        plan.luggage.push(list)
      }
      return list
    },

    _findLuggageItem(planId, memberId, itemId) {
      const plan = this.planById(planId)
      if (!plan) return null
      const list = plan.luggage.find((l) => l.memberId === memberId)
      return list?.items.find((i) => i.id === itemId) || null
    },

    // 勾选切换：未全部打包则补满，否则清零
    togglePack(planId, memberId, itemId) {
      const target = this._findLuggageItem(planId, memberId, itemId)
      if (!target) return
      const qty = itemQuantity(target)
      target.packedCount = itemPackedCount(target) >= qty ? 0 : qty
    },

    // 逐件调整已打包件数（自动限制在 0 ~ 数量 之间）
    setPackedCount(planId, memberId, itemId, count) {
      const target = this._findLuggageItem(planId, memberId, itemId)
      if (!target) return
      const qty = itemQuantity(target)
      const n = Math.round(Number(count))
      target.packedCount = Math.min(qty, Math.max(Number.isFinite(n) ? n : 0, 0))
    },

    // 修改物品数量；已打包件数超出新数量时同步收敛，完成率随响应式自动重算
    setQuantity(planId, memberId, itemId, quantity) {
      const target = this._findLuggageItem(planId, memberId, itemId)
      if (!target) return
      target.quantity = clampItemQuantity(quantity)
      if ((Math.round(Number(target.packedCount)) || 0) > target.quantity) {
        target.packedCount = target.quantity
      }
    },

    addCustomItem(planId, memberId, name, category, quantity = 1) {
      const plan = this.planById(planId)
      if (!plan) return
      const list = this._findLuggageList(plan, memberId)
      list.items.push({
        id: uid(),
        name,
        category,
        custom: true,
        quantity: clampItemQuantity(quantity),
        packedCount: 0,
      })
    },

    removeItem(planId, memberId, itemId) {
      const plan = this.planById(planId)
      if (!plan) return
      const list = plan.luggage.find((l) => l.memberId === memberId)
      if (!list) return
      list.items = list.items.filter((i) => i.id !== itemId)
    },

    // ===== 待办清单 =====
    toggleTodo(planId, todoId) {
      const plan = this.planById(planId)
      const todo = plan?.todos.find((t) => t.id === todoId)
      if (todo) todo.done = !todo.done
    },

    addTodo(planId, name) {
      const plan = this.planById(planId)
      if (plan) plan.todos.push({ id: uid(), name, done: false })
    },

    removeTodo(planId, todoId) {
      const plan = this.planById(planId)
      if (plan) plan.todos = plan.todos.filter((t) => t.id !== todoId)
    },

    // ===== 行程与花费 =====
    addRecord(planId, record) {
      const plan = this.planById(planId)
      if (plan) plan.records.push({ id: uid(), ...record })
    },

    updateRecord(planId, recordId, record) {
      const plan = this.planById(planId)
      const target = plan?.records.find((r) => r.id === recordId)
      if (target) Object.assign(target, record)
    },

    deleteRecord(planId, recordId) {
      const plan = this.planById(planId)
      if (plan) plan.records = plan.records.filter((r) => r.id !== recordId)
    },

    // ===== 出行总结 =====
    saveSummary(planId, summary) {
      const plan = this.planById(planId)
      if (plan) plan.summary = summary
    },
  },
})
