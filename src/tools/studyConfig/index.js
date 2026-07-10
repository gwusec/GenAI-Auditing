// studyConfig — the versioned StudyConfig backbone (Phase B).
// Barrel export so call sites import from one place.

export {
  STUDY_CONFIG_SCHEMA_VERSION,
  CONTROL_MODES,
  PROVIDERS,
  PROVIDER_META,
  REACTION_TYPES,
  LIFECYCLE_STATES,
  createDefaultStudyConfig,
  withStudyConfigDefaults,
  validateStudyConfig,
  assertValidStudyConfig,
} from './schema';

export { deriveRuntimeConfig, modelToRelay } from './deriveRuntimeConfig';
export { applyConversationControl, buildConversationProvenance } from './conversationControl';
