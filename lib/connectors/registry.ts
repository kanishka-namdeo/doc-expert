import type { Connector } from './types';
import { googleDriveConnector } from './google-drive';
import { microsoft365Connector } from './microsoft-365';

const registry = new Map<string, Connector>([
  [googleDriveConnector.id, googleDriveConnector],
  [microsoft365Connector.id, microsoft365Connector],
]);

export function registerConnector(connector: Connector): void {
  registry.set(connector.id, connector);
}

export function getConnector(id: string): Connector | undefined {
  return registry.get(id);
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values());
}
