import { foundationTutorials } from './tools-tutorials-foundation';
import { languageTutorials } from './tools-tutorials-language';
import { controlTutorials } from './tools-tutorials-control';
import { structureTutorials } from './tools-tutorials-structure';

export const toolsTutorials = {
  ...foundationTutorials,
  ...languageTutorials,
  ...controlTutorials,
  ...structureTutorials,
} as const;
