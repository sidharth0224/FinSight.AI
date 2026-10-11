# Demo usage

There are two honest demonstration modes. The local UI preview (`NEXT_PUBLIC_DEMO_MODE=true`) uses fictional browser-local records and deterministic explanations, labeled synthetic throughout. The connected demo (`NEXT_PUBLIC_DEMO_MODE=false`, `DEMO_MODE=true` on the backend during seeding) uses actual PostgreSQL rows and live NVIDIA calls.

For connected demo accounts, set a private `DEMO_SEED_PASSWORD` yourself before seeding. All five role accounts use that development-only value. Their emails are `admin@northstar.demo`, `finance@northstar.demo`, `manager@northstar.demo`, `auditor@northstar.demo` and `employee@northstar.demo`. The isolation account is `admin@seabrook.demo`. The password is never committed. Rotate or restrict these accounts before deployment outside the fictional demo.

The reference period is October 2026, with May–October synthetic transactions. Choose October in the date filters. Suggested questions:

1. **Which departments exceeded their budget in 2026-10?** Engineering, Marketing and Sales exceed their allocations by INR 30,000, 75,000 and 15,000. The total budget variance is INR 62,500 because Operations and People & Culture are below budget.
2. **Why was EXP-1042 flagged?** The INR 42,500 travel claim exceeds the INR 25,000 review threshold and has no receipt. The response must distinguish missing evidence and review requirements from misconduct.
3. **What is our travel reimbursement policy?** The Copilot retrieves indexed policy passages and opens the source panel. Policy questions cannot be answered as verified before indexing succeeds.
4. **Compare marketing expenditure in 2026-10 with the previous month.** September is INR 400,000, October INR 425,000; change INR 25,000, 6.25%.

EXP-1053 demonstrates a potential duplicate of EXP-1050; EXP-1054 demonstrates an unusual large software request. EXP-1052 is a clean travel reimbursement. Incomplete-document and unsupported-question paths show insufficient evidence honestly. Human review remains required.

Use the expense form to submit a request, a finance account to review another employee's pending claim, and audit status controls to record investigation progress. Upload a text policy and wait for INDEXED before asking questions. CSV imports use `/api/imports/expenses` and accept headers `departmentId,employeeId,amount,category,merchant,date,description`; imported records remain pending.
