import {
  ChoicePoint,
  ConditionExpression,
  Route,
  ScenePackage,
  StateAxis,
} from '../validation/schemas';

export type ConditionPrimitive = string | number | boolean;
export type StateScope =
  | 'global'
  | 'route'
  | 'chapter'
  | 'scene'
  | 'transient'
  | 'knowledge'
  | 'affinity';

export type ScopedStateStore = Record<StateScope, Record<string, ConditionPrimitive>>;

export const DEFAULT_SCOPED_STATE: ScopedStateStore = {
  global: {},
  route: {},
  chapter: {},
  scene: {},
  transient: {},
  knowledge: {},
  affinity: {},
};

type TokenType =
  | 'LPAREN'
  | 'RPAREN'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'EQ'
  | 'NEQ'
  | 'GTE'
  | 'LTE'
  | 'GT'
  | 'LT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'STRING'
  | 'IDENT'
  | 'EOF';

type Token = {
  type: TokenType;
  value?: string;
};

type EvalOptions = {
  onUnknownIdentifier?: 'throw' | 'false' | 'undefined';
};

const DEFAULT_OPTIONS: Required<EvalOptions> = {
  onUnknownIdentifier: 'throw',
};

const SCOPE_ORDER: StateScope[] = [
  'scene',
  'chapter',
  'route',
  'global',
  'transient',
  'knowledge',
  'affinity',
];

class Tokenizer {
  private pos = 0;

  constructor(private readonly input: string) {}

  nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) return { type: 'EOF' };

    const ch = this.input[this.pos];

    if (ch === '(') {
      this.pos += 1;
      return { type: 'LPAREN' };
    }
    if (ch === ')') {
      this.pos += 1;
      return { type: 'RPAREN' };
    }

    const two = this.input.slice(this.pos, this.pos + 2);
    if (two === '==') return this.advance(2, 'EQ');
    if (two === '!=') return this.advance(2, 'NEQ');
    if (two === '>=') return this.advance(2, 'GTE');
    if (two === '<=') return this.advance(2, 'LTE');

    if (ch === '>') return this.advance(1, 'GT');
    if (ch === '<') return this.advance(1, 'LT');

    if (ch === '"' || ch === "'") {
      return this.readString(ch);
    }

    if (/[0-9]/.test(ch)) {
      return this.readNumber();
    }

    if (/[A-Za-z_]/.test(ch)) {
      return this.readIdentifierOrKeyword();
    }

    throw new Error(`Invalid character in condition: '${ch}'`);
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos += 1;
    }
  }

  private advance(step: number, type: TokenType): Token {
    this.pos += step;
    return { type };
  }

  private readString(quote: string): Token {
    this.pos += 1;
    const start = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      this.pos += 1;
    }
    if (this.pos >= this.input.length) {
      throw new Error('Unterminated string literal in condition expression');
    }
    const value = this.input.slice(start, this.pos);
    this.pos += 1;
    return { type: 'STRING', value };
  }

  private readNumber(): Token {
    const start = this.pos;
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      this.pos += 1;
    }
    return { type: 'NUMBER', value: this.input.slice(start, this.pos) };
  }

  private readIdentifierOrKeyword(): Token {
    const start = this.pos;
    while (this.pos < this.input.length && /[A-Za-z0-9_.]/.test(this.input[this.pos])) {
      this.pos += 1;
    }
    const raw = this.input.slice(start, this.pos);
    const upper = raw.toUpperCase();
    if (upper === 'AND') return { type: 'AND' };
    if (upper === 'OR') return { type: 'OR' };
    if (upper === 'NOT') return { type: 'NOT' };
    if (upper === 'TRUE' || upper === 'FALSE') return { type: 'BOOLEAN', value: upper };
    return { type: 'IDENT', value: raw };
  }
}

type ParserContext = {
  tokenizer: Tokenizer;
  current: Token;
  states: ScopedStateStore;
  options: Required<EvalOptions>;
};

const next = (ctx: ParserContext): void => {
  ctx.current = ctx.tokenizer.nextToken();
};

const expect = (ctx: ParserContext, type: TokenType): void => {
  if (ctx.current.type !== type) {
    throw new Error(`Expected token ${type} but found ${ctx.current.type}`);
  }
  next(ctx);
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  return Boolean(value);
};

