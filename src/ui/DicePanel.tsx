import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DicePanelProps {
  preloadedExpression?: string;
}

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const HISTORY_LIMIT = 10;

interface RollResult {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

function secureRandomInt(maxExclusive: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}

function rollExpression(expression: string): RollResult | null {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(expression.trim());
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  if (count < 1 || count > 100 || sides < 1) return null;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(secureRandomInt(sides) + 1);
  }
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
  return { expression, rolls, modifier, total };
}

export function DicePanel({ preloadedExpression }: DicePanelProps) {
  const { t } = useTranslation('session');
  const [expression, setExpression] = useState<string>(preloadedExpression ?? '');
  const [history, setHistory] = useState<RollResult[]>([]);

  const diePrefix = t('dice.diePrefix', 'W');
  const sumLabel = t('dice.sum', 'Summe');

  function handleRoll(): void {
    const result = rollExpression(expression);
    if (!result) return;
    setHistory((prev) => [result, ...prev].slice(0, HISTORY_LIMIT));
  }

  function formatResult(r: RollResult): string {
    const mod = r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : `${r.modifier}`) : '';
    return `${r.expression} → [${r.rolls.join(', ')}]${mod} = ${sumLabel} ${r.total}`;
  }

  return (
    <div className="dice-panel">
      <div className="dice-panel__buttons">
        {DICE_SIDES.map((sides) => (
          <button
            key={sides}
            className="btn dice-panel__die"
            onClick={() => setExpression(`1d${sides}`)}
          >
            {`${diePrefix}${sides}`}
          </button>
        ))}
      </div>

      <div className="dice-panel__input">
        <input
          type="text"
          aria-label={t('dice.expression', 'Würfelausdruck')}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
        />
        <button className="btn btn--primary" onClick={handleRoll}>
          {t('dice.roll', 'Würfeln')}
        </button>
      </div>

      <ul className="dice-panel__history" aria-label={t('dice.history', 'Verlauf')}>
        {history.map((r, i) => (
          <li key={`${r.expression}-${i}`}>{formatResult(r)}</li>
        ))}
      </ul>
    </div>
  );
}
