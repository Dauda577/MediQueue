import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import CheckIn from './pages/checkin/CheckIn';
import QueueTracker from './pages/queuetracker/QueueTracker';
import StaffPortal from './pages/staffportal/StaffPortal';
import AdminDashboard from './pages/admindashboard/AdminDashboard';
import EmergencyOverride from './pages/emergencyoverride/EmergencyOverride';
import Login from './pages/login/Login';
import AcceptInvite from './pages/acceptinvite/AcceptInvite';
import NotFound from './pages/notfound/NotFound';

// Redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!staff) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/queue/:tokenId" element={<QueueTracker />} />

        {/* Role-based redirect after login */}
        <Route path="/" element={<Navigate to="/checkin" replace />} />

        {/* Protected routes */}
        <Route path="/staff" element={<ProtectedRoute><StaffPortal /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/emergency" element={<ProtectedRoute><EmergencyOverride /></ProtectedRoute>} />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}