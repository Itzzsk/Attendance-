const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const Attendance = require("../models/Attendance");

// 📌 GET: Fetch all students
router.get("/students", async (req, res) => {
    try {
        const students = await Student.find({}, "studentID name");
        res.json(students);
    } catch (err) {
        console.error("❌ Error fetching students:", err);
        res.status(500).json({ message: "❌ Error fetching students" });
    }
});

// 📌 POST: Mark attendance
router.post("/mark-attendance", async (req, res) => {
    try {
        let { date, subject, studentsPresent } = req.body;

        date = date.trim();
        const parsedDate = new Date(date);
        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "❌ Invalid date format" });
        }
        const formattedDate = parsedDate.toISOString().split("T")[0];

        const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id studentID");
        const presentStudentIds = presentStudents.map(s => s._id);

        let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

        if (!attendanceRecord) {
            attendanceRecord = new Attendance({
                date: formattedDate,
                subject,
                presentStudents: presentStudentIds
            });
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

// 📌 PUT: Update attendance after submission
router.put("/update-attendance", async (req, res) => {
    try {
        const { date, subject, studentsPresent } = req.body;
        console.log("📩 Attendance update received:", req.body);

        if (!date || !subject || !Array.isArray(studentsPresent)) {
            return res.status(400).json({ message: "❌ Invalid attendance data" });
        }

        const formattedDate = new Date(date).toISOString().split("T")[0];

        const presentStudents = await Student.find({ studentID: { $in: studentsPresent } }).select("_id studentID");
        const presentStudentIds = presentStudents.map(s => s._id);

        const allStudents = await Student.find({}, "_id studentID");
        const absentStudentIds = allStudents
            .filter(s => !studentsPresent.includes(s.studentID))
            .map(s => s._id);

        let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

        if (!attendanceRecord) {
            return res.status(404).json({ message: "❌ Attendance record not found" });
        }

        attendanceRecord.presentStudents = presentStudentIds;
        await attendanceRecord.save();
        console.log("✅ Attendance record updated.");

        await Student.updateMany(
            { _id: { $in: presentStudentIds } },
            { $inc: { [`subjects.${subject}.attendedClasses`]: 1, [`subjects.${subject}.totalClasses`]: 1 } }
        );

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

// 📌 GET: View full attendance by subject with dates, present & absent
router.get("/attendance-register", async (req, res) => {
    try {
        const { subject } = req.query;
        if (!subject) return res.status(400).json({ message: "Subject is required" });

        const attendances = await Attendance.find({ subject }).sort({ date: 1 });
        const students = await Student.find({}, "studentID name");

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

// 📌 POST: Save attendance from table editor (used when manually editing)
router.post('/save-attendance', async (req, res) => {
    const { attendanceData, subject } = req.body;
    const invalidEntries = [];

    console.log("📥 Received attendance data:", attendanceData);
    console.log("📚 Subject:", subject);

    try {
        for (let data of attendanceData) {
            const { studentID, date, status } = data;
            console.log(`📌 Processing: ${studentID} - ${date} - ${status}`);

            const parsedDate = new Date(date);
            if (!date || isNaN(parsedDate)) {
                console.warn(`❌ Invalid date skipped for student ${studentID}`);
                invalidEntries.push(studentID);
                continue;
            }

            const formattedDate = parsedDate.toISOString().split("T")[0];
            const student = await Student.findOne({ studentID });

            if (!student) {
                console.warn(`❌ Student not found: ${studentID}`);
                invalidEntries.push(studentID);
                continue;
            }

            let attendanceRecord = await Attendance.findOne({ date: formattedDate, subject });

            if (!attendanceRecord) {
                attendanceRecord = new Attendance({
                    date: formattedDate,
                    subject,
                    presentStudents: status === 'P' ? [student._id] : [],
                });
            } else {
                const isPresent = attendanceRecord.presentStudents
                    .some(id => id.toString() === student._id.toString());

                if (status === 'P' && !isPresent) {
                    attendanceRecord.presentStudents.push(student._id);
                } else if (status === 'A' && isPresent) {
                    attendanceRecord.presentStudents = attendanceRecord.presentStudents.filter(
                        id => id.toString() !== student._id.toString()
                    );
                }
            }

            await attendanceRecord.save();
        }

        const message = invalidEntries.length > 0
            ? `✅ Attendance saved, but skipped: ${invalidEntries.join(", ")}`
            : "✅ All attendance saved successfully!";

        res.json({ success: true, message });

    } catch (error) {
        console.error("❌ Error updating attendance:", error);
        res.status(500).json({ success: false, message: '❌ Failed to update attendance.' });
    }
});

module.exports = router;
