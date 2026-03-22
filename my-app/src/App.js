
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AuthPage from './AuthPage';
import HomePage from './pages/HomePage';
import OneStepReaction from './pages/OneStepReaction';
import Mechanism from './pages/Mechanism';
import Synthesis from './pages/Synthesis';
import AnswerKey from './pages/AnswerKey';
import ReactionExplorer from './pages/ReactionExplorer';
import RuleBuilder from './pages/RuleBuilder';
import TutorialPage from './pages/TutorialPage';

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
          <Route path="/ReactionExplorer" element={<PrivateRoute><ReactionExplorer /></PrivateRoute>} />
          <Route path="/rule-builder" element={<PrivateRoute><RuleBuilder /></PrivateRoute>} />
          <Route path="/tutorial" element={<PrivateRoute><TutorialPage /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
