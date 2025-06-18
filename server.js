require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ✅ Proper CORS configuration (replace with your frontend's actual origin)
app.use(cors({
  origin: 'http://localhost:9000', // frontend origin
  credentials: true
}));

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("✅ MongoDB (Attendance) Connected Successfully");
}).catch(err => {
  console.error("❌ MongoDB Connection Error:", err.message);
  process.exit(1);
});

// Routes
const teacherRoutes = require('./routes/teacherRoutes');
app.use('/teacher', teacherRoutes);



// Home Route
app.get('/', (req, res) => {
  res.redirect('/teacher.html');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "❌ Route Not Found" });
});

// Start Server
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
