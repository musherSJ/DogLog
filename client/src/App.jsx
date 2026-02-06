import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { api, setToken, isLoggedIn } from './api.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Dogs from './pages/Dogs.jsx';
import DogDetail from './pages/DogDetail.jsx';
import Activities from './pages/Activities.jsx';
import ActivityForm from './pages/ActivityForm.jsx';
import RecordActivity from './pages/RecordActivity.jsx';
import Profile from './pages/Profile.jsx';

export const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" />;
}

function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/') ? 'active' : '';

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">DogLog</Link>
        <div className="navbar-links">
          <Link to="/" className={isActive('/')}>Dashboard</Link>
          <Link to="/dogs" className={isActive('/dogs')}>Dogs</Link>
          <Link to="/activities" className={isActive('/activities')}>Activities</Link>
          <Link to="/profile" className={isActive('/profile')}>Profile</Link>
          <button onClick={logout}>Log out</button>
        </div>
      </nav>
      <nav className="bottom-nav">
        <Link to="/" className={isActive('/')}>
          <span className="nav-icon">&#9776;</span>
          <span>Home</span>
        </Link>
        <Link to="/dogs" className={isActive('/dogs')}>
          <span className="nav-icon">&#128054;</span>
          <span>Dogs</span>
        </Link>
        <Link to="/record" className={isActive('/record')}>
          <span className="nav-icon">&#9679;</span>
          <span>Record</span>
        </Link>
        <Link to="/activities" className={isActive('/activities')}>
          <span className="nav-icon">&#9733;</span>
          <span>Activities</span>
        </Link>
        <Link to="/profile" className={isActive('/profile')}>
          <span className="nav-icon">&#128100;</span>
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      api.getMe()
        .then(setUser)
        .catch(() => setToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      <BrowserRouter>
        <div className="app-layout">
          <NavBar />
          <main className="main-content">
            <Routes>
              <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/dogs" element={<PrivateRoute><Dogs /></PrivateRoute>} />
              <Route path="/dogs/:id" element={<PrivateRoute><DogDetail /></PrivateRoute>} />
              <Route path="/activities" element={<PrivateRoute><Activities /></PrivateRoute>} />
              <Route path="/activities/new" element={<PrivateRoute><ActivityForm /></PrivateRoute>} />
              <Route path="/activities/:id/edit" element={<PrivateRoute><ActivityForm /></PrivateRoute>} />
              <Route path="/record" element={<PrivateRoute><RecordActivity /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
