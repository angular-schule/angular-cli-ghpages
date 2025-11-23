/**
 * Public API for angular-cli-ghpages
 *
 * This module exports public types and functions that users can use
 * to extend or customize angular-cli-ghpages functionality.
 */

// Angular CLI integration
export * from './ng-add';
export { default as angularDeploy } from './deploy/actions';
export * from './deploy/builder';

// Schema and options types
export { Schema } from './deploy/schema';
export {
  GHPages,
  PublishOptions,
  DeployUser,
  AngularOutputPath,
  AngularOutputPathObject,
  isOutputPathObject
} from './interfaces';

// Default configuration
export { defaults } from './engine/defaults';

// Core deployment engine
export { run as deployToGHPages } from './engine/engine';

// Advanced: Extracted option processing functions for custom workflows
export {
  setupMonkeypatch,
  mapNegatedBooleans,
  handleUserCredentials,
  warnDeprecatedParameters,
  appendCIMetadata,
  injectTokenIntoRepoUrl,
  prepareOptions
} from './engine/engine';
