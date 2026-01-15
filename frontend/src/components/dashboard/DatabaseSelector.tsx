import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import sqliteLogo from '@/assets/sqlite-logo.png';

interface DatabaseSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const databases = [
  { value: 'mysql', label: 'MySQL', icon: '🐬' },
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { value: 'sqlite', label: 'SQLite', icon: sqliteLogo, isImage: true },
];

export function DatabaseSelector({ value, onChange }: DatabaseSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Database Type</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-card border-border">
          <SelectValue placeholder="Select database" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {databases.map((db) => (
            <SelectItem key={db.value} value={db.value}>
              <span className="flex items-center gap-2">
                {db.isImage ? (
                  <img src={db.icon} alt={db.label} className="w-5 h-5 object-contain" />
                ) : (
                  <span>{db.icon}</span>
                )}
                <span>{db.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
