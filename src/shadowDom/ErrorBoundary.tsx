import React from 'react';

export class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    setShowErrors: (show: boolean) => void;
    hasError?: boolean;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: {
    children: React.ReactNode;
    setShowErrors: (show: boolean) => void;
    hasError?: boolean;
  }) {
    super(props);
    this.state = { hasError: props.hasError ?? false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  static Errored = (props: { setShowErrors: (show: boolean) => void }) => {
    const { setShowErrors } = props;
    return (
      <ErrorBoundary
        setShowErrors={setShowErrors}
        children={[]}
        hasError={true}
      />
    );
  };

  componentDidCatch() {
    // Call the setShowErrors function passed as a prop
    const { setShowErrors } = this.props;
    setShowErrors(true);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <h1 style={{ fontWeight: 'bold' }}>
            Error occurred while rendering the component.
          </h1>
          {this.state.error && (
            <p style={{ color: 'oklch(0.704 0.191 22.216)' }}>
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => !this.props.hasError && this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '16px',
              borderRadius: '4px',
              backgroundColor: '#3b82f6',
              padding: '8px 16px',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return <div>{this.props.children}</div>;
  }
}
