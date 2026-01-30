/**
 * DuoScript Storage Service Facade
 * Aggregates specialized repositories for cleaner imports.
 */

export * from './repositories/baseRepository';
export * from './repositories/projectRepository';
export * from './repositories/assetRepository';
export * from './repositories/vectorRepository';
export * from './repositories/artifactRepository';

export const getLastOpenedProjectId = async (): Promise<string | null> => {
  return localStorage.getItem('duoscript_active_id');
};
