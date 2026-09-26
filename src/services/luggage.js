import { DESTINATION_TYPES } from '../constants'
import { uid } from '../utils/id'

// 根据出行类型推导目的地类型（国内 / 国外）
export function getDestinationType(tripType) {
  return tripType === '出国' ? DESTINATION_TYPES.ABROAD : DESTINATION_TYPES.DOMESTIC
}

// 构造单个模板物品（数量默认为 1）
function item(name, category, extra = {}) {
  return { id: uid(), name, category, custom: false, packed: false, quantity: 1, ...extra }
}

// 将任意输入归一化为合法数量（正整数，非法时回退为 1）
export function normalizeQuantity(value) {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 1
}

// 名称末尾的数量后缀，如 “内衣裤 ×3”、“袜子 x2”、“毛巾*4”
const QUANTITY_SUFFIX_RE = /\s*[×xX*＊✕]\s*(\d+)\s*$/

// 从物品名称中解析乘号数量后缀，返回干净名称与数量
// 无法解析时原样返回名称、数量为 1，不丢失原有信息
export function parseQuantityFromName(name) {
  const text = String(name || '').trim()
  const match = text.match(QUANTITY_SUFFIX_RE)
  if (!match) return { name: text, quantity: 1 }
  const cleanName = text.slice(0, match.index).trim()
  // 剥离后名称为空（如 “×3”）时保留原名称，避免信息丢失
  if (!cleanName) return { name: text, quantity: 1 }
  return { name: cleanName, quantity: normalizeQuantity(match[1]) }
}

// 归一化单个行李物品（用于旧数据迁移）：
// 缺少 quantity 字段时尝试从名称的乘号后缀中恢复数量，其余字段原样保留
export function normalizeLuggageItem(item) {
  if (item.quantity != null) {
    return { ...item, quantity: normalizeQuantity(item.quantity) }
  }
  const parsed = parseQuantityFromName(item.name)
  return { ...item, name: parsed.name, quantity: parsed.quantity }
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

// 统计行李清单的件数：{ packed: 已打包件数, total: 总件数 }
export function luggagePieceCounts(items = []) {
  return items.reduce(
    (acc, i) => {
      const qty = normalizeQuantity(i.quantity)
      acc.total += qty
      if (i.packed) acc.packed += qty
      return acc
    },
    { packed: 0, total: 0 }
  )
}

// 计算单个行李清单的打包完成率（0-100），按已打包件数 / 总件数
export function luggageCompletionRate(items = []) {
  const { packed, total } = luggagePieceCounts(items)
  if (!total) return 0
  return Math.round((packed / total) * 100)
}
