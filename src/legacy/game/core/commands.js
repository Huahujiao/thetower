// Public gameplay command names. UI code may continue calling GameState
// methods during phase one; dispatch() provides the stable boundary for later.
export const COMMANDS = Object.freeze({
  FLIP: 'flip',
  PICK_UP: 'pickUp',
  ATTACK: 'attack',
  ARM_WEAPON: 'armWeapon',
  SELECT_HAND: 'selectHand',
  MOVE_BACKPACK: 'moveBackpack',
  ROTATE_BACKPACK: 'rotateBackpack',
  SWITCH_TO_EQUIP: 'switchToEquip',
  USE_POTION: 'usePotion',
  USE_BUFF: 'useBuff',
  USE_ITEM: 'useItem',
  APPLY_ITEM: 'applyItemToWeapon',
  DISCARD: 'discard',
  DISCARD_EQUIP: 'discardEquip',
  WAIT_TURN: 'waitTurn',
  ENTER_EXIT: 'enterExit',
  CHOOSE_REWARD: 'chooseReward',
  SKIP_REWARD: 'skipReward',
  SET_REST_MODE: 'setRestMode',
  REQUEST_BUY: 'requestBuy',
  CONFIRM_PENDING: 'confirmPending',
  CANCEL_PENDING: 'cancelPending',
  ENTER_NEXT_FLOOR: 'enterNextFloor',
  CHOOSE_INITIAL_RELIC: 'chooseInitialRelic',
  ACTIVATE_RELIC: 'activateRelic',
  DEACTIVATE_RELIC: 'deactivateRelic',
  CAST_ACTIVE_SKILL: 'castActiveSkill',
  SELECT_ACTIVE_SKILL: 'selectActiveSkill',
  SWITCH_ACTIVE_SKILL: 'switchActiveSkill',
})

export function command(type, payload = {}) {
  return { type, ...payload }
}
