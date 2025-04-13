import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import Politician from './pages/Politician'; // Add this import

function App() {
  return (
    <ChakraProvider>
      <Router>
        <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/politician/:id" element={<Politician />} /> {/* Add this route */}
          </Routes>
          <Footer />
        </div>
      </Router>
    </ChakraProvider>
  );
}

export default App;