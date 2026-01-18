import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Wrench, MessageSquare, Zap, Sparkles, ArrowRight, Link2 } from 'lucide-react';

interface OperationSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const operations = [
  {
    value: 'generate',
    label: 'Generate SQL',
    description: 'From English to SQL',
    icon: Sparkles,
    color: 'text-primary'
  },
  {
    value: 'fix',
    label: 'Fix SQL',
    description: 'Debug and fix errors',
    icon: Wrench,
    color: 'text-orange-500'
  },
  {
    value: 'explain',
    label: 'Explain SQL',
    description: 'Understand your query',
    icon: MessageSquare,
    color: 'text-blue-500'
  },
  {
    value: 'optimize',
    label: 'Optimize SQL',
    description: 'Improve performance',
    icon: Zap,
    color: 'text-yellow-500'
  },
  {
    value: 'suggest',
    label: 'AI Suggestions',
    description: 'Get query suggestions',
    icon: ArrowRight,
    color: 'text-green-500'
  },
  {
    value: 'join',
    label: 'View Possible Joins',
    description: 'Find table relations',
    icon: Link2,
    color: 'text-purple-500'
  },
];

export function OperationSelector({ value, onChange }: OperationSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Operation</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {operations.map((op) => {
          const Icon = op.icon;
          const isSelected = value === op.value;

          return (
            <button
              key={op.value}
              type="button"
              onClick={() => onChange(op.value)}
              className={cn(
                "relative p-4 rounded-lg border text-left transition-all duration-200",
                "hover:border-primary/50 hover:bg-card",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md glow-primary-sm"
                  : "border-border bg-card/50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5", op.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-sm">{op.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {op.description}
                  </div>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
