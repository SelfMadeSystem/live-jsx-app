import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; setShowErrors: (show: boolean) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; setShowErrors: (show: boolean) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch() {
    // Call the setShowErrors function passed as a prop
    const { setShowErrors } = this.props;
    setShowErrors(true);
  }

  render() {
    if (this.state.hasError) {
      return <div>Error occurred while rendering the component.</div>;
    }

    return <div>{this.props.children}</div>;
  }
}
