import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeaveRequest from './pages/LeaveRequest';
import AIChat from './pages/AIChat';
import Rules from './pages/Rules';

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent text-muted-foreground">
      Checking session...
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <Login />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/leave-request',
    element: (
      <ProtectedRoute>
        <LeaveRequest />
      </ProtectedRoute>
    ),
  },
  {
    path: '/ai-chat',
    element: (
      <ProtectedRoute>
        <AIChat />
      </ProtectedRoute>
    ),
  },
  {
    path: '/rules',
    element: (
      <ProtectedRoute>
        <Rules />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '*',
    element: <RootRedirect />,
  },
]);
