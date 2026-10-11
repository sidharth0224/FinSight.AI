# Using FinSight

Open [FinSight](https://13.206.122.144/login) and sign in with an account created by your administrator. The private local `DEMO_CREDENTIALS.local.md` guide contains the fictional test accounts and their password. Supabase and NVIDIA keys are service credentials, not website login credentials.

## Employee expense submission

1. Sign in as an employee. FinSight opens **Expenses** automatically.
2. Select **Submit expense**. Your assigned department is selected automatically.
3. Enter the amount, category, expense date, merchant, and business purpose.
4. Select a **Receipt or invoice** (PDF, PNG, or JPEG under 5 MB) and optional **Supporting documents**, such as approval letters or itineraries (up to five PDF, PNG, JPEG, DOCX, or TXT files, each under 5 MB).
5. Select **Submit for approval**. FinSight saves the pending claim, uploads the files, and opens the claim. You can add more files using **Attach receipt** and **Attach supporting document**. Every uploaded file appears under **Attached evidence**.
6. Your finance reviewer or assigned manager reviews the evidence and approves or rejects the claim. You can see the updated status in Expenses.

Employees see their own claims. They cannot approve claims or change budgets. An administrator creates employee access from **Settings → Organization → Add member**, selects **EMPLOYEE**, assigns a department, and provides the initial password.

## Investigating flags

Open a claim to see its risk rules and supporting details. **Investigate with Copilot** automatically sends the claim's reference and retrieves an explanation with source citations. Select a supporting source to inspect the evidence.

A missing-receipt flag is removed when a valid receipt is attached to a pending claim. Other rules, such as a policy threshold or potential duplicate, remain visible for human review. Approval records the review decision; it does not erase the original risk evidence.

EXP-1042 is a fictional example: its INR 42,500 travel claim has no receipt and exceeds the INR 25,000 category review threshold.

## Budgets, documents, and access

Finance and administrators allocate budgets from **Budgets → Allocate budget**. Copilot answers budget totals separately from overruns. “Last three months” includes the current month and the preceding two; use “last three completed months” to exclude the current month. Answers show the exact months used.

Employees and reviewers upload documents from **Knowledge base → Upload document**. Employee files are scoped to their department and start as **Pending review**. A finance reviewer, administrator, auditor, or assigned manager previews the original and chooses **Approve upload** before indexing. Unapproved employee uploads do not enter Copilot's evidence. The status updates automatically through Queued, Processing, and Indexed. TXT, text-based PDF, and DOCX files are supported. Authorized reviewers can import financial CSV files as pending expense records, with headers `departmentId,employeeId,amount,category,merchant,date,description`.

Managers see their assigned department and cannot view salary claims. Auditors can inspect evidence and update audit findings but cannot submit or approve expenses. Buttons follow these permissions.
