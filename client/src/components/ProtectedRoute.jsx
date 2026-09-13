import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RouteLoader() {
  return (
    <div className="eco-loading">
      <div className="eco-loading-spinner" />
      <p className="eco-loading-text">Checking the path…</p>
    </div>
  );
}

/**
 * Guard for pages that need a signed-in user (and optionally an admin).
 * Redirects to /login (preserving the intended destination) or home.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoader />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
