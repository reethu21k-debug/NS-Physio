import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout, ProtectedRoute, PublicLayout, UserLayout } from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/public/Home';

const Services = lazy(() => import('./pages/public/Services'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Forgot = lazy(() => import('./pages/auth/Forgot'));
const Reset = lazy(() => import('./pages/auth/Reset'));
const Dashboard = lazy(() => import('./pages/user/Dashboard'));
const Book = lazy(() => import('./pages/user/Book'));
const MyAppointments = lazy(() => import('./pages/user/MyAppointments'));
const AppointmentDetail = lazy(() => import('./pages/user/AppointmentDetail'));
const Profile = lazy(() => import('./pages/user/Profile'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments'));
const AdminAppointmentDetail = lazy(() => import('./pages/admin/AdminAppointmentDetail'));
const AdminServices = lazy(() => import('./pages/admin/AdminServices'));
const AdminPrices = lazy(() => import('./pages/admin/AdminPrices'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminTimeSlots = lazy(() => import('./pages/admin/AdminTimeSlots'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password" element={<Reset />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<UserLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/book-appointment" element={<Book />} />
            <Route path="/appointments" element={<MyAppointments />} />
            <Route path="/appointments/:id" element={<AppointmentDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute admin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/appointments" element={<AdminAppointments />} />
            <Route path="/admin/appointments/:id" element={<AdminAppointmentDetail />} />
            <Route path="/admin/services" element={<AdminServices />} />
            <Route path="/admin/prices" element={<AdminPrices />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/time-slots" element={<AdminTimeSlots />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Route>
        <Route path="*" element={<PublicLayout />}><Route path="*" element={<div className="container-x py-24 text-center"><h1 className="text-3xl">Page not found</h1></div>} /></Route>
      </Routes>
    </Suspense>
  );
}