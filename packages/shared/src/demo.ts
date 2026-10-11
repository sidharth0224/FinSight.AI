// Fictional, deterministic data shared by the PostgreSQL seed and the isolated UI preview.
export const demoDepartments = [
  {
    id: 'engineering',
    name: 'Engineering',
    color: '#22d3ee',
    budget: 650000,
    actual: 680000,
    icon: 'code',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    color: '#a78bfa',
    budget: 350000,
    actual: 425000,
    icon: 'megaphone',
  },
  { id: 'sales', name: 'Sales', color: '#34d399', budget: 300000, actual: 315000, icon: 'chart' },
  {
    id: 'operations',
    name: 'Operations',
    color: '#fbbf24',
    budget: 320000,
    actual: 280000,
    icon: 'layers',
  },
  {
    id: 'people',
    name: 'People & Culture',
    color: '#fb7185',
    budget: 180000,
    actual: 162500,
    icon: 'users',
  },
];
export const employeeNames = [
  'Arjun Mehta',
  'Priya Sharma',
  'Rohan Kapoor',
  'Ananya Rao',
  'Vikram Singh',
  'Neha Patel',
  'Aditya Nair',
  'Ishita Gupta',
  'Karan Shah',
  'Meera Iyer',
  'Rahul Verma',
  'Sana Khan',
  'Dev Malhotra',
  'Aisha Das',
  'Nikhil Jain',
  'Pooja Reddy',
  'Siddharth Roy',
  'Kavya Menon',
  'Aarav Joshi',
  'Diya Bhat',
  'Varun Sethi',
  'Riya Bose',
  'Sameer Ali',
  'Tara Sen',
  'Kabir Kumar',
];
export type DemoExpense = {
  id: string;
  employee: string;
  employeeId: string;
  department: string;
  departmentId: string;
  amount: string;
  currency: string;
  category: string;
  merchant: string;
  date: string;
  description: string;
  status: string;
  risk: string;
  receipt: boolean;
  rules: string[];
};
export function createDemoExpenses(): DemoExpense[] {
  const rows: DemoExpense[] = [];
  const categories = ['Software', 'Travel', 'Operations', 'Marketing', 'Salary'];
  const merchants = ['Figma, Inc.', 'IndiGo Airlines', 'Amazon Business', 'Google Ads', 'Payroll'];
  for (let m = 5; m <= 10; m++)
    for (let d = 0; d < 5; d++)
      for (let i = 0; i < 10; i++) {
        const dep = demoDepartments[d];
        const total = dep.actual - (10 - m) * (d === 1 ? 25000 : 12000);
        const amount = total / 10;
        const id = m === 10 && d === 1 && i === 2 ? 'EXP-1042' : `EXP-${m * 10000 + d * 100 + i}`;
        rows.push({
          id,
          employee: employeeNames[d * 5 + (i % 5)],
          employeeId: `emp-${d * 5 + (i % 5)}`,
          department: dep.name,
          departmentId: dep.id,
          amount: amount.toFixed(2),
          currency: 'INR',
          category: id === 'EXP-1042' ? 'Travel' : categories[i % 5],
          merchant: id === 'EXP-1042' ? 'Taj Hotels' : merchants[i % 5],
          date: `2026-${String(m).padStart(2, '0')}-${String(2 + i * 2).padStart(2, '0')}`,
          description: `${id === 'EXP-1042' ? 'Travel' : categories[i % 5]} expenditure for ${dep.name}`,
          status: 'APPROVED',
          risk: id === 'EXP-1042' ? 'High' : 'None',
          receipt: id !== 'EXP-1042',
          rules: id === 'EXP-1042' ? ['MISSING_RECEIPT', 'POLICY_THRESHOLD'] : [],
        });
      }
  rows.push(
    ...[0, 1, 2].map((i) => ({
      id: `EXP-105${i}`,
      employee: employeeNames[i * 5],
      employeeId: `emp-${i * 5}`,
      department: demoDepartments[i].name,
      departmentId: demoDepartments[i].id,
      amount: ['8500.00', '18000.00', '6200.00'][i],
      currency: 'INR',
      category: 'Travel',
      merchant: ['Uber for Business', 'Taj Hotels', 'IndiGo Airlines'][i],
      date: '2026-10-09',
      description: 'Client meeting and business travel',
      status: 'PENDING',
      risk: i === 1 ? 'Medium' : 'None',
      receipt: i !== 1,
      rules: i === 1 ? ['MISSING_RECEIPT'] : [],
    })),
  );
  rows.push({
    ...rows.find((r) => r.id === 'EXP-1050')!,
    id: 'EXP-1053',
    risk: 'High',
    rules: ['POTENTIAL_DUPLICATE'],
  });
  rows.push({
    ...rows.find((r) => r.id === 'EXP-1050')!,
    id: 'EXP-1054',
    amount: '250000.00',
    category: 'Software',
    merchant: 'Enterprise Systems Ltd.',
    risk: 'Medium',
    rules: ['UNUSUAL_AMOUNT'],
    description: 'Annual software license requiring supporting scope and review',
  });
  return rows;
}
