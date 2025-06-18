const express = require("express");
const router = express.Router();

const Student = require("../models/student");
const Attendance = require("../models/Attendance");
const sendWhatsAppMessage = require('../utils/sendWhatsAppMessage');
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

    // Get present students' _ids
    const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id");
    const presentStudentIds = presentStudents.map(s => s._id.toString());

    // Find or create attendance record
    let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });
    if (!attendanceRecord) {
      attendanceRecord = new Attendance({ date: formattedDate, subject, presentStudents: presentStudentIds });
    } else {
      attendanceRecord.presentStudents = presentStudentIds;
    }
    await attendanceRecord.save();

    // Find all students
    const allStudents = await Student.find();

    // Identify absent students: those NOT in presentStudentIds
    const absentStudents = allStudents.filter(student => !presentStudentIds.includes(student._id.toString()));

    // Send WhatsApp alert to all absent students' parents
    absentStudents.forEach(student => {
      if (student.parentPhone) {
        const msg = `Dear Parent, your child ${student.name} was absent on ${formattedDate} for ${subject}.`;
        sendWhatsAppMessage(student.parentPhone, msg);
      } else {
        console.warn(`No parentPhone for student: ${student.studentID} - ${student.name}`);
      }
    });

    res.json({ message: "✅ Attendance recorded and alerts sent to absentees' parents." });
  } catch (error) {
    console.error("❌ Error submitting attendance:", error);
    res.status(500).json({ message: "❌ Server error while marking attendance" });
  }
});

// GET: Fetch all subjects from Subject collection
router.get("/subjects", async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (error) {
    console.error("❌ Error fetching subjects:", error);
    res.status(500).json({ message: "Failed to fetch subjects" });
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

// POST: Add student
router.post('/add-student', async (req, res) => {
  const { studentID, name } = req.body;

  if (!studentID || !name) {
    return res.status(400).json({ message: "Student ID and Name are required." });
  }

  try {
    // Check if student already exists
    const existingStudent = await Student.findOne({ studentID });

    if (existingStudent) {
      return res.status(409).json({ message: "Student with this ID already exists." });
    }

    const newStudent = new Student({ studentID, name, totalAttended: 0 });
    await newStudent.save();

    res.status(201).json({ message: "Student added successfully!" });
  } catch (error) {
    console.error("Error adding student:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