const resolveIdentifier = (
  identifier: string,
  states: ScopedStateStore,
  options: Required<EvalOptions>,
): ConditionPrimitive | undefined => {
  const dot = identifier.indexOf('.');
  if (dot > 0) {
    const scopeCandidate = identifier.slice(0, dot) as StateScope;
    const key = identifier.slice(dot + 1);
    if (scopeCandidate in states && key in states[scopeCandidate]) {
      return states[scopeCandidate][key];
    }
  }

  for (const scope of SCOPE_ORDER) {
    if (identifier in states[scope]) {
      return states[scope][identifier];
    }
  }

  if (options.onUnknownIdentifier === 'throw') {
    throw new Error(`Unknown state identifier: ${identifier}`);
  }
  if (options.onUnknownIdentifier === 'false') return false;
  return undefined;
};

const parseValue = (ctx: ParserContext): ConditionPrimitive | undefined => {
  const token = ctx.current;

  if (token.type === 'NUMBER') {
    next(ctx);
    return Number(token.value);
  }
  if (token.type === 'BOOLEAN') {
    next(ctx);
    return token.value === 'TRUE';
  }
  if (token.type === 'STRING') {
    next(ctx);
    return token.value ?? '';
  }
  if (token.type === 'IDENT') {
    next(ctx);
    return resolveIdentifier(token.value ?? '', ctx.states, ctx.options);
  }

  throw new Error(`Expected value token but found ${token.type}`);
};

const compare = (
  op: TokenType,
  left: ConditionPrimitive | undefined,
  right: ConditionPrimitive | undefined,
): boolean => {
  switch (op) {
    case 'EQ':
      return left === right;
    case 'NEQ':
      return left !== right;
    case 'GTE':
      return (left as any) >= (right as any);
    case 'LTE':
      return (left as any) <= (right as any);
    case 'GT':
      return (left as any) > (right as any);
    case 'LT':
      return (left as any) < (right as any);
    default:
      throw new Error(`Unsupported comparator: ${op}`);
  }
};

const parsePrimary = (ctx: ParserContext): boolean => {
  if (ctx.current.type === 'LPAREN') {
    next(ctx);
    const value = parseOr(ctx);
    expect(ctx, 'RPAREN');
    return value;
  }

  const left = parseValue(ctx);

  if (['EQ', 'NEQ', 'GTE', 'LTE', 'GT', 'LT'].includes(ctx.current.type)) {
    const op = ctx.current.type;
    next(ctx);
    const right = parseValue(ctx);
    return compare(op, left, right);
  }

  return toBoolean(left);
};

const parseNot = (ctx: ParserContext): boolean => {
  if (ctx.current.type === 'NOT') {
    next(ctx);
    return !parseNot(ctx);
  }
  return parsePrimary(ctx);
};

const parseAnd = (ctx: ParserContext): boolean => {
  let value = parseNot(ctx);
  while (ctx.current.type === 'AND') {
    next(ctx);
    value = value && parseNot(ctx);
  }
  return value;
};

const parseOr = (ctx: ParserContext): boolean => {
  let value = parseAnd(ctx);
  while (ctx.current.type === 'OR') {
    next(ctx);
    value = value || parseAnd(ctx);
  }
  return value;
};

export const evaluateConditionExpression = (
  expression: ConditionExpression,
  scopedStateStore: Partial<ScopedStateStore>,
  options?: EvalOptions,
): boolean => {
  const merged: ScopedStateStore = {
    ...DEFAULT_SCOPED_STATE,
    ...scopedStateStore,
  };

  const ctx: ParserContext = {
    tokenizer: new Tokenizer(expression),
    current: { type: 'EOF' },
    states: merged,
    options: { ...DEFAULT_OPTIONS, ...options },
  };

  next(ctx);
  const result = parseOr(ctx);

  if (ctx.current.type !== 'EOF') {
    throw new Error(`Unexpected trailing token: ${ctx.current.type}`);
  }

  return result;
};

export const tryEvaluateConditionExpression = (
  expression: ConditionExpression | undefined,
  scopedStateStore: Partial<ScopedStateStore>,
): boolean => {
  if (!expression || expression.trim().length === 0) return true;
  try {
    return evaluateConditionExpression(expression, scopedStateStore, {
      onUnknownIdentifier: 'false',
    });
  } catch {
    return false;
  }
};

export const evaluateChoiceAvailability = (
  choice: ChoicePoint,
  scopedStateStore: Partial<ScopedStateStore>,
): { visible: boolean; available: boolean } => {
  const visible = tryEvaluateConditionExpression(choice.visibilityCondition, scopedStateStore);
  const available =
    visible && tryEvaluateConditionExpression(choice.availabilityCondition, scopedStateStore);

  return { visible, available };
};

