import Attributor from './attributor/attributor';
import { Blot, Formattable } from './blot/abstract/blot';


export interface BlotConstructor {
  new(node: Node, value?: any): Blot;
  create(value?): Node;
}

export class ParchmentError extends Error {
  message: string;
  name: string;
  stack: string;

  constructor(message) {
    message = '[Parchment] ' + message;
    super(message);
    this.message = message;
    this.name = (<any>this.constructor).name;
    this.stack = (<any>new Error()).stack;
  }
}

let attributes: { [key: string]: Attributor } = {};
let classes: { [key: string]: BlotConstructor } = {};
let tags: { [key: string]: String } = {};
let types: { [key: string]: Attributor | BlotConstructor } = {};

export const DATA_KEY = '__blot';
export const PREFIX = 'blot-';

export enum Scope {
  TYPE = (1 << 2) - 1,          // 0011 Lower two bits
  LEVEL = ((1 << 2) - 1) << 2,  // 1100 Higher two bits

  ATTRIBUTE = (1 << 0) | LEVEL, // 1101
  BLOT = (1 << 1) | LEVEL,      // 1110
  INLINE = (1 << 2) | TYPE,     // 0111
  BLOCK = (1 << 3) | TYPE,      // 1011

  BLOCK_BLOT = BLOCK & BLOT,              // 1010
  INLINE_BLOT = INLINE & BLOT,            // 0110
  BLOCK_ATTRIBUTE = BLOCK & ATTRIBUTE,    // 1001
  INLINE_ATTRIBUTE = INLINE & ATTRIBUTE,  // 0101

  ANY = TYPE | LEVEL
};


export function create(input: Node | string | Scope, value?: any): Blot {
  let match = query(input);
  if (match == null) {
    throw new ParchmentError(`Unable to create ${input}`);
  }
  if (match instanceof Attributor) {
    let blot = <Formattable>create(match.scope & Scope.LEVEL);
    blot.format(<string>input, value);
    return blot;
  }
  let BlotClass = <BlotConstructor>match;
  let node = input instanceof Node ? input : BlotClass.create(value);
  return new BlotClass(node, value);
}

export function find(node: Node, bubble: boolean = false): Blot {
  if (node == null) return null;
  if (node[DATA_KEY] != null) return node[DATA_KEY].blot;
  if (bubble) return find(node.parentNode, bubble);
  return null;
}

export function query(query: string | Node | Scope, scope: Scope = Scope.ANY): Attributor | BlotConstructor {
  let match;
  if (typeof query === 'string') {
    match = types[query] || attributes[query];
  } else if (query instanceof Text) {
    match = types['text'];
  } if (typeof query === 'number') {
    if (query & Scope.LEVEL & Scope.BLOCK) {
      match = types['block'];
    } else if (query & Scope.LEVEL & Scope.INLINE) {
      match = types['inline'];
    }
  } else if (query instanceof HTMLElement) {
    let names = query.className.split(/\s+/);
    for (let i in names) {
      if (names[i].indexOf(PREFIX) === 0) {
        match = types[names[i].slice(PREFIX.length)];
        break;
      }
    }
    match = match || tags[query.tagName];
  }
  if (match == null) return null;
  if ((scope & Scope.LEVEL & match.scope) && (scope & Scope.TYPE & match.scope)) return match;
  return null;
}

export function register(Definition) {
  if (typeof Definition.blotName !== 'string' && typeof Definition.attrName !== 'string') {
    throw new ParchmentError('Invalid definition');
  } else if (Definition.blotName === 'abstract') {
    throw new ParchmentError('Cannot register abstract class');
  }
  types[Definition.blotName || Definition.attrName] = Definition;
  if (typeof Definition.tagName === 'string') {
    tags[Definition.tagName.toUpperCase()] = Definition;
  } else if (Array.isArray(Definition.tagName)) {
    Definition.tagName.forEach(function(tag) {
      tags[tag.toUpperCase()] = Definition;
    });
  } else if (typeof Definition.keyName === 'string') {
    attributes[Definition.keyName] = Definition;
  }
  return Definition;
}
