import { useState } from 'react';

export interface VarDef {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'enum';
  options?: string[];
}

interface Props {
  variables: VarDef[];
  onChange: (condition: unknown) => void;
  initialCondition?: unknown;
}

type SimpleOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'is_true' | 'is_false';

interface SimpleCondition {
  kind: 'simple';
  varId: string;
  op: SimpleOp;
  value: string;
}

interface GroupCondition {
  kind: 'group';
  logic: 'and' | 'or';
  conditions: ConditionNode[];
}

type ConditionNode = SimpleCondition | GroupCondition;

function parseInitial(init: unknown, vars: VarDef[]): ConditionNode {
  if (!init || typeof init !== 'object') {
    return { kind: 'simple', varId: vars[0]?.id ?? '', op: '==', value: '' };
  }
  const obj = init as Record<string, unknown>;
  const op = Object.keys(obj)[0];

  if (op === 'and' || op === 'or') {
    const kids = (obj[op] as unknown[]).map((c) => parseInitial(c, vars));
    return { kind: 'group', logic: op, conditions: kids };
  }

  if (['==', '!=', '>', '>=', '<', '<='].includes(op)) {
    const args = obj[op] as [unknown, unknown];
    const left = args[0] as Record<string, unknown>;
    const right = args[1];
    const varPath = typeof left?.var === 'string' ? left.var : '';
    const varId = varPath.replace('vars.', '');
    return { kind: 'simple', varId, op: op as SimpleOp, value: String(right ?? '') };
  }

  if (op === 'var') {
    const varPath = typeof obj[op] === 'string' ? obj[op] as string : '';
    const varId = varPath.replace('vars.', '');
    return { kind: 'simple', varId, op: '==', value: 'true' };
  }

  return { kind: 'simple', varId: vars[0]?.id ?? '', op: '==', value: '' };
}

function toJsonLogic(node: ConditionNode): unknown {
  if (node.kind === 'group') {
    return { [node.logic]: node.conditions.map(toJsonLogic) };
  }
  if (node.op === 'is_true') return { var: `vars.${node.varId}` };
  if (node.op === 'is_false') return { '!': [{ var: `vars.${node.varId}` }] };
  const val = !isNaN(Number(node.value)) && node.value !== '' ? Number(node.value) : node.value;
  return { [node.op]: [{ var: `vars.${node.varId}` }, val] };
}

function previewNode(node: ConditionNode, vars: VarDef[]): string {
  if (node.kind === 'group') {
    const sep = node.logic === 'and' ? ' && ' : ' || ';
    return node.conditions.map((c) => previewNode(c, vars)).join(sep);
  }
  const varDef = vars.find((v) => v.id === node.varId);
  const label = varDef?.label ?? node.varId;
  return `${label} ${node.op} ${node.value}`;
}

export function ConditionBuilder({ variables, onChange, initialCondition }: Props) {
  const [root, setRoot] = useState<ConditionNode>(() =>
    initialCondition ? parseInitial(initialCondition, variables) : { kind: 'simple', varId: variables[0]?.id ?? '', op: '==', value: '' },
  );
  // track whether user has interacted (activates value inputs)
  const [dirty, setDirty] = useState(!initialCondition);
  const [notMode, setNotMode] = useState(false);

  function update(newRoot: ConditionNode) {
    setRoot(newRoot);
    setDirty(true);
    const logic = toJsonLogic(newRoot);
    onChange(notMode ? { '!': [logic] } : logic);
  }

  function updateSimple(field: keyof SimpleCondition, value: string) {
    if (root.kind !== 'simple') return;
    const updated = { ...root, [field]: value } as SimpleCondition;
    update(updated);
  }

  function addGroup() {
    const newGroup: GroupCondition = {
      kind: 'group',
      logic: 'and',
      conditions: [root, { kind: 'simple', varId: variables[0]?.id ?? '', op: '==', value: '' }],
    };
    update(newGroup);
  }

  const preview = previewNode(root, variables);
  const simpleNode = root.kind === 'simple' ? root : null;
  const groupNode = root.kind === 'group' ? root : null;
  const varId = simpleNode?.varId ?? '';
  const varDef = variables.find((v) => v.id === varId);

  return (
    <div>
      {simpleNode && (
        <div>
          <select
            aria-label="Variable"
            value={varId}
            onChange={(e) => { setDirty(true); updateSimple('varId', e.target.value); }}
          >
            {variables.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <select
            aria-label="Operator"
            value={simpleNode.op}
            onChange={(e) => updateSimple('op', e.target.value as SimpleOp)}
          >
            <option value="==">==</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value=">=">&gt;=</option>
            <option value="<">&lt;</option>
            <option value="<=">&lt;=</option>
          </select>
          {/* Only render editable value input when dirty (user-initiated), else show as text */}
          {dirty ? (
            varDef?.type === 'enum' && varDef.options ? (
              <select
                aria-label="Value"
                value={simpleNode.value}
                onChange={(e) => updateSimple('value', e.target.value)}
              >
                {varDef.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : varDef?.type === 'number' ? (
              <input
                type="number"
                aria-label="Value"
                value={simpleNode.value}
                onChange={(e) => updateSimple('value', e.target.value)}
              />
            ) : (
              <input
                type="text"
                aria-label="Value"
                value={simpleNode.value}
                onChange={(e) => updateSimple('value', e.target.value)}
              />
            )
          ) : (
            <span aria-label="current-value">{simpleNode.value}</span>
          )}
        </div>
      )}
      {groupNode && (
        <div>
          <span>{groupNode.logic.toUpperCase()}</span>
          {groupNode.conditions.map((child, i) => (
            <ConditionBuilder
              key={i}
              variables={variables}
              initialCondition={toJsonLogic(child)}
              onChange={(updated) => {
                const next = { ...groupNode, conditions: groupNode.conditions.map((c, j) => j === i ? updated : c) };
                onChange(next);
              }}
            />
          ))}
        </div>
      )}
      <div aria-label="preview">{preview}</div>
      <div>
        <button onClick={addGroup}>Add Group</button>
        <button onClick={() => setNotMode((n) => !n)}>NOT</button>
      </div>
    </div>
  );
}
