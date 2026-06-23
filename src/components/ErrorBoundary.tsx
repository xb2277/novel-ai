import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 font-ui text-[var(--color-text-secondary)]">
          <div className="text-4xl opacity-30">⚠</div>
          <p className="text-sm">应用遇到了意外错误</p>
          <p className="text-xs text-[var(--color-text-secondary)]/60 max-w-md text-center">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="btn-primary text-sm"
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
