require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serves static files from 'public'

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("✅ MongoDB Connected Successfully");
}).catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
});

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI_ATTENDANCE, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("✅ MongoDB (Attendance) Connected Successfully");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        process.exit(1);
    }
};

// Import Routes
const teacherRoutes = require('./routes/teacherRoutes');


// Routes
app.use('/teacher', teacherRoutes);


// Redirect '/' to teacher.html
app.get('/', (req, res) => {
    res.redirect('/teacher.html'); // Redirects root URL to teacher.html
});

// Handle Undefined Routes
app.use((req, res) => {
    res.status(404).json({ message: "❌ Route Not Found" });
});

// Suppress MongoDB Logs
mongoose.set('debug', false);

// Server Initialization
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
