import { EventEmitter } from 'events';

class TypedEventBus extends EventEmitter {}

export const eventBus = new TypedEventBus();
