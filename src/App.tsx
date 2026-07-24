import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import CheckIn from './pages/checkin/CheckIn';
import QueueTracker from './pages/queuetracker/QueueTracker';
import StaffPortal from './pages/staffportal/StaffPortal';
import AdminDashboard from './pages/admindashboard/AdminDashboard';
import EmergencyOverride from './pages/emergencyoverride/EmergencyOverride';
import Login from './pages/login/Login';
import AdminLogin from './pages/adminlogin/AdminLogin';
import StaffLogin from './pages/stafflogin/StaffLogin';
import AcceptInvite from './pages/acceptinvite/AcceptInvite';
import NotFound from './pages/notfound/NotFound';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!staff || staff.role !== 'admin') return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!staff || staff.role === 'admin') return <Navigate to="/staff/login" replace />;

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  if (!staff) return <Navigate to="/checkin" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/queue/:tokenId" element={<QueueTracker />} />

        <Route path="/" element={<Navigate to="/checkin" replace />} />

        {/* Protected routes — strict role isolation */}
        <Route path="/staff" element={<StaffRoute><StaffPortal /></StaffRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/emergency" element={<ProtectedRoute><EmergencyOverride /></ProtectedRoute>} />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
