import './style.css'
import { Routes, Route } from 'react-router-dom'
import NavBar from "./NavBar";
import Home from "./pages/Home";
import Review from "./pages/Review";
import Add from "./pages/Add";
import Browse from "./pages/Browse";
import Detail from "./pages/Detail";

function App() {
    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
            <NavBar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/review" element={<Review />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/memory/:id" element={<Detail />} />
                <Route path="/add" element={<Add />} />
            </Routes>
        </div>
    )
}

export default App
