import * as d from '../../declarations';
import { buildJestArgv, getProjectListFromCLIArgs } from './jest-config';
import { setScreenshotEmulateData } from '../puppeteer/puppeteer-emulate';


export async function runJest(config: d.Config, env: d.E2EProcessEnv) {
  // set all of the emulate data to the process.env to be read later on
  env.__STENCIL_EMULATE_CONFIGS__ = JSON.stringify(config.testing.emulate);

  // build up our args from our already know list of args in the config
  const jestArgv = buildJestArgv(config);

  // build up the project paths, which is basically the app's root dir
  const projects = getProjectListFromCLIArgs(config, jestArgv);

  // run the jest-cli with our data rather than letting the
  // jest-cli parse the args itself
  const { runCLI } = require('jest-cli');
  const cliResults = await runCLI(jestArgv, projects);

  const success = !!cliResults.results.success;

  return success;
}


export function createTestRunner(): any {

  const TestRunner = require('jest-runner');

  class StencilTestRunner extends TestRunner {

    async runTests(tests: { path: string }[], watcher: any, onStart: any, onResult: any, onFailure: any, options: any) {
      const env = (process.env as d.E2EProcessEnv);

        // filter out only the tests the flags said we should run
      tests = tests.filter(t => includeTestFile(t.path, env));

      if (env.__STENCIL_SCREENSHOT__ === 'true') {
        // we're doing e2e screenshots, so let's loop through
        // each of the emulate configs for each test

        // get the emulate configs from the process env
        // and parse the emulate config data
        const emulateConfigs = JSON.parse(env.__STENCIL_EMULATE_CONFIGS__) as d.EmulateConfig[];

        // loop through each emulate config to re-run the tests per config
        for (let i = 0; i < emulateConfigs.length; i++) {
          const emulateConfig = emulateConfigs[i];

          // reset the environment for each emulate config
          setScreenshotEmulateData(emulateConfig, env);

          // run the test for each emulate config
          await super.runTests(tests, watcher, onStart, onResult, onFailure, options);
        }

      } else {
        // not doing e2e screenshot tests
        // so just run each test once
        await super.runTests(tests, watcher, onStart, onResult, onFailure, options);
      }
    }

  }

  return StencilTestRunner;
}


export function includeTestFile(testPath: string, env: d.E2EProcessEnv) {
  testPath = testPath.toLowerCase().replace(/\\/g, '/');

  if (!(testPath.endsWith('.ts') || testPath.endsWith('.tsx'))) {
    return false;
  }

  if ((testPath.includes('.e2e.') || testPath.includes('/e2e.')) && env.__STENCIL_E2E_TESTS__ === 'true') {
    // keep this test if it's an e2e file and we should be testing e2e
    return true;
  }

  if ((testPath.includes('.spec.') || testPath.includes('/spec.')) && env.__STENCIL_SPEC_TESTS__ === 'true') {
    // keep this test if it's a spec file and we should be testing unit tests
    return true;
  }

  return false;
}
