const express = require("express");
const router = express.Router();

const Student = require("../models/student");
const Attendance = require("../models/Attendance");
const ClassInfo = require("../models/ClassInfo"); // Make sure this model exists and is correct

// ==============================
// 📌 STUDENT ROUTES
// ==============================

// GET: Fetch all students (studentID and name)
router.get("/students", async (req, res) => {
  try {
    const students = await Student.find({}, "studentID name");
    res.json(students);
  } catch (err) {
    console.error("❌ Error fetching students:", err);
    res.status(500).json({ message: "❌ Error fetching students" });
  }
});

// ==============================
// 📌 ATTENDANCE ROUTES
// ==============================

// POST: Mark attendance for a date and subject
router.post("/mark-attendance", async (req, res) => {
  try {
    let { date, subject, studentsPresent } = req.body;
    const formattedDate = new Date(date).toISOString().split("T")[0];

    // Find student _ids for the present studentIDs
    const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id");
    const presentStudentIds = presentStudents.map(s => s._id);

    // Find existing attendance for date and subject
    let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ date: formattedDate, subject, presentStudents: presentStudentIds });
    } else {
      attendanceRecord.presentStudents = presentStudentIds;
    }

    await attendanceRecord.save();
    res.json({ message: "✅ Attendance submitted successfully!" });

  } catch (error) {
    console.error("❌ Error submitting attendance:", error);
    res.status(500).json({ message: "❌ Server error while marking attendance" });
  }
});

// PUT: Update attendance record and increment attended/total classes
router.put("/update-attendance", async (req, res) => {
  try {
    const { date, subject, studentsPresent } = req.body;
    const formattedDate = new Date(date).toISOString().split("T")[0];

    const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id studentID");
    const presentStudentIds = presentStudents.map(s => s._id);

    // Get all students for absent detection
    const allStudents = await Student.find({}, "_id studentID");
    const absentStudentIds = allStudents.filter(s => !studentsPresent.includes(s.studentID)).map(s => s._id);

    const attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });
    if (!attendanceRecord) {
      return res.status(404).json({ message: "❌ Attendance record not found" });
    }

    attendanceRecord.presentStudents = presentStudentIds;
    await attendanceRecord.save();

    // Update attended and total classes count for present students
    await Student.updateMany(
      { _id: { $in: presentStudentIds } },
      { $inc: { [`subjects.${subject}.attendedClasses`]: 1, [`subjects.${subject}.totalClasses`]: 1 } }
    );

    // Update total classes count for absent students only
    await Student.updateMany(
      { _id: { $in: absentStudentIds } },
      { $inc: { [`subjects.${subject}.totalClasses`]: 1 } }
    );

    res.json({ message: "✅ Attendance updated successfully!" });

  } catch (error) {
    console.error("❌ Error updating attendance:", error);
    res.status(500).json({ message: "❌ Server error while updating attendance" });
  }
});

// GET: Attendance register for a subject (date-wise present students)
router.get("/attendance-register", async (req, res) => {
  try {
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ message: "Subject is required" });

    const attendances = await Attendance.find({ subject }).sort({ date: 1 });
    const students = await Student.find({}, "studentID name");

    // Build a map: date -> presentStudents array
    const attendanceMap = {};
    attendances.forEach(record => {
      const dateStr = new Date(record.date).toISOString().split("T")[0];
      attendanceMap[dateStr] = record.presentStudents;
    });

    res.json({ students, subject, attendanceMap });

  } catch (error) {
    console.error("❌ Error in /attendance-register:", error);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// POST: Update attendance from table editor (multiple dates)
router.post("/update-attendance", async (req, res) => {
  const { subject, attendanceUpdateMap } = req.body;

  if (!subject || typeof attendanceUpdateMap !== 'object') {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  try {
    const updatePromises = Object.entries(attendanceUpdateMap).map(async ([date, presentStudents]) => {
      const attendanceDate = new Date(date);
      let attendance = await Attendance.findOne({ subject, date: attendanceDate });

      if (!attendance) {
        attendance = new Attendance({ subject, date: attendanceDate, presentStudents });
      } else {
        attendance.presentStudents = presentStudents;
      }

      await attendance.save();
    });

    await Promise.all(updatePromises);
    res.json({ message: '✅ Attendance updated successfully' });

  } catch (error) {
    console.error('❌ Error updating attendance:', error);
    res.status(500).json({ message: '❌ Failed to update attendance' });
  }
});

// ==============================
// 📌 CLASS MANAGEMENT ROUTES
// ==============================

// POST: Add new class info (stream, year, subjects)
router.post("/add-class", async (req, res) => {
  try {
    const { stream, year, subjects } = req.body;

    if (!stream || !year || !Array.isArray(subjects)) {
      return res.status(400).json({ message: "❌ Invalid class data" });
    }

    const newClass = new ClassInfo({ stream, year, subjects });
    await newClass.save();

    res.status(200).json({ message: "✅ Class Created Successfully" });

  } catch (error) {
    console.error("❌ Error creating class:", error);
    res.status(500).json({ message: "❌ Failed to create class" });
  }
});

// GET: Fetch all classes info
router.get("/classes", async (req, res) => {
  try {
    const classes = await ClassInfo.find();
    res.json(classes);
  } catch (error) {
    console.error("❌ Error fetching classes:", error);
    res.status(500).json({ message: "❌ Failed to fetch classes" });
  }
});

module.exports = router;
