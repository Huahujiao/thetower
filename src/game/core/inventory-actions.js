// One explicit player gesture produces at most one world turn. Displaced items
// are a consequence of a replacement, not a second player command.
export function commitInventoryDrop(run, itemOrUid, index, { rotation = null } = {}) {
  if (!run._canOrganizeBackpack() || run.itemTargeting) return null
  const preview = run.previewInventoryDrop(itemOrUid, index, { rotation })
  if (!preview || preview.status === 'blocked') return null
  const original = run.backpack.placementOf(preview.item.uid)
  const changed = !original || original.x !== preview.x || original.y !== preview.y
    || original.rotation !== preview.rotation || preview.conflicts.length > 0
  if (!changed) return null
  const result = run._applyInventoryDrop(preview.item, index, { rotation, replace: true })
  if (!result) return null
  for (const conflict of result.conflicts) run.stageInventoryItem(conflict, { notify: false })
  run._finishInventoryAction()
  return result
}

export function moveInventoryToStash(run, itemOrUid, { rotation = null } = {}) {
  if (!run._canOrganizeBackpack() || run.itemTargeting) return false
  const item = typeof itemOrUid === 'object' ? itemOrUid : run.backpack.placementOf(itemOrUid)?.item
  if (!item || !run.backpack.placementOf(item.uid)) return false
  run.backpack.removeByUid(item.uid)
  if (rotation != null) item.bagRotation = ((rotation % 4) + 4) % 4
  run.stageInventoryItem(item, { notify: false })
  return run._finishInventoryAction()
}

export function discardInventoryItem(run, itemOrUid, { notify = true } = {}) {
  if (!run._canOrganizeBackpack() || run.itemTargeting) return false
  const uid = typeof itemOrUid === 'object' ? itemOrUid?.uid : itemOrUid
  const item = run.inventoryStash.find((stashed) => stashed?.uid === uid)
    || run.backpack.placementOf(uid)?.item
  if (!item) return false
  run.inventoryStash = run.inventoryStash.filter((stashed) => stashed.uid !== uid)
  run.backpack.removeByUid(uid)
  run.itemRules.discarded(item)
  if (item.type === 'relic') run.relics.remove(item.uid) || run.relics.remove(item.relicId)
  run._log(`\u4e22\u5f03 ${item.name}\u3002`)
  run._endTurn({ recoverEnergy: false, action: 'organize' })
  if (notify) run._changed()
  return true
}
