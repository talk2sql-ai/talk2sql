import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, MessageSquare, Zap, Shield, Code, BookOpen } from 'lucide-react';

const sections = [
  {
    icon: MessageSquare,
    title: 'Getting Started',
    description: 'Learn how to convert your first natural language query to SQL.',
    content: [
      'Sign up for a free account',
      'Select your database type (MySQL, PostgreSQL, or SQLite)',
      'Type your query in plain English',
      'Review and copy the generated SQL'
    ]
  },
  {
    icon: Database,
    title: 'Supported Databases',
    description: 'We support the most popular database systems.',
    content: [
      'MySQL - Full support for MySQL 5.7+',
      'PostgreSQL - Compatible with PostgreSQL 12+',
      'SQLite - Perfect for local development'
    ]
  },
  {
    icon: Code,
    title: 'Query Types',
    description: 'Types of SQL operations you can generate.',
    content: [
      'SELECT - Retrieve data with complex joins and filters',
      'INSERT - Add new records to your tables',
      'UPDATE - Modify existing data safely',
      'DELETE - Remove records with proper conditions'
    ]
  },
  {
    icon: Zap,
    title: 'Best Practices',
    description: 'Tips for getting the best results.',
    content: [
      'Be specific about table and column names',
      'Describe relationships between tables',
      'Always review generated SQL before executing',
      'Test queries on non-production data first'
    ]
  },
  {
    icon: Shield,
    title: 'Security',
    description: 'How we keep your data safe.',
    content: [
      'All connections are encrypted with TLS',
      'Queries are not stored permanently',
      'No direct database connections required',
      'SOC 2 Type II compliant infrastructure'
    ]
  },
  {
    icon: BookOpen,
    title: 'Examples',
    description: 'Common query patterns and examples.',
    content: [
      '"Show me all users who signed up last month"',
      '"Find orders over $100 with customer details"',
      '"Count products by category"',
      '"Get the top 10 selling items this year"'
    ]
  }
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Documentation</h1>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about using Talk2SQL.ai
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {sections.map((section) => (
            <Card key={section.title} className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg gradient-primary">
                    <section.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.content.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
