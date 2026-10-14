import React from 'react';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/** Turns a failed lazy route/chunk into a useful recovery screen instead of a blank page. */
export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="min-h-[55vh] bg-[#F4F7FA] flex items-center justify-center px-5 py-16" role="alert">
        <div className="max-w-lg rounded-2xl bg-white border border-amber-200 shadow-sm p-6 text-center">
          <h1 className="text-xl font-black text-[#002D62]">This campaign page could not load</h1>
          <p className="mt-2 text-sm text-slate-600">
            Please refresh once. If the problem continues, the deployment may have mixed old and new website files.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-black text-white"
            >
              Refresh page
            </button>
            <a href="/campaigns" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-[#002D62]">
              View campaigns
            </a>
          </div>
        </div>
      </section>
    );
  }
}
