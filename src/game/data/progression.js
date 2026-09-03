import { FIXED_GROWTH, TALENT_DEFS, buildLevelUpChoices, getTalentDefinition, hasTalent, talentGraphState, unlockableTalents } from './talents.js'

export const PROGRESSION = Object.freeze({
  startingLevel: 1,
  baseExperienceToLevel: 8,
  experienceStep: 2,
  levelChoiceCount: 4,
})

export { FIXED_GROWTH, TALENT_DEFS, buildLevelUpChoices, getTalentDefinition, hasTalent, talentGraphState, unlockableTalents }

export function experienceToNextLevel(level) {
  const normalized = Math.max(PROGRESSION.startingLevel, Number(level) || PROGRESSION.startingLevel)
  return PROGRESSION.baseExperienceToLevel + (normalized - PROGRESSION.startingLevel) * PROGRESSION.experienceStep
}

export function getLevelUpOption(id) {
  if (id === FIXED_GROWTH.id) return FIXED_GROWTH
  return getTalentDefinition(id)
}
