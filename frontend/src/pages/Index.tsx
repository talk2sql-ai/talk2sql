import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Database,
  Sparkles,
  Zap,
  MessageSquare,
  ArrowRight,
  Code,
  CheckCircle
} from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    title: 'Generate SQL',
    description: 'Convert plain English descriptions into optimized SQL queries instantly.',
    link: '/dashboard?op=generate'
  },
  {
    icon: Code,
    title: 'Fix SQL',
    description: 'Debug and fix SQL syntax errors with intelligent error detection.',
    link: '/dashboard?op=fix'
  },
  {
    icon: MessageSquare,
    title: 'Explain SQL',
    description: 'Get clear, detailed explanations of complex SQL queries in plain language.',
    link: '/dashboard?op=explain'
  },
  {
    icon: Zap,
    title: 'Optimize SQL',
    description: 'Improve query performance with AI-powered optimization suggestions.',
    link: '/dashboard?op=optimize'
  },
  {
    icon: ArrowRight,
    title: 'AI Suggestions',
    description: 'Get intelligent suggestions for your next database queries.',
    link: '/dashboard?op=suggest'
  },
  {
    icon: Database,
    title: 'View Possible Joins',
    description: 'Automatically discover and visualize relations between your tables.',
    link: '/dashboard?op=join'
  },
];

const benefits = [
  'Works with MySQL, PostgreSQL, and SQLite',
  'No SQL expertise required',
  'Instant query generation',
  'Copy-ready code output',
  'Performance optimization tips',
  'Secure and private'
];

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.15),transparent_70%)]" />

          <div className="relative container mx-auto px-4 py-24 md:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">AI-Powered SQL Assistant</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Master Your Data with{' '}
                <span className="text-gradient">AI-Powered SQL</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Write, debug, and optimize complex queries in seconds.
                Convert natural language into production-ready SQL and eliminate the manual syntax struggle.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/signin">
                  <Button size="lg" className="gradient-primary text-primary-foreground glow-primary px-8 hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    Try Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="hover:-translate-y-1 hover:bg-muted/50 transition-all duration-300">
                    Learn More
                  </Button>
                </a>
              </div>

              {/* Code Preview */}
              <div className="mt-16 relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-2xl blur-xl" />
                <Card className="relative border-border bg-card shadow-2xl">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                      <div className="w-3 h-3 rounded-full bg-destructive/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-success/60" />
                      <span className="ml-2 text-xs text-muted-foreground">Talk2SQL.ai</span>
                    </div>
                    <div className="p-6 text-left">
                      <div className="mb-4">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Input</span>
                        <p className="text-sm mt-1 text-foreground/80">
                          "Get all users who signed up last month with their order count"
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Output</span>
                        <pre className="mt-2 p-4 rounded-lg bg-code-bg text-sm font-mono overflow-x-auto">
                          <code className="text-foreground">
                            {`SELECT u.id, u.name, u.email, 
       COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= DATE_SUB(NOW(), 
      INTERVAL 1 MONTH)
GROUP BY u.id;`}
                          </code>
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need for <span className="text-gradient">SQL Mastery</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                From beginners to experts, Talk2SQL.ai helps you write better SQL faster
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={index}
                    className="h-full border-border bg-card transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 glow-primary-sm">
                        <Icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Why Developers Choose <span className="text-gradient">Talk2SQL.ai</span>
                </h2>
                <p className="text-muted-foreground text-lg mb-8">
                  Stop debugging syntax and start building features.
                  Let AI handle the complexity of SQL optimization, joins, and structure so you can focus on your product.
                </p>
                <div className="grid gap-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
                <Link to="/signin" className="inline-block mt-8">
                  <Button size="lg" className="gradient-primary text-primary-foreground glow-primary-sm">
                    Start Today
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-transparent rounded-2xl blur-2xl" />
                <Card className="relative border-border bg-card p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl gradient-primary glow-primary-sm">
                      <Database className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Multi-Database Support</h3>
                      <p className="text-muted-foreground text-sm">Works with your favorite database</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {['🐬 MySQL', '🐘 PostgreSQL', '📦 SQLite'].map((db, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg bg-muted/50 text-center text-sm font-medium"
                      >
                        {db}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 gradient-primary opacity-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.2),transparent_70%)]" />

          <div className="relative container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your SQL Workflow?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of developers who write better SQL with AI assistance.
            </p>
            <Link to="/signin">
              <Button size="lg" className="gradient-primary text-primary-foreground glow-primary px-8">
                Try Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
