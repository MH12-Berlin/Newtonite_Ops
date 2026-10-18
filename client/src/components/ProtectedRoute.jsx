import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-slate-600">Loading your session...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
}