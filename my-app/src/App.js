
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AuthPage from './AuthPage';
import HomePage from './pages/HomePage';
import OneStepReaction from './pages/OneStepReaction';
import Mechanism from './pages/Mechanism';
import Synthesis from './pages/Synthesis';
import AnswerKey from './pages/AnswerKey';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/OneStepReaction" element={<PrivateRoute><OneStepReaction /></PrivateRoute>} />
          <Route path="/Mechanism" element={<PrivateRoute><Mechanism /></PrivateRoute>} />
          <Route path="/Synthesis" element={<PrivateRoute><Synthesis /></PrivateRoute>} />
          <Route path="/AnswerKey" element={<PrivateRoute><AnswerKey /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
