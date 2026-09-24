export const HIT_DURATION = 0.3
export const DEATH_DURATION = 0.38
export const EXPLOSION_DURATION = 0.58

export function combatMotionTime(attackDuration, defeated) {
  return Math.max(attackDuration, HIT_DURATION + (defeated ? DEATH_DURATION : 0))
}

export function combatMotionAt(elapsed, attackDuration, defeated) {
  const attack = Math.min(1, elapsed / attackDuration)
  const hit = Math.min(1, elapsed / HIT_DURATION)
  const death = defeated ? Math.min(1, Math.max(0, elapsed - HIT_DURATION) / DEATH_DURATION) : 0
  return { attack, hit, death, done: elapsed >= combatMotionTime(attackDuration, defeated) }
}

export function idleMotion(time, offset = 0) {
  const wave = Math.sin(time * 2.4 + offset)
  return { lift: wave * 0.012, scale: 1 + wave * 0.013, tilt: Math.sin(time * 1.5 + offset) * 0.012 }
}

export function hitMotion(progress) {
  const impact = Math.sin(progress * Math.PI)
  return { lift: impact * 0.07, tilt: Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.14, scale: 1 - impact * 0.09 }
}

export function deathMotion(progress) {
  const eased = progress * progress * (3 - 2 * progress)
  return { lift: -eased * 0.25, tilt: eased * 0.75, scale: 1 - eased * 0.65, opacity: 1 - eased }
}

export function explosionMotion(progress) {
  const charge = Math.min(1, progress / 0.6)
  const burst = Math.max(0, (progress - 0.6) / 0.4)
  return {
    lift: charge * 0.11 - burst * 0.08,
    tilt: Math.sin(progress * Math.PI * 18) * (1 - progress) * 0.11,
    scale: 1 + charge * 0.38 + burst * 0.55,
    opacity: 1 - burst * burst,
    flash: Math.sin(Math.min(1, charge) * Math.PI * 4) * 0.5 + 0.5,
  }
}
