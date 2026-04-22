// test-engine.ts
// Run with: npx ts-node test-engine.ts

import { runDecisionEngine } from "./src/engine/index";
import { EmployeeProfile, LeaveRequest } from "./src/engine/types";

const employee: EmployeeProfile = {
  id: "0d796d5a-89f2-4a70-be32-bd7859098ff4",
  name: "Chanda Mwamba",
  gender: "female",
  monthsWorked: 30,
  leaveBalance: {
    annual: 18,
    sick: 24,
    maternity: 84,
    paternity: 5,
    compassionate: 5,
    study: 30,
  },
};

// ─── Test cases ───────────────────────────────────────────────────────────────
const tests: { label: string; request: LeaveRequest }[] = [
  {
    label: "✅ Annual leave — should APPROVE",
    request: { leaveType: "annual", daysRequested: 5, startDate: "2025-07-01", reason: "Holiday" },
  },
  {
    label: "❌ Annual leave — exceeds balance, should DENY",
    request: { leaveType: "annual", daysRequested: 20, startDate: "2025-07-01", reason: "Holiday" },
  },
  {
    label: "📋 Annual leave — big block, should REFER HR",
    request: { leaveType: "annual", daysRequested: 15, startDate: "2025-07-01", reason: "Holiday" },
  },
  {
    label: "✅ Sick leave — 2 days, no cert needed",
    request: { leaveType: "sick", daysRequested: 2, startDate: "2025-06-10", reason: "Flu" },
  },
  {
    label: "⚠️  Sick leave — 5 days, no cert provided",
    request: { leaveType: "sick", daysRequested: 5, startDate: "2025-06-10", reason: "Flu", hasMedicalCert: false },
  },
  {
    label: "📋 Maternity — qualifies (30 months), should REFER HR",
    request: { leaveType: "maternity", daysRequested: 84, startDate: "2025-08-01", reason: "Maternity" },
  },
  {
    label: "❌ Paternity — male employee requesting too many days",
    request: { leaveType: "paternity", daysRequested: 8, startDate: "2025-06-15", reason: "Birth of child" },
  },
  {
    label: "✅ Compassionate — 3 days bereavement",
    request: { leaveType: "compassionate", daysRequested: 3, startDate: "2025-06-20", reason: "Parent passed away" },
  },
  {
    label: "📋 Study leave — should always REFER HR",
    request: { leaveType: "study", daysRequested: 10, startDate: "2025-09-01", reason: "University exams" },
  },
];

// ─── Run tests ────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log("   LeaveAI — Decision Engine Test");
console.log("═══════════════════════════════════════════════\n");

tests.forEach(({ label, request }) => {
  const result = runDecisionEngine(request, employee);

  console.log(`${label}`);
  console.log(`   Decision   : ${result.decision}`);
  console.log(`   Reason     : ${result.reason}`);
  if (result.daysApproved) console.log(`   Days approved: ${result.daysApproved}`);
  if (result.flags.length)  console.log(`   Flags      : ${result.flags.join(", ")}`);
  if (result.suggestions?.length) console.log(`   Suggestion : ${result.suggestions[0]}`);
  console.log(`   Can override via chat: ${result.canOverride}`);
  console.log();
});
// Quick API test - run this in browser console or a test file
fetch("http://localhost:3000/health")
  .then(res => res.json())
  .then(console.log) // should print {status: "ok"}