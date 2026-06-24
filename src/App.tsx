import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CheckIn from './pages/checkin/CheckIn';
import QueueTracker from './pages/queuetracker/QueueTracker';
import StaffPortal from './pages/staffportal/StaffPortal';
import AdminDashboard from './pages/admindashboard/AdminDashboard';
import EmergencyOverride from './pages/emergencyoverride/EmergencyOverride';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/checkin" replace />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/queue/:tokenId" element={<QueueTracker />} />
        <Route path="/staff" element={<StaffPortal />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/emergency" element={<EmergencyOverride />} />
      </Routes>
    </BrowserRouter>
  );
}