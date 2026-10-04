import { getTotemDefinition } from '../game/data/totems.js'

export function totemFaceData(entity) {
  const definition = getTotemDefinition(entity.totemId)
  return { type: 'totem', title: entity.name, glyph: definition?.glyph || '图', color: definition?.color || '#b69cdf',
    lifetimeLabel: '战斗结束消失' }
}

export function drawTotemToken(context, card) {
  context.clearRect(0, 0, 160, 160)
  context.fillStyle = '#181420'
  context.beginPath(); context.ellipse(80, 133, 40, 10, 0, 0, Math.PI * 2); context.fill()
  context.fillStyle = '#554239'; context.fillRect(54, 50, 52, 81)
  context.strokeStyle = '#9f8164'; context.lineWidth = 3; context.strokeRect(54, 50, 52, 81)
  context.fillStyle = card.color
  context.beginPath(); context.moveTo(80, 30); context.lineTo(116, 56); context.lineTo(108, 98)
  context.lineTo(52, 98); context.lineTo(44, 56); context.closePath(); context.fill()
  context.fillStyle = '#1b1820'; context.font = 'bold 30px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'
  context.fillText(card.glyph, 80, 69)
  context.fillStyle = '#f1e6ff'; context.font = 'bold 16px sans-serif'; context.fillText(card.title, 80, 16)
  context.font = 'bold 14px sans-serif'; context.fillText(card.lifetimeLabel, 80, 115)
}
