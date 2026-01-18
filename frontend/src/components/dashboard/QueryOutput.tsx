import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Code, MessageSquare, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface QueryOutputProps {
  sql: string;
  explanation?: string;
  suggestions?: { sql: string; title: string }[];
  isLoading: boolean;
  operation?: string;
}

export function QueryOutput({ sql, explanation, suggestions, isLoading, operation }: QueryOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
            <p className="text-muted-foreground text-sm animate-pulse">
              Processing your query...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sql && !explanation && (!suggestions || suggestions.length === 0)) {
    const isExplain = operation === 'explain';
    const isSuggest = operation === 'suggest';
    const PlaceholderIcon = isSuggest ? Sparkles : (isExplain ? MessageSquare : Code);
    const placeholderText = isSuggest
      ? "AI suggestions will appear here"
      : (isExplain ? "Your explanation will appear here" : "Your generated SQL will appear here");

    return (
      <Card className="border-border border-dashed bg-background/50">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <PlaceholderIcon className="h-10 w-10 opacity-50" />
            <p className="text-sm">{placeholderText}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {operation === 'suggest' && suggestions && suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <Card key={index} className="border-border bg-background overflow-hidden relative group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors" />
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4 bg-muted/30 border-b border-border">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                    {index + 1}
                  </span>
                  {suggestion.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(suggestion.sql);
                    toast.success('SQL copied!');
                  }}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="p-4 overflow-x-auto bg-muted/5">
                  <code className="text-sm font-mono text-foreground whitespace-pre-wrap">
                    {suggestion.sql}
                  </code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {operation !== 'explain' && sql && (
            <Card className="border-border bg-background overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between py-3 px-4 bg-muted/30 border-b border-border">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  Generated SQL
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-success">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="p-4 overflow-x-auto">
                  <code className="text-sm font-mono text-foreground whitespace-pre-wrap">
                    {sql}
                  </code>
                </pre>
              </CardContent>
            </Card>
          )}

          {explanation && (
            <Card className={cn(
              "border-border bg-background",
              operation === 'explain' ? "border-none shadow-none h-full" : ""
            )}>
              {operation !== 'explain' && (
                <CardHeader className="py-3 px-4 border-b border-border">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Explanation
                  </CardTitle>
                </CardHeader>
              )}
              <CardContent className={cn("p-4", operation === 'explain' && "p-0")}>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {explanation}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
