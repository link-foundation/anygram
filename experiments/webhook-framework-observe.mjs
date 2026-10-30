import {
  frameworkNames,
  frameworkScenario,
} from '../tests/fixtures/webhook-framework.js';

// Public observable callback effects, without copying an SDK adapter implementation.
for (const name of frameworkNames) {
  for (const mode of ['reply', 'empty', 'unauthorized']) {
    console.log(
      JSON.stringify({
        name,
        mode,
        result: await frameworkScenario(name, true, mode),
      })
    );
  }
}
