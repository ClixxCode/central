import { AsyncLocalStorage } from 'async_hooks';
import type { SessionUser } from './session';

const actorStorage = new AsyncLocalStorage<SessionUser>();

export function runAsActor<T>(actor: SessionUser, callback: () => Promise<T>): Promise<T> {
  return actorStorage.run(actor, callback);
}

export function getActorOverride(): SessionUser | undefined {
  return actorStorage.getStore();
}
