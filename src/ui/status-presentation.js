import { statusCounterText } from '../game/rules/statuses.js'
import { statusIconSource } from './status-icons.js'

export function statusEffectText(status) {
  if (status.id === 'dodge') return '\u89c4\u907f\u4e00\u6b21\u653b\u51fb\u53ca\u5176\u9644\u52a0\u6548\u679c'
  if (status.id === 'parry') return '\u4e0b\u6b21\u8fd1\u6218\u653b\u51fb\u51cf\u4f2430%'
  const spec = status.damage
  let damage = String(typeof spec === 'number' ? spec : spec?.value || 0)
  if (spec?.mode === 'incoming-attack') damage = `\u672c\u6b21\u53d7\u51fb\u4f24\u5bb3\u7684${Math.round((spec.ratio ?? 1) * 100)}%`
  else if (spec && typeof spec === 'object' && spec.mode !== 'fixed') damage = '\u89e6\u53d1\u65f6\u8ba1\u7b97'
  if (status.id === 'counter') return `\u53d7\u5230\u653b\u51fb\u7ed3\u7b97\u540e\u53cd\u51fb\uff0c\u4f24\u5bb3${damage}`
  if (status.id === 'player-poison') return `\u6bcf\u56de\u5408\u5931\u53bb${damage}\u751f\u547d\uff0c\u65e0\u89c6\u62a4\u7532`
  if (status.id === 'burning') return `\u6bcf\u56de\u5408\u53d7\u5230${damage}\u4f24\u5bb3`
  return status.description || ''
}

export function playerStatusEntries(run) {
  const entries = Object.values(run.player.statuses || {}).filter(status => status.layers > 0 && status.turns > 0).map(status => ({
    id: status.id, name: status.name || status.id, glyph: Array.from(status.name || status.id)[0],
    icon: statusIconSource(status.id === 'player-poison' ? 'poison' : status.id),
    badge: status.showLayers ? String(status.layers) : status.showTurns ? String(status.turns) : '',
    tone: status.id === 'player-poison' ? 'poison' : status.id === 'burning' ? 'burning' : 'neutral',
    description: [statusEffectText(status), statusCounterText(status)].filter(Boolean).join('\uff1b'),
  }))
  const pending = run.itemRules.pendingLines()
  if (run.totems.entities.length) entries.push({ id: 'totem-capacity', name: '图腾', glyph: '图', icon: null,
    badge: String(run.totems.entities.length), tone: 'neutral', description: `图腾占用${run.totems.entities.length}点体力上限；消失时只恢复上限` })
  if (run.totems.cooldown) entries.push({ id: 'totem-cooldown', name: '召唤冷却', glyph: '召', icon: null,
    badge: String(run.totems.cooldown), tone: 'neutral', description: `所有图腾徽章共享，剩余${run.totems.cooldown}个全局回合` })
  for (const [id, buff] of Object.entries(run.itemRules.state.buffs)) {
    if (id.startsWith('r-') || (id === 'spring' && !run.itemRules.has(id))) continue
    const name = run.itemRules.sourceName(id)
    entries.push({ id: `buff-${id}`, name, glyph: Array.from(name)[0] || '?', icon: statusIconSource(id, buff),
      badge: buff.showLayers ? String(buff.layers) : buff.showTurns ? String(buff.turns) : '', tone: 'neutral',
      description: pending.find(line => line.startsWith(name)) || statusCounterText(buff) })
  }
  return entries
}
