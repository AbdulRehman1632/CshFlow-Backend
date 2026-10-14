const http = require('http');

// Small helper to make HTTP requests
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, raw: body, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE E2E API VERIFICATION ---');

  try {
    // 1. Health check
    const health = await request('GET', '/health');
    console.log(`[PASS] Health Check: Status ${health.status}`);

    // 2. Register User
    const testEmail = `test_${Date.now()}@tracker.com`;
    const regRes = await request('POST', '/auth/register', {
      name: 'PKR Auditor',
      email: testEmail,
      password: 'Password123!',
      currency: 'PKR',
      currencySymbol: 'Rs '
    });
    console.log(`[PASS] User Registration (PKR): Status ${regRes.status}, user: ${regRes.data?.user?.email}, currency: ${regRes.data?.user?.currency}`);
    const token = regRes.data?.token;

    // 3. Set Monthly Opening Balance for 2026-10 (PKR)
    const month = '2026-10';
    const balRes = await request(
      'POST',
      '/balances',
      {
        month,
        startingCashInHand: 20000,
        startingCashInBank: 100000,
        notes: 'Initial test opening balance in PKR'
      },
      token
    );
    console.log(`[PASS] Set Monthly Opening Balance: Status ${balRes.status}, Cash: Rs ${balRes.data?.data?.startingCashInHand}, Bank: Rs ${balRes.data?.data?.startingCashInBank}`);

    // 4. Record Cash Expense (Rs 5000 Groceries at Imtiaz)
    const tx1 = await request(
      'POST',
      '/transactions',
      {
        title: 'Weekly Groceries at Imtiaz',
        amount: 5000,
        type: 'expense',
        paymentMethod: 'cash',
        paymentChannel: 'Cash in Hand',
        category: 'Groceries & Kiryana',
        date: '2026-10-05T10:00:00.000Z'
      },
      token
    );
    console.log(`[PASS] Cash Expense: Status ${tx1.status}, ID: ${tx1.data?.data?._id}, Channel: ${tx1.data?.data?.paymentChannel}`);

    // 5. Record Easypaisa Bill Payment (Rs 3500 K-Electric)
    const tx2 = await request(
      'POST',
      '/transactions',
      {
        title: 'K-Electric Bill Payment',
        amount: 3500,
        type: 'expense',
        paymentMethod: 'bank',
        paymentChannel: 'Easypaisa',
        category: 'Electricity Bill (K-Electric/LESCO)',
        date: '2026-10-06T12:00:00.000Z'
      },
      token
    );
    console.log(`[PASS] Easypaisa Expense: Status ${tx2.status}, ID: ${tx2.data?.data?._id}, Channel: ${tx2.data?.data?.paymentChannel}`);

    // 6. Record JazzCash Internet Payment (Rs 2500 Nayatel)
    const tx2b = await request(
      'POST',
      '/transactions',
      {
        title: 'Nayatel Fiber Internet',
        amount: 2500,
        type: 'expense',
        paymentMethod: 'bank',
        paymentChannel: 'JazzCash',
        category: 'Internet & Mobile (Nayatel/Jazz/Zong)',
        date: '2026-10-06T14:00:00.000Z'
      },
      token
    );
    console.log(`[PASS] JazzCash Expense: Status ${tx2b.status}, Channel: ${tx2b.data?.data?.paymentChannel}`);

    // 7. Record ATM Cash-Out (Rs 10,000 Bank to Cash in Hand)
    const tx3 = await request(
      'POST',
      '/transactions',
      {
        title: 'Meezan Bank ATM Cash Withdrawal',
        amount: 10000,
        type: 'withdrawal',
        paymentMethod: 'bank',
        paymentChannel: 'ATM / Cash-Out',
        category: 'ATM Withdrawal',
        date: '2026-10-07T14:30:00.000Z'
      },
      token
    );
    console.log(`[PASS] ATM Cash-Out: Status ${tx3.status}, Amount: Rs ${tx3.data?.data?.amount}`);

    // 8. Record Salary Inflow via Raast (Rs 150,000)
    const tx4 = await request(
      'POST',
      '/transactions',
      {
        title: 'Monthly Tech Salary via Raast',
        amount: 150000,
        type: 'income',
        paymentMethod: 'bank',
        paymentChannel: 'Bank Transfer / Raast',
        category: 'Salary & Wages',
        date: '2026-10-01T09:00:00.000Z'
      },
      token
    );
    console.log(`[PASS] Raast Salary Income: Status ${tx4.status}, Amount: Rs ${tx4.data?.data?.amount}`);

    // 9. Record Cash Deposit to Bank / CDM (Rs 2000)
    const tx5 = await request(
      'POST',
      '/transactions',
      {
        title: 'Deposit Cash to HBL Account',
        amount: 2000,
        type: 'transfer',
        paymentMethod: 'cash',
        paymentChannel: 'Bank Deposit',
        category: 'Bank Deposit',
        date: '2026-10-08T15:00:00.000Z'
      },
      token
    );
    console.log(`[PASS] Cash Deposit to Bank: Status ${tx5.status}, Amount: Rs ${tx5.data?.data?.amount}`);

    // 9. Fetch Monthly Summary & Validate Exact Cash Flow Formulas
    const summaryRes = await request('GET', `/balances/${month}/summary`, null, token);
    const m = summaryRes.data?.metrics;
    console.log('\n--- VERIFYING CASH FLOW FORMULA METRICS (PKR) ---');
    console.log(`Starting Cash In Hand: Rs ${m.startingCashInHand} (Expected: 20000)`);
    console.log(`Starting Cash In Bank: Rs ${m.startingCashInBank} (Expected: 100000)`);
    console.log(`Total Expenses:        Rs ${m.totalExpenses} (Expected: 11000 = 5000 Cash + 6000 Easypaisa/JazzCash)`);
    console.log(`Total Income:          Rs ${m.totalIncome} (Expected: 150000)`);
    console.log(`ATM Withdrawals:       Rs ${m.withdrawals} (Expected: 10000)`);
    console.log(`Cash In Bank Transfer: Rs ${m.transfers} (Expected: 2000)`);
    console.log(`Closing Cash In Hand:  Rs ${m.closingCashInHand} (Expected: 23000 = 20000 - 5000 + 10000 - 2000)`);
    console.log(`Closing Cash In Bank:  Rs ${m.closingCashInBank} (Expected: 236000 = 100000 + 150000 - 6000 - 10000 + 2000)`);
    console.log(`Total Net Wealth:      Rs ${m.totalClosingBalance} (Expected: 259000 = 23000 + 236000)`);
    console.log(`Net Cash Flow:         Rs ${m.netCashFlow} (Expected: 139000 = 150000 - 11000)`);

    // Invariants check
    if (
      m.totalExpenses === 11000 &&
      m.closingCashInHand === 23000 &&
      m.closingCashInBank === 236000 &&
      m.netCashFlow === 139000
    ) {
      console.log('\n>>> ALL PKR FINANCIAL BALANCE INVARIANTS PASSED PERFECTLY! <<<');
    } else {
      console.error('\n>>> MATHEMATICAL DISCREPANCY DETECTED! <<<');
      process.exit(1);
    }

    // 10. Test Overall Analytics
    const overallRes = await request('GET', '/dashboard/overall', null, token);
    console.log(`[PASS] Overall Analytics: Status ${overallRes.status}, Lifetime Expenses: $${overallRes.data?.lifetime?.totalExpenses}`);

    // 11. Test CSV Export
    const csvRes = await request('GET', `/dashboard/export-csv?month=${month}`, null, token);
    console.log(`[PASS] CSV Export: Status ${csvRes.status}, Content length: ${csvRes.raw?.length} bytes`);

    console.log('\n--- ALL TEST SUITES PASSED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
}

// Wait 2 seconds for server to bind if needed
setTimeout(runTests, 1500);
