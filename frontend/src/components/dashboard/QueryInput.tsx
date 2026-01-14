import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface QueryInputProps {
  value: string;
  onChange: (value: string) => void;
  operation: string;
}

const placeholders: Record<string, string> = {
  fix: 'Paste your SQL query with errors here...\n\nExample:\nSELECT * FORM users WHERE id = 1',
  explain: 'Paste your SQL query here to get an explanation...\n\nExample:\nSELECT u.name, COUNT(o.id) as order_count\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.id',
  optimize: 'Paste your SQL query here to optimize it...\n\nExample:\nSELECT * FROM orders WHERE YEAR(created_at) = 2024',
  generate: 'Describe what you want in plain English...\n\nExample:\nGet all users who signed up in the last 30 days and have made at least 3 purchases',
  suggest: 'Describe your current context or paste recent queries...\n\nExample:\nI just queried user profiles, now I want to see their activity',
  join: 'Describe the tables you want to join...\n\nExample:\nI have users table and orders table, help me join them to see purchase history',
};

export function QueryInput({ value, onChange, operation }: QueryInputProps) {
  const isEnglishInput = operation === 'generate' || operation === 'suggest' || operation === 'join';
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {isEnglishInput ? 'Your Request' : 'SQL Query'}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholders[operation] || 'Enter your query here...'}
        className="min-h-[200px] font-mono text-sm bg-code-bg border-border resize-none"
      />
      <p className="text-xs text-muted-foreground">
        {isEnglishInput 
          ? 'Describe what you want in plain English' 
          : 'Enter your SQL query above'}
      </p>
    </div>
  );
}