export const evaluateRouteUnlocked = (
  route: Route,
  scopedStateStore: Partial<ScopedStateStore>,
): boolean => {
  if (!route.enabledState) return false;
  return tryEvaluateConditionExpression(route.unlockConditions, scopedStateStore);
};

export const evaluateSceneEntry = (
  scenePackage: ScenePackage,
  scopedStateStore: Partial<ScopedStateStore>,
): boolean => {
  return tryEvaluateConditionExpression(scenePackage.entryConditions, scopedStateStore);
};

export const collectStateIdentifiers = (expression: ConditionExpression): string[] => {
  const tokenizer = new Tokenizer(expression);
  const identifiers = new Set<string>();

  while (true) {
    const token = tokenizer.nextToken();
    if (token.type === 'EOF') break;
    if (token.type === 'IDENT' && token.value) identifiers.add(token.value);
  }

  return [...identifiers];
};

export type ConditionLintIssue = {
  code: 'UNKNOWN_IDENTIFIER' | 'TYPE_MISMATCH' | 'INVALID_COMPARATOR_FOR_TYPE';
  level: 'error' | 'warning';
  message: string;
  identifier?: string;
};

type LintValueType = 'number' | 'boolean' | 'string' | 'unknown';

const resolveIdentifierType = (identifier: string, stateAxes: StateAxis[]): LintValueType => {
  const normalized = identifier.includes('.')
    ? identifier.split('.').slice(1).join('.')
    : identifier;
  const axis = stateAxes.find((item) => item.stateKey === normalized);
  if (!axis) return 'unknown';
  if (axis.type === 'number' || axis.type === 'boolean' || axis.type === 'string') return axis.type;
  return 'unknown';
};

const tokenTypeToValueType = (
  token: Token,
  stateAxes: StateAxis[],
): { type: LintValueType; identifier?: string } => {
  if (token.type === 'NUMBER') return { type: 'number' };
  if (token.type === 'BOOLEAN') return { type: 'boolean' };
  if (token.type === 'STRING') return { type: 'string' };
  if (token.type === 'IDENT') {
    const identifier = token.value || '';
    return { type: resolveIdentifierType(identifier, stateAxes), identifier };
  }
  return { type: 'unknown' };
};

export const lintConditionExpression = (
  expression: ConditionExpression,
  stateAxes: StateAxis[],
): ConditionLintIssue[] => {
  const tokenizer = new Tokenizer(expression);
  const issues: ConditionLintIssue[] = [];
  let token = tokenizer.nextToken();
  const isValueToken = (t: Token) => ['NUMBER', 'BOOLEAN', 'STRING', 'IDENT'].includes(t.type);

  while (token.type !== 'EOF') {
    if (!isValueToken(token)) {
      token = tokenizer.nextToken();
      continue;
    }

    const left = token;
    const op = tokenizer.nextToken();

    if (!['EQ', 'NEQ', 'GTE', 'LTE', 'GT', 'LT'].includes(op.type)) {
      token = op;
      continue;
    }

    const right = tokenizer.nextToken();
    if (!isValueToken(right)) {
      token = right;
      continue;
    }
    const leftType = tokenTypeToValueType(left, stateAxes);
    const rightType = tokenTypeToValueType(right, stateAxes);

    if (leftType.identifier && leftType.type === 'unknown') {
      issues.push({
        code: 'UNKNOWN_IDENTIFIER',
        level: 'warning',
        identifier: leftType.identifier,
        message: `Unknown state identifier '${leftType.identifier}' in condition.`,
      });
    }
    if (rightType.identifier && rightType.type === 'unknown') {
      issues.push({
        code: 'UNKNOWN_IDENTIFIER',
        level: 'warning',
        identifier: rightType.identifier,
        message: `Unknown state identifier '${rightType.identifier}' in condition.`,
      });
    }

    if (
      leftType.type !== 'unknown' &&
      rightType.type !== 'unknown' &&
      leftType.type !== rightType.type
    ) {
      issues.push({
        code: 'TYPE_MISMATCH',
        level: 'error',
        message: `Type mismatch in condition comparator '${op.type}': ${leftType.type} vs ${rightType.type}.`,
      });
    }

    if (['GT', 'GTE', 'LT', 'LTE'].includes(op.type)) {
      if (leftType.type !== 'number' || rightType.type !== 'number') {
        issues.push({
          code: 'INVALID_COMPARATOR_FOR_TYPE',
          level: 'error',
          message: `Comparator '${op.type}' requires numeric operands.`,
        });
      }
    }

    token = tokenizer.nextToken();
  }

  return issues;
};
