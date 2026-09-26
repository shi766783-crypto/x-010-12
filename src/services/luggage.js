import { DESTINATION_TYPES } from '../constants'
import { uid } from '../utils/id'

// 数量允许范围（模板按天数生成的数量也可能超过 99，上限放宽到 999）
const MIN_QUANTITY = 1
const MAX_QUANTITY = 999

// 名称末尾的数量标记，如 “内衣裤 ×3”“袜子x2”“纸巾 * 4”
// 兼容全角/半角乘号与星号；x/X 前若是数字（如 “10x20”）则不视为数量
const QTY_MARK_PATTERN = /\s*[×✕✖＊*xX]\s*(\d{1,3})\s*$/

// 从物品名称中拆分出数量标记；无有效标记时 quantity 为 null，名称原样保留
export function splitQuantityFromName(name) {
  const raw = String(name ?? '').trim()
  const match = raw.match(QTY_MARK_PATTERN)
  if (!match) return { name: raw, quantity: null }
  const symbol = match[0].trim().charAt(0)
  const prevChar = raw.charAt(match.index - 1)
  // “10x20”“3M x2” 这类尺寸/型号写法不算数量标记
  if ((symbol === 'x' || symbol === 'X') && /\d/.test(prevChar)) {
    return { name: raw, quantity: null }
  }
  const quantity = Number(match[1])
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY) {
    return { name: raw, quantity: null }
  }
  const cleanName = raw.slice(0, match.index).trim()
  // 去掉标记后名称为空（如整名就是 “×3”）时保留原名，避免丢失信息
  if (!cleanName) return { name: raw, quantity: null }
  return { name: cleanName, quantity: Math.min(quantity, MAX_QUANTITY) }
}

// 将数量约束到合法区间
export function clampItemQuantity(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < MIN_QUANTITY) return MIN_QUANTITY
  return Math.min(n, MAX_QUANTITY)
}

// 读取物品数量（兼容无数量字段的旧数据，默认 1）
export function itemQuantity(item) {
  return clampItemQuantity(item?.quantity ?? MIN_QUANTITY)
}

// 读取已打包件数（兼容旧的 packed 布尔标记：已打包视为全部件数）
export function itemPackedCount(item) {
  if (!item) return 0
  if (item.packedCount != null) {
    const n = Math.round(Number(item.packedCount))
    const count = Number.isFinite(n) ? n : 0
    return Math.min(Math.max(count, 0), itemQuantity(item))
  }
  return item.packed ? itemQuantity(item) : 0
}

// 将单个物品规范化为新结构：{ quantity, packedCount }
// 旧数据名称中内嵌的 “×N” 会拆分为独立数量字段，packed 布尔值折算为已打包件数
export function normalizeLuggageItem(raw) {
  if (!raw) return raw
  const item = { ...raw }
  if (item.quantity == null) {
    const parsed = splitQuantityFromName(item.name)
    item.name = parsed.name
    item.quantity = parsed.quantity ?? MIN_QUANTITY
  }
  item.quantity = clampItemQuantity(item.quantity)
  if (item.packedCount == null) {
    item.packedCount = item.packed ? item.quantity : 0
  }
  item.packedCount = Math.min(Math.max(Math.round(Number(item.packedCount)) || 0, 0), item.quantity)
  delete item.packed
  return item
}

// 迁移所有出行计划中的行李物品；返回是否发生过迁移
export function migratePlans(plans) {
  let migrated = false
  if (!Array.isArray(plans)) return { plans, migrated }
  plans.forEach((plan) => {
    ;(plan.luggage || []).forEach((list) => {
      const items = Array.isArray(list.items) ? list.items : []
      list.items = items.map((item) => {
        const normalized = normalizeLuggageItem(item)
        if (
          item.quantity == null ||
          item.packedCount == null ||
          item.packed !== undefined ||
          normalized.name !== item.name ||
          normalized.quantity !== item.quantity ||
          normalized.packedCount !== item.packedCount
        ) {
          migrated = true
        }
        return normalized
      })
    })
  })
  return { plans, migrated }
}

// 根据出行类型推导目的地类型（国内 / 国外）
export function getDestinationType(tripType) {
  return tripType === '出国' ? DESTINATION_TYPES.ABROAD : DESTINATION_TYPES.DOMESTIC
}

// 构造单个模板物品（默认数量 1、未打包）
function item(name, category, extra = {}) {
  return {
    id: uid(),
    name,
    category,
    custom: false,
    quantity: MIN_QUANTITY,
    packedCount: 0,
    ...extra,
  }
}

// 根据出行天数与目的地类型自动生成行李清单模板
export function generateLuggageTemplate({ tripType, days = 1 }) {
  const isAbroad = getDestinationType(tripType) === DESTINATION_TYPES.ABROAD
  const items = []

  // 证件类
  if (isAbroad) {
    items.push(item('护照', '证件类'))
    items.push(item('签证', '证件类'))
    items.push(item('身份证', '证件类'))
    items.push(item('驾照及翻译件', '证件类'))
  } else {
    items.push(item('身份证', '证件类'))
    items.push(item('驾驶证', '证件类'))
  }

  // 衣物类（数量随天数变化）
  items.push(item('内衣裤', '衣物类', { quantity: days }))
  items.push(item('袜子', '衣物类', { quantity: days }))
  items.push(item('换洗衣物', '衣物类', { quantity: days }))
  items.push(item('外套', '衣物类'))
  items.push(item('睡衣', '衣物类'))
  items.push(item('舒适鞋', '衣物类'))

  // 洗漱类
  items.push(item('牙刷', '洗漱类'))
  items.push(item('牙膏', '洗漱类'))
  items.push(item('毛巾', '洗漱类'))
  items.push(item('洗发水', '洗漱类'))
  items.push(item('沐浴露', '洗漱类'))
  items.push(item('护肤品', '洗漱类'))
  if (isAbroad || days >= 3) items.push(item('防晒霜', '洗漱类'))

  // 电子设备类
  items.push(item('手机', '电子设备类'))
  items.push(item('充电器', '电子设备类'))
  items.push(item('充电宝', '电子设备类'))
  items.push(item('耳机', '电子设备类'))
  if (isAbroad) items.push(item('转换插头', '电子设备类'))
  if (days >= 3) items.push(item('相机', '电子设备类'))

  // 药品类
  items.push(item('感冒药', '药品类'))
  items.push(item('肠胃药', '药品类'))
  items.push(item('创可贴', '药品类'))
  if (days >= 3) items.push(item('晕车药', '药品类'))
  if (isAbroad) items.push(item('个人常用药', '药品类'))

  // 其他类
  items.push(item('雨伞', '其他类'))
  items.push(item('水杯', '其他类'))
  items.push(item('纸巾', '其他类'))
  items.push(item('行李箱', '其他类'))
  if (isAbroad) items.push(item('护照夹', '其他类'))

  return items
}

// 计算单个行李清单的打包完成率（0-100）：已打包件数 / 总件数
export function luggageCompletionRate(items = []) {
  const total = items.reduce((sum, i) => sum + itemQuantity(i), 0)
  if (!total) return 0
  const packed = items.reduce((sum, i) => sum + itemPackedCount(i), 0)
  return Math.round((packed / total) * 100)
}
