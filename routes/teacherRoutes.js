const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const Attendance = require("../models/Attendance");

// 📌 Fetch all students for attendance
router.get("/students", async (req, res) => {
    try {
        const students = await Student.find({}, "studentID name");
        res.json(students);
    } catch (err) {
        console.error("❌ Error fetching students:", err);
        res.status(500).json({ message: "❌ Error fetching students" });
    }
});

// 📌 Submit Attendance
router.post("/mark-attendance", async (req, res) => {
    try {
        console.log("📩 Received Attendance Request:", req.body);

        const { date, subject, studentsPresent } = req.body;

        if (!date || !subject || !Array.isArray(studentsPresent)) {
            console.log("❌ Invalid Request Data:", req.body);
            return res.status(400).json({ message: "❌ Invalid data provided" });
        }

        const formattedDate = new Date(date).toISOString().split("T")[0];

        // 🔍 Fetch students who are marked present
        const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id");

        if (!presentStudents.length) {
            console.log("⚠️ No valid students found with provided IDs.");
            return res.status(400).json({ message: "⚠️ No valid students found." });
        }

        const presentStudentIds = presentStudents.map(student => student._id);
        console.log("✅ Present Student IDs:", presentStudentIds);

        // 🔄 Check if attendance exists for the date & subject
        let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

        if (!attendanceRecord) {
            attendanceRecord = new Attendance({
                date: formattedDate,
                subject,
                presentStudents: presentStudentIds
            });
        } else {
            console.log("🛠 Updating existing attendance record.");
            attendanceRecord.presentStudents = presentStudentIds;
        }

        await attendanceRecord.save();
        console.log("✅ Attendance saved successfully!");

        // 🔄 Update student attendance counts
        await Student.updateMany(
            { _id: { $in: presentStudentIds } },
            { $inc: { [`subjects.${subject}.attendedClasses`]: 1, [`subjects.${subject}.totalClasses`]: 1 } }
        );

        // Fetch all students to correctly mark absentees
        const allStudents = await Student.find({}, "_id");

        const absentStudentIds = allStudents
            .filter(s => !presentStudentIds.includes(s._id))
            .map(s => s._id);

        await Student.updateMany(
            { _id: { $in: absentStudentIds } }, // Mark absentees
            { $inc: { [`subjects.${subject}.totalClasses`]: 1 } }
        );

        res.json({ message: "✅ Attendance submitted successfully!" });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "❌ Server error. Check logs for details." });
    }
});

// 📌 Fetch Attendance by Date & Subject
// 📌 Fetch Attendance by Date & Subject
router.get("/attendance", async (req, res) => {
    try {
        const { date, subject } = req.query;

        if (!date || !subject) {
            return res.status(400).json({ message: "❌ Date and subject are required" });
        }

        const formattedDate = new Date(date).toISOString().split("T")[0];
        console.log(`📊 Fetching attendance for ${subject} on ${formattedDate}...`);

        // Fetch attendance record
        const attendanceRecord = await Attendance.findOne({ date: formattedDate, subject }).populate("presentStudents", "studentID name");

        if (!attendanceRecord) {
            console.log("❌ No attendance record found.");
            return res.status(404).json({ message: "❌ No attendance data found." });
        }

        console.log("✅ Attendance Record Found:", attendanceRecord);

        // Fetch all students
        const allStudents = await Student.find({}, "studentID name");

        if (!allStudents.length) {
            console.log("⚠️ No student records found.");
            return res.status(500).json({ message: "⚠️ No student records available" });
        }

        // Extract present and absent students
        const presentStudents = attendanceRecord.presentStudents.map(s => ({ studentID: s.studentID, name: s.name }));
        const presentStudentIDs = presentStudents.map(s => s.studentID);

        const absentStudents = allStudents
            .filter(s => !presentStudentIDs.includes(s.studentID))
            .map(s => ({ studentID: s.studentID, name: s.name }));

        res.json({
            date: formattedDate,
            subject,
            presentStudents,
            absentStudents,
        });
    } catch (error) {
        console.error("❌ Error fetching attendance data:", error);
        res.status(500).json({ message: "❌ Server error. Check console logs for details." });
    }
});

module.exports = router;
