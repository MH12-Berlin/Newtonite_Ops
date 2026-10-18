import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/authContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import WorkItems from "./pages/WorkItems";
import WorkItemDetails from "./pages/WorkItemDetails";
import Teams from "./pages/Teams";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route
            path="/work-items"
            element={
              <ProtectedRoute>
                <WorkItems />
              </ProtectedRoute>
            }
          />
          <Route
            path="/work-items/:id"
            element={
              <ProtectedRoute>
                <WorkItemDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <Teams />
              </ProtectedRoute>
            }
          />
        </Routes>

      </AuthProvider>
    </BrowserRouter>
  );
}