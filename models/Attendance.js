const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    subject: { type: String, required: true },
    presentStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }]
}, { timestamps: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
