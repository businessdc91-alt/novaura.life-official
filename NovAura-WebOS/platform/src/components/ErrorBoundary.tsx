import { Component, type ErrorInfo, type ReactNode } from 'react';
import { NovAuraLogo } from '@/components/ui/NovAuraLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Home, RefreshCw, AlertCircle, ChevronDown, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Context label shown in the fallback UI — e.g. 'Creator Portal', 'Admin Panel' */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 * 
 * A class component that catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * 
 * Features:
 * - Catches React rendering errors
 * - Shows a beautiful fallback UI with NovAura branding
 * - Logs errors to console for debugging
 * - Provides refresh and go home functionality
 * - Shows collapsible error details for debugging
 */
export class ErrorBoundary extends Component<Props, State> {
  // section is accessible via this.props.section
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  /**
   * Update state so the next render will show the fallback UI
   */
  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  /**
   * Log error details to console for debugging
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
    });
  }

  /**
   * Refresh the current page to retry rendering
   */
  private handleRefresh = (): void => {
    window.location.reload();
  };

  /**
   * Navigate to the home page
   */
  private handleGoHome = (): void => {
    window.location.href = import.meta.env.BASE_URL || '/';
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border-border/50 bg-card/95 backdrop-blur-sm shadow-2xl">
            {/* Header with Logo */}
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-6">
                <NovAuraLogo size="lg" animated={false} showText={true} />
              </div>
              
              <div className="flex items-center justify-center gap-3 mb-2">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <CardTitle className="text-3xl font-bold text-foreground">
                  {this.props.section ? `${this.props.section} crashed` : 'Something went wrong'}
                </CardTitle>
              </div>

              <CardDescription className="text-base text-muted-foreground max-w-md mx-auto">
                {this.props.section
                  ? `An error occurred in the ${this.props.section}. The rest of the platform is unaffected.`
                  : 'We apologize for the inconvenience. An unexpected error has occurred.'}
                {' '}You can try refreshing or return to the home page.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleRefresh}
                  className="btn-rgb-living gap-2"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="gap-2"
                  size="lg"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>

              {/* Error Details (Collapsible for debugging) */}
              {this.state.error && (
                <Collapsible className="border rounded-lg bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Bug className="w-4 h-4" />
                      <span>Error Details (for debugging)</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="space-y-3 text-left">
                      {/* Error Message */}
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <p className="text-sm font-medium text-destructive mb-1">
                          Error Message:
                        </p>
                        <p className="text-sm text-destructive/90 font-mono break-all">
                          {this.state.error.message}
                        </p>
                      </div>

                      {/* Error Name */}
                      <div className="grid grid-cols-[auto,1fr] gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">Type:</span>
                        <span className="text-foreground font-mono">{this.state.error.name}</span>
                      </div>

                      {/* Component Stack */}
                      {this.state.errorInfo && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Component Stack:
                          </p>
                          <pre className="p-3 bg-background border rounded-md text-xs font-mono text-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}

                      {/* Stack Trace */}
                      {this.state.error.stack && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Stack Trace:
                          </p>
                          <pre className="p-3 bg-background border rounded-md text-xs font-mono text-foreground overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Support hint */}
              <p className="text-xs text-muted-foreground text-center">
                If the problem persists, please contact our support team with the error details above.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
