export const ATTRIBUTE_ORDER = Object.freeze(['scorch', 'wither', 'drown'])

export const ATTRIBUTE_DEFS = Object.freeze({
  scorch: Object.freeze({ id: 'scorch', name: '\u707c\u70ed', color: '#ef5b5b', backTop: '#8f2632', backBottom: '#260f1b' }),
  wither: Object.freeze({ id: 'wither', name: '\u67af\u840e', color: '#f4d56d', backTop: '#756024', backBottom: '#2d260e' }),
  drown: Object.freeze({ id: 'drown', name: '\u6c89\u6eba', color: '#69b7ee', backTop: '#245f8d', backBottom: '#10243b' }),
})

const ATTRIBUTE_IDS = new Set(ATTRIBUTE_ORDER)

export function isAttribute(value) { return ATTRIBUTE_IDS.has(value) }

export function getAttributeDefinition(attribute) { return ATTRIBUTE_DEFS[attribute] || null }

export function attributeLabel(attribute) { return getAttributeDefinition(attribute)?.name || '' }

export function randomCardBackAttribute(random = Math.random) {
  return ATTRIBUTE_ORDER[Math.floor(random() * ATTRIBUTE_ORDER.length)] || ATTRIBUTE_ORDER[0]
}

export function attributeModifier(attackerAttribute, targetAttribute) {
  const attackerIndex = ATTRIBUTE_ORDER.indexOf(attackerAttribute)
  const targetIndex = ATTRIBUTE_ORDER.indexOf(targetAttribute)
  if (attackerIndex < 0 || targetIndex < 0) return { multiplier: 1, countered: false, resisted: false }
  if (ATTRIBUTE_ORDER[(attackerIndex + 1) % ATTRIBUTE_ORDER.length] === targetAttribute) {
    return { multiplier: 1.6, countered: true, resisted: false }
  }
  if (ATTRIBUTE_ORDER[(attackerIndex + ATTRIBUTE_ORDER.length - 1) % ATTRIBUTE_ORDER.length] === targetAttribute) {
    return { multiplier: 0.65, countered: false, resisted: true }
  }
  return { multiplier: 1, countered: false, resisted: false }
}
