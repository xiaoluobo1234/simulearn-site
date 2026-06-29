import { foundationTutorials } from './tools-tutorials-foundation';
import { languageTutorials } from './tools-tutorials-language';
import { controlTutorials } from './tools-tutorials-control';
import { structureTutorials } from './tools-tutorials-structure';
import { apdlFoundationTutorials } from './tools-tutorials-apdl-foundation';
import { apdlCommandsTutorials } from './tools-tutorials-apdl-commands';
import { apdlMeshSolveTutorials } from './tools-tutorials-apdl-mesh-solve';
import { apdlPostAdvancedTutorials } from './tools-tutorials-apdl-post-advanced';
import { numpyFoundationTutorials } from './tools-tutorials-numpy-foundation';
import { numpyAdvancedTutorials } from './tools-tutorials-numpy-advanced';
import { scipyFoundationTutorials } from './tools-tutorials-scipy-foundation';
import { scipyAdvancedTutorials } from './tools-tutorials-scipy-advanced';

export const toolsTutorials = {
  ...foundationTutorials,
  ...languageTutorials,
  ...controlTutorials,
  ...structureTutorials,
  ...apdlFoundationTutorials,
  ...apdlCommandsTutorials,
  ...apdlMeshSolveTutorials,
  ...apdlPostAdvancedTutorials,
  ...numpyFoundationTutorials,
  ...numpyAdvancedTutorials,
  ...scipyFoundationTutorials,
  ...scipyAdvancedTutorials,
} as const;
