// src/App.tsx
import { ChakraProvider, extendTheme } from '@chakra-ui/react'  // Change this import
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import About from './pages/About';
import IndustryDetail from './pages/IndustryDetail';
import Politician from './pages/Politician';

// Create a custom theme with DM Sans font
const theme = extendTheme({
  fonts: {
    heading: "'DM Sans', sans-serif",
    body: "'DM Sans', sans-serif",
  },
})

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/industry/:industry" element={<IndustryDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/politician/:id" element={<Politician />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </ChakraProvider>
  );
}

export default App;